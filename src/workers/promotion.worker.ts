import { Job } from "bullmq";
import { Slot } from "../models/slot.model";
import { promoteBatch } from "../modules/queue/queue.service";
import { logger } from "../config/logger";
import {
  BookingPromotionJobData,
  QUEUES,
  createWorker,
} from "./queue.definitions";

async function processPromotion(
  job: Job<BookingPromotionJobData>,
): Promise<void> {
  const { slotId, availableSeats } = job.data;

  const slot = await Slot.findById(slotId).lean();
  if (!slot) {
    logger.warn({ slotId }, "Promotion skipped — slot not found");
    return;
  }

  // Re-check real availability from DB (source of truth)
  const dbAvailable = slot.capacity - slot.booked;
  if (dbAvailable <= 0) {
    logger.info(
      { slotId, booked: slot.booked, capacity: slot.capacity },
      "Promotion skipped — slot full",
    );
    return;
  }

  const seatsToPromote = Math.min(dbAvailable, availableSeats);
  const result = await promoteBatch(slotId, seatsToPromote);

  logger.info(
    {
      slotId,
      requested: availableSeats,
      promoted: result.promoted,
      users: result.notifiedUsers,
    },
    "Promotion batch complete",
  );
}

export class PromotionWorker {
  private worker = createWorker<BookingPromotionJobData>(
    QUEUES.BOOKING_PROMOTION,
    processPromotion,
    3,
  );

  constructor() {
    this.worker.on("failed", (job, err) => {
      logger.error(
        { jobId: job?.id, slotId: job?.data.slotId, err },
        "Promotion job failed",
      );
    });
    this.worker.on("completed", (job) => {
      logger.debug(
        { jobId: job.id, slotId: job.data.slotId },
        "Promotion job completed",
      );
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
