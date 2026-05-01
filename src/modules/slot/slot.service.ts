import mongoose from "mongoose";
import { Slot, ISlot } from "../../models/slot.model";
import { Booking } from "../../models/booking.model";
import { QueueEntry } from "../../models/queue-entry.model";
import { Provider } from "../../models/provider.model";
import { AppError } from "../../types/errors";
import { BookingStatus, QueueEntryStatus, SlotStatus } from "../../types/enums";
import { generateSlots as generateSlotsUtil } from "../../utils/slot-generator";
import getRedis from "../../config/redis";
import getEnv from "../../config/env";
import { cacheService, REDIS_KEYS } from "../../services/cache.service";
import { getCachedSlots, setCachedSlots } from "./slot.cache";

export interface SlotResponseDTO {
  id: string;
  providerId: string;
  startTime: Date;
  endTime: Date;
  date: Date;
  capacity: number;
  booked: number;
  available: number;
  isFull: boolean;
  status: SlotStatus;
  queueLength: number;
  canBook: boolean;
  canJoinQueue: boolean;
  userBookingStatus: null | "pending" | "booked" | "in_queue" | "notified";
}

export async function initSlotAvailability(
  slotId: string,
  available: number,
): Promise<void> {
  const redis = getRedis();
  await redis.set(REDIS_KEYS.slotAvailability(slotId), available);
}

export async function getSlots(
  providerId: string,
  date: string,
  requestingUserId: string,
): Promise<SlotResponseDTO[]> {
  const cached = await getCachedSlots<SlotResponseDTO[]>(providerId, date);

  let baseSlots: SlotResponseDTO[];

  if (cached) {
    baseSlots = cached;
  } else {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const slots = await Slot.find({
      providerId,
      date: { $gte: startOfDay, $lte: endOfDay },
      isActive: true,
    }).lean({ virtuals: true });

    const redis = getRedis();

    const enriched = await Promise.all(
      slots.map(async (slot) => {
        const slotId = (slot._id as mongoose.Types.ObjectId).toString();

        const redisAvailable = await redis.get(
          REDIS_KEYS.slotAvailability(slotId),
        );
        if (redisAvailable === null) {
          await initSlotAvailability(
            slotId,
            (slot.capacity as number) - (slot.booked as number),
          );
        }

        const queueLength = await redis.zcard(REDIS_KEYS.queue(slotId));

        const slotStatus = slot.status as SlotStatus;

        return {
          id: slotId,
          providerId: (slot.providerId as mongoose.Types.ObjectId).toString(),
          startTime: slot.startTime as Date,
          endTime: slot.endTime as Date,
          date: slot.date as Date,
          capacity: slot.capacity as number,
          booked: slot.booked as number,
          available:
            (slot.available as number) ??
            (slot.capacity as number) - (slot.booked as number),
          isFull:
            (slot.isFull as boolean) ??
            (slot.booked as number) >= (slot.capacity as number),
          status: slotStatus,
          queueLength,
          canBook: slotStatus === SlotStatus.AVAILABLE,
          canJoinQueue: slotStatus === SlotStatus.FULL,
          userBookingStatus: null as null,
        };
      }),
    );

    baseSlots = enriched;
    await setCachedSlots(providerId, date, baseSlots);
  }

  const slotIds = baseSlots.map((s) => s.id);

  const [userBookings, userQueueEntries] = await Promise.all([
    Booking.find({
      userId: requestingUserId,
      slotId: { $in: slotIds },
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    }).lean(),
    QueueEntry.find({
      userId: requestingUserId,
      slotId: { $in: slotIds },
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.NOTIFIED] },
    }).lean(),
  ]);

  const bookingMap = new Map(
    userBookings.map((b) => [
      (b.slotId as mongoose.Types.ObjectId).toString(),
      b.status as BookingStatus,
    ]),
  );
  const queueMap = new Map(
    userQueueEntries.map((q) => [
      (q.slotId as mongoose.Types.ObjectId).toString(),
      q.status as QueueEntryStatus,
    ]),
  );

  return baseSlots.map((slot) => {
    let userBookingStatus: SlotResponseDTO["userBookingStatus"] = null;
    const bookingStatus = bookingMap.get(slot.id);
    const queueStatus = queueMap.get(slot.id);

    if (bookingStatus === BookingStatus.PENDING) userBookingStatus = "pending";
    else if (bookingStatus === BookingStatus.CONFIRMED)
      userBookingStatus = "booked";
    else if (queueStatus === QueueEntryStatus.WAITING)
      userBookingStatus = "in_queue";
    else if (queueStatus === QueueEntryStatus.NOTIFIED)
      userBookingStatus = "notified";

    return { ...slot, userBookingStatus };
  });
}

