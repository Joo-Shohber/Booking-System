import mongoose from "mongoose";
import { Job } from "bullmq";
import { Booking } from "../models/booking.model";
import { Slot } from "../models/slot.model";
import { User } from "../models/user.model";
import { BookingStatus } from "../types/enums";
import { RELEASE_SLOT_SCRIPT } from "../utils/lua-scripts";
import { cacheService, REDIS_KEYS } from "../services/cache.service";
import { logger } from "../config/logger";
import getRedis from "../config/redis";
import {
  BookingExpirationJobData,
  QUEUES,
  createWorker,
  getBookingPromotionQueue,
  getNotificationQueue,
} from "./queue.definitions";

async function processExpiration(
  job: Job<BookingExpirationJobData>,
): Promise<void> {
  const { bookingId, slotId, userId } = job.data;
  const redis = getRedis();

  const booking = await Booking.findById(bookingId).lean();
  if (!booking) {
    logger.warn({ bookingId }, "Expiration skipped — booking not found");
    return;
  }
  if (booking.status !== BookingStatus.PENDING) {
    logger.info(
      { bookingId, status: booking.status },
      "Expiration skipped — already handled",
    );
    return;
  }

  const slot = await Slot.findById(slotId).select("providerId").lean();
  const providerId = slot?.providerId?.toString();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Booking.findByIdAndUpdate(
        bookingId,
        { status: BookingStatus.EXPIRED },
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

  if (providerId) {
    await cacheService.invalidatePattern(
      REDIS_KEYS.providerSlotsPattern(providerId),
    );
  }

  await getBookingPromotionQueue().add(
    "promote",
    { slotId, availableSeats: 1 },
    { jobId: `promote:${slotId}:${Date.now()}` },
  );

  // ابعت notification
  const user = await User.findById(userId).lean();
  await getNotificationQueue().add("notify", {
    type: "booking_expired",
    userId,
    email: user?.email,
    slotId,
    payload: { bookingId },
  });

  logger.info(
    { bookingId, slotId, providerId },
    "Booking expired and slot released",
  );
}

export class ExpirationWorker {
  private worker = createWorker<BookingExpirationJobData>(
    QUEUES.BOOKING_EXPIRATION,
    processExpiration,
    3,
  );

  constructor() {
    this.worker.on("failed", (job, err) => {
      logger.error(
        { jobId: job?.id, bookingId: job?.data.bookingId, err },
        "Expiration job failed",
      );
    });
    this.worker.on("completed", (job) => {
      logger.debug(
        { jobId: job.id, bookingId: job.data.bookingId },
        "Expiration job completed",
      );
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
