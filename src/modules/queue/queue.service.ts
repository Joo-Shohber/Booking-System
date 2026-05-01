import { CACHE_KEYS } from "./../../services/cache.service";
import mongoose from "mongoose";
import { Slot } from "../../models/slot.model";
import { Booking } from "../../models/booking.model";
import { QueueEntry } from "../../models/queue-entry.model";
import { Provider } from "../../models/provider.model";
import { AppError } from "../../types/errors";
import { BookingStatus, QueueEntryStatus, SlotStatus } from "../../types/enums";
import { BOOK_SLOT_SCRIPT, RELEASE_SLOT_SCRIPT } from "../../utils/lua-scripts";
import { calculateWaitTime } from "../../utils/wait-time";
import getRedis from "../../config/redis";
import getEnv from "../../config/env";
import { cacheService, REDIS_KEYS } from "../../services/cache.service";
import { lockService } from "../../services/lock.service";
import { emitToUser } from "../../services/websocket.service";
import {
  getQueueConfirmationExpiryQueue,
  getNotificationQueue,
  getBookingPromotionQueue,
} from "../../workers/queue.definitions";

export async function joinQueue(slotId: string, userId: string) {
  const redis = getRedis();

  const slot = await Slot.findById(slotId).lean({ virtuals: true });
  if (!slot) throw new AppError("NOT_FOUND", 404, "Slot not found");
  if ((slot.status as SlotStatus) !== SlotStatus.FULL) {
    throw new AppError(
      "SLOT_NOT_FULL",
      409,
      "Slot is not full — book directly instead",
      {
        canBook: true,
        slotId,
      },
    );
  }

  const [activeBooking, existingEntry] = await Promise.all([
    Booking.findOne({
      slotId,
      userId,
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    }),
    QueueEntry.findOne({
      slotId,
      userId,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.NOTIFIED] },
    }),
  ]);

  if (activeBooking)
    throw new AppError(
      "ALREADY_BOOKED",
      409,
      "You already have a booking for this slot",
    );
  if (existingEntry)
    throw new AppError("ALREADY_IN_QUEUE", 409, "You are already in the queue");

  const provider = await Provider.findById(slot.providerId);
  const slotDuration = provider?.slotDuration ?? 30;

  const score = Date.now();
  await redis.zadd(REDIS_KEYS.queue(slotId), score, userId);

  const rank = await redis.zrank(REDIS_KEYS.queue(slotId), userId);
  const position = (rank ?? 0) + 1;
  const estimatedWait = calculateWaitTime(position, slotDuration);

  await QueueEntry.create({
    slotId,
    userId,
    status: QueueEntryStatus.WAITING,
    estimatedWait,
  });
  await redis.incr(REDIS_KEYS.queueLength(slotId));

  emitToUser(userId, "queue:joined", { slotId, position, estimatedWait });

  const notifQueue = getNotificationQueue();
  await notifQueue.add("notify", {
    type: "queue_joined",
    userId,
    slotId,
    payload: { position, estimatedWait },
  });

  return { position, estimatedWait, queueLength: position };
}

export async function promoteBatch(slotId: string, availableSeats: number) {
  const env = getEnv();
  const redis = getRedis();

  return lockService.withLock(
    `lock:queue:${slotId}`,
    env.LOCK_TTL_MS,
    async () => {
      let promoted = 0;
      const notifiedUsers: string[] = [];

      while (promoted < availableSeats) {
        const result = await redis.zpopmin(REDIS_KEYS.queue(slotId), 1); // اول واحد ف ال q
        if (!result || result.length === 0) break;

        const queueUserId = result[0];
        const entry = await QueueEntry.findOne({
          slotId,
          userId: queueUserId,
          status: QueueEntryStatus.WAITING,
        });

        if (!entry) continue;

        const deadline = new Date(
          Date.now() + env.QUEUE_CONFIRM_MINUTES * 60000,
        );

        await QueueEntry.findByIdAndUpdate(entry._id, {
          status: QueueEntryStatus.NOTIFIED,
          notifiedAt: new Date(),
          confirmationDeadline: deadline,
        });

        const confirmExpiryQueue = getQueueConfirmationExpiryQueue();
        await confirmExpiryQueue.add(
          "queue-confirm-expiry",
          { slotId, userId: queueUserId },
          {
            jobId: `queue:expire:${slotId}:${queueUserId}`,
            delay: env.QUEUE_CONFIRM_MINUTES * 60000,
          },
        );

        emitToUser(queueUserId, "queue:your_turn", {
          slotId,
          confirmationDeadline: deadline,
        });

        const notifQueue = getNotificationQueue();
        await notifQueue.add("notify", {
          type: "queue_promoted",
          userId: queueUserId,
          slotId,
          payload: {
            slotId,
            deadline,
            confirmMinutes: env.QUEUE_CONFIRM_MINUTES,
          },
        });

        promoted++;
        notifiedUsers.push(queueUserId);
      }

      if (promoted > 0) {
        await redis.decrby(REDIS_KEYS.queueLength(slotId), promoted);
      }

      return { promoted, notifiedUsers };
    },
  );
}

