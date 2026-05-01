import { Job } from "bullmq";
import { QueueEntry } from "../models/queue-entry.model";
import { User } from "../models/user.model";
import { QueueEntryStatus } from "../types/enums";
import { logger } from "../config/logger";
import {
  QueueConfirmationExpiryJobData,
  QUEUES,
  createWorker,
  getBookingPromotionQueue,
  getNotificationQueue,
} from "./queue.definitions";

async function processQueueConfirmationExpiry(
  job: Job<QueueConfirmationExpiryJobData>,
): Promise<void> {
  const { slotId, userId } = job.data;

  const entry = await QueueEntry.findOne({
    slotId,
    userId,
    status: QueueEntryStatus.NOTIFIED,
  }).lean();

  if (!entry) {
    logger.info(
      { slotId, userId },
      "Queue expiry skipped — entry not in NOTIFIED state (idempotent)",
    );
    return;
  }

  await QueueEntry.findByIdAndUpdate(entry._id, {
    status: QueueEntryStatus.EXPIRED,
  });

  // Free the seat and promote next in queue
  await getBookingPromotionQueue().add(
    "promote",
    { slotId, availableSeats: 1 },
    { jobId: `promote:${slotId}:${Date.now()}` },
  );

  // Notify user
  const user = await User.findById(userId).lean();
  await getNotificationQueue().add("notify", {
    type: "queue_confirmation_expired",
    userId,
    email: user?.email,
    slotId,
    payload: { slotId },
  });

  logger.info(
    { slotId, userId },
    "Queue confirmation window expired — next user promoted",
  );
}

export class QueueConfirmationExpiryWorker {
  private worker = createWorker<QueueConfirmationExpiryJobData>(
    QUEUES.QUEUE_CONFIRMATION_EXPIRY,
    processQueueConfirmationExpiry,
    5,
  );

  constructor() {
    this.worker.on("failed", (job, err) => {
      logger.error(
        {
          jobId: job?.id,
          slotId: job?.data.slotId,
          userId: job?.data.userId,
          err,
        },
        "Queue confirmation expiry job failed",
      );
    });
    this.worker.on("completed", (job) => {
      logger.debug(
        { jobId: job.id },
        "Queue confirmation expiry job completed",
      );
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