export async function getSlotById(
  slotId: string,
  requestingUserId: string,
): Promise<SlotResponseDTO> {
  const redis = getRedis();
  const slot = await Slot.findById(slotId).lean({ virtuals: true });
  if (!slot) {
    throw new AppError("NOT_FOUND", 404, "Slot not found");
  }

  const redisAvailable = await redis.get(REDIS_KEYS.slotAvailability(slotId));
  if (redisAvailable === null) {
    await initSlotAvailability(
      slotId,
      (slot.capacity as number) - (slot.booked as number),
    );
  }

  const queueLength = await redis.zcard(REDIS_KEYS.queue(slotId));
  const slotStatus = slot.status as SlotStatus;

  const [userBooking, userQueueEntry] = await Promise.all([
    Booking.findOne({
      userId: requestingUserId,
      slotId,
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    }).lean(),
    QueueEntry.findOne({
      userId: requestingUserId,
      slotId,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.NOTIFIED] },
    }).lean(),
  ]);

  let userBookingStatus: SlotResponseDTO["userBookingStatus"] = null;
  if (userBooking?.status === BookingStatus.PENDING)
    userBookingStatus = "pending";
  else if (userBooking?.status === BookingStatus.CONFIRMED)
    userBookingStatus = "booked";
  else if (userQueueEntry?.status === QueueEntryStatus.WAITING)
    userBookingStatus = "in_queue";
  else if (userQueueEntry?.status === QueueEntryStatus.NOTIFIED)
    userBookingStatus = "notified";

  return {
    id: slotId,
    providerId: (slot.providerId as mongoose.Types.ObjectId).toString(),
    startTime: slot.startTime as Date,
    endTime: slot.endTime as Date,
    date: slot.date as Date,
    capacity: slot.capacity as number,
    booked: slot.booked as number,
    available:
      (slot.available as number) ??
      (slot.capacity as number) - (slot.booked as number),
    isFull:
      (slot.isFull as boolean) ??
      (slot.booked as number) >= (slot.capacity as number),
    status: slotStatus,
    queueLength,
    canBook: slotStatus === SlotStatus.AVAILABLE,
    canJoinQueue: slotStatus === SlotStatus.FULL,
    userBookingStatus,
  };
}

export async function generateSlots(
  providerId: string,
  requestingUserId: string,
  startDate: Date,
  endDate: Date,
): Promise<{ generated: number; total: number }> {
  const env = getEnv();

  const diffDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays > env.SLOT_GENERATE_MAX_DAYS) {
    throw new AppError(
      "VALIDATION_ERROR",
      422,
      `Date range cannot exceed ${env.SLOT_GENERATE_MAX_DAYS} days`,
    );
  }

  const provider = await Provider.findById(providerId);
  if (!provider) {
    throw new AppError("NOT_FOUND", 404, "Provider not found");
  }
  if (provider.userId.toString() !== requestingUserId) {
    throw new AppError("FORBIDDEN", 403, "You do not own this provider");
  }

  const slots = generateSlotsUtil(provider, startDate, endDate);

  let result: ISlot[] = [];
  try {
    result = await Slot.insertMany(slots, { ordered: false });
  } catch (err: unknown) {
    // BulkWriteError from ordered:false — inserted docs are in err.result.insertedIds
    // Mongoose throws but still inserts non-duplicate documents
    const bulkErr = err as {
      name?: string;
      insertedDocs?: ISlot[];
      result?: { insertedCount?: number };
    };
    if (
      bulkErr.name === "MongoBulkWriteError" ||
      bulkErr.name === "BulkWriteError"
    ) {
      // Re-fetch inserted slots by matching the generated slot times
      const slotTimes = slots.map((s) => s.startTime);
      result = await Slot.find({ providerId, startTime: { $in: slotTimes } });
    } else {
      throw err;
    }
  }

  await Promise.all(
    result.map((slot) =>
      initSlotAvailability(slot.id, slot.capacity - slot.booked),
    ),
  );

  return { generated: result.length, total: slots.length };
}

export const slotService = {
  initSlotAvailability,
  getSlots,
  getSlotById,
  generateSlots,
};