export async function confirmQueueSlot(slotId: string, userId: string) {
  const redis = getRedis();
  const env = getEnv();

  const entry = await QueueEntry.findOne({
    slotId,
    userId,
    status: QueueEntryStatus.NOTIFIED,
  });
  if (!entry)
    throw new AppError("NOT_FOUND", 404, "No notified queue entry found");
  if (entry.confirmationDeadline && entry.confirmationDeadline < new Date()) {
    throw new AppError(
      "QUEUE_CONFIRMATION_EXPIRED",
      410,
      "Queue confirmation window has expired",
    );
  }

  await lockService.withLock(
    `lock:slot:${slotId}`,
    env.LOCK_TTL_MS,
    async () => {
      let result = (await redis.eval(
        BOOK_SLOT_SCRIPT,
        1,
        REDIS_KEYS.slotAvailability(slotId),
      )) as number;

      if (result === -2) {
        const slot = await Slot.findById(slotId);
        if (!slot) throw new AppError("NOT_FOUND", 404, "Slot not found");
        const { slotService } = await import("../slot/slot.service");
        await slotService.initSlotAvailability(
          slotId,
          slot.capacity - slot.booked,
        );
        result = (await redis.eval(
          BOOK_SLOT_SCRIPT,
          1,
          REDIS_KEYS.slotAvailability(slotId),
        )) as number;
      }

      if (result === -1) {
        const promotionQueue = getBookingPromotionQueue();
        await promotionQueue.add("promote", { slotId, availableSeats: 1 });
        throw new AppError(
          "SLOT_FULL",
          409,
          "Slot became full — re-queuing next user",
        );
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await Slot.findByIdAndUpdate(
            slotId,
            { $inc: { booked: 1 } },
            { session },
          );
          await Booking.create(
            [
              {
                slotId,
                userId,
                status: BookingStatus.CONFIRMED,
                confirmedAt: new Date(),
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              },
            ],
            { session },
          );
          await QueueEntry.findByIdAndUpdate(
            entry._id,
            { status: QueueEntryStatus.CONFIRMED },
            { session },
          );
        });
      } catch (err) {
        await redis.eval(
          RELEASE_SLOT_SCRIPT,
          1,
          REDIS_KEYS.slotAvailability(slotId),
        );
        throw err;
      } finally {
        await session.endSession();
      }
    },
  );

  const slot = await Slot.findById(slotId).lean();
  const providerId = slot?.providerId.toString();
  if (providerId) {
    await cacheService.invalidatePattern(
      CACHE_KEYS.providerSlotsPattern(providerId),
    );
  }

  const notifQueue = getNotificationQueue();
  await notifQueue.add("notify", {
    type: "booking_confirmed",
    userId,
    slotId,
    payload: { slotId },
  });

  emitToUser(userId, "queue:confirmed", { slotId });

  return { success: true };
}

export async function getPosition(slotId: string, userId: string) {
  const redis = getRedis();
  const rank = await redis.zrank(REDIS_KEYS.queue(slotId), userId);
  if (rank === null) return null;

  const position = rank + 1;
  const entry = await QueueEntry.findOne({ slotId, userId });

  return {
    position,
    estimatedWait: entry?.estimatedWait ?? 0,
    status: entry?.status ?? QueueEntryStatus.WAITING,
    confirmationDeadline: entry?.confirmationDeadline ?? null,
  };
}

export async function leaveQueue(slotId: string, userId: string) {
  const redis = getRedis();

  await redis.zrem(REDIS_KEYS.queue(slotId), userId);
  await QueueEntry.findOneAndUpdate(
    {
      slotId,
      userId,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.NOTIFIED] },
    },
    { status: QueueEntryStatus.LEFT },
  );
  await redis.decr(REDIS_KEYS.queueLength(slotId));
  await cacheService.del(REDIS_KEYS.queueLength(slotId));

  emitToUser(userId, "queue:left", { slotId });

  return { success: true };
}
