import mongoose from "mongoose";
import { Booking } from "../../models/booking.model";
import { Slot } from "../../models/slot.model";
import { QueueEntry } from "../../models/queue-entry.model";
import { AppError } from "../../types/errors";
import { BookingStatus, QueueEntryStatus } from "../../types/enums";
import { BOOK_SLOT_SCRIPT, RELEASE_SLOT_SCRIPT } from "../../utils/lua-scripts";
import getRedis from "../../config/redis";
import getEnv from "../../config/env";
import { cacheService, REDIS_KEYS } from "../../services/cache.service";
import { slotService } from "../slot/slot.service";
import { emitToUser } from "../../services/websocket.service";
import {
  getBookingExpirationQueue,
  getBookingPromotionQueue,
} from "../../workers/queue.definitions";

export async function bookSlot(slotId: string, userId: string) {
  const env = getEnv();
  const redis = getRedis();

  const [existing, inQueue] = await Promise.all([
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

  if (existing)
    throw new AppError(
      "ALREADY_BOOKED",
      409,
      "You already have a booking for this slot",
    );
  if (inQueue)
    throw new AppError(
      "ALREADY_IN_QUEUE",
      409,
      "You are already in the queue for this slot",
    );

  let result = (await redis.eval(
    BOOK_SLOT_SCRIPT,
    1,
    REDIS_KEYS.slotAvailability(slotId),
  )) as number;

  if (result === -2) {
    const slot = await Slot.findById(slotId);
    if (!slot) throw new AppError("NOT_FOUND", 404, "Slot not found");
    await slotService.initSlotAvailability(slotId, slot.capacity - slot.booked);
    result = (await redis.eval(
      BOOK_SLOT_SCRIPT,
      1,
      REDIS_KEYS.slotAvailability(slotId),
    )) as number;
  }

  if (result === -1) {
    throw new AppError("SLOT_FULL", 409, "Slot is fully booked", {
      canJoinQueue: true,
      slotId,
    });
  }

  const session = await mongoose.startSession();
  let booking: InstanceType<typeof Booking> | undefined;

  try {
    await session.withTransaction(async () => {
      await Slot.findByIdAndUpdate(
        slotId,
        { $inc: { booked: 1 } },
        { session },
      );
      const [created] = await Booking.create(
        [
          {
            slotId,
            userId,
            status: BookingStatus.PENDING,
            expiresAt: new Date(
              Date.now() + env.BOOKING_EXPIRY_MINUTES * 60000,
            ),
          },
        ],
        { session },
      );
      booking = created;
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

  if (!booking) {
    await redis.eval(
      RELEASE_SLOT_SCRIPT,
      1,
      REDIS_KEYS.slotAvailability(slotId),
    );
    throw new AppError("INTERNAL_ERROR", 500, "Failed to create booking");
  }

  const expirationQueue = getBookingExpirationQueue();
  await expirationQueue.add(
    "expire-booking",
    { bookingId: booking.id, slotId, userId },
    {
      jobId: `expire:booking:${booking.id}`,
      delay: env.BOOKING_EXPIRY_MINUTES * 60000,
    },
  );

  await Promise.all([
    cacheService.del(REDIS_KEYS.slotAvailability(slotId)),
    cacheService.invalidatePattern(`provider:slots:*`),
  ]);

  emitToUser(userId, "booking:created", { bookingId: booking.id, slotId });

  const updatedSlot = await slotService.getSlotById(slotId, userId);
  return { booking, slot: updatedSlot };
}

export async function confirmBooking(bookingId: string, userId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError("NOT_FOUND", 404, "Booking not found");
  if (booking.userId.toString() !== userId)
    throw new AppError("FORBIDDEN", 403, "Not your booking");
  if (booking.status !== BookingStatus.PENDING) {
    throw new AppError(
      "VALIDATION_ERROR",
      422,
      "Only pending bookings can be confirmed",
    );
  }

  booking.status = BookingStatus.CONFIRMED;
  booking.confirmedAt = new Date();
  await booking.save();

  try {
    const expirationQueue = getBookingExpirationQueue();
    await expirationQueue.remove(`expire:booking:${bookingId}`);
  } catch {
    // job may already be processed
  }

  return booking;
}

export async function cancelBooking(bookingId: string, userId: string) {
  const redis = getRedis();
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError("NOT_FOUND", 404, "Booking not found");
  if (booking.userId.toString() !== userId)
    throw new AppError("FORBIDDEN", 403, "Not your booking");
  if (
    ![BookingStatus.CONFIRMED, BookingStatus.PENDING].includes(booking.status)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      422,
      "Only active bookings can be cancelled",
    );
  }

  const slotId = booking.slotId.toString();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Booking.findByIdAndUpdate(
        bookingId,
        { status: BookingStatus.CANCELLED },
        { session },
      );
      await Slot.findByIdAndUpdate(
        slotId,
        { $inc: { booked: -1 } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  await redis.eval(RELEASE_SLOT_SCRIPT, 1, REDIS_KEYS.slotAvailability(slotId));

  await Promise.all([
    cacheService.del(REDIS_KEYS.slotAvailability(slotId)),
    cacheService.invalidatePattern(`provider:slots:*`),
  ]);

  const promotionQueue = getBookingPromotionQueue();
  await promotionQueue.add(
    "promote",
    { slotId, availableSeats: 1 },
    { jobId: `promote:${slotId}:${Date.now()}` },
  );

  emitToUser(userId, "booking:cancelled", { bookingId, slotId });

  return Booking.findById(bookingId);
}

export async function getMyBookings(
  userId: string,
  query: Record<string, unknown>,
) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 10);
  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    Booking.find({ userId })
      .populate("slotId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments({ userId }),
  ]);

  return { bookings, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getAllBookings(query: Record<string, unknown>) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.slotId) filter.slotId = query.slotId;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("slotId")
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  return { bookings, total, page, limit, pages: Math.ceil(total / limit) };
}
