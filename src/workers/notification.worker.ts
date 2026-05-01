import { Job } from "bullmq";
import { User } from "../models/user.model";
import { emailService } from "../services/email.service";
import { logger } from "../config/logger";
import { NotificationJobData, QUEUES, createWorker } from "./queue.definitions";

async function processNotification(
  job: Job<NotificationJobData>,
): Promise<void> {
  const { type, userId, email: providedEmail, payload } = job.data;

  let recipientEmail = providedEmail;
  if (!recipientEmail) {
    const user = await User.findById(userId).lean();
    if (!user) {
      logger.warn({ userId, type }, "Notification skipped — user not found");
      return;
    }
    recipientEmail = user.email;
  }

  await emailService.send(recipientEmail, type, payload ?? {});

  logger.info({ type, userId, recipientEmail }, "Notification sent");
}

export class NotificationWorker {
  private worker = createWorker<NotificationJobData>(
    QUEUES.NOTIFICATIONS,
    processNotification,
    10,
  );

  constructor() {
    this.worker.on("failed", (job, err) => {
      logger.error(
        { jobId: job?.id, type: job?.data.type, userId: job?.data.userId, err },
        "Notification job failed",
      );
    });
    this.worker.on("completed", (job) => {
      logger.debug({ jobId: job.id, type: job.data.type }, "Notification sent");
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
