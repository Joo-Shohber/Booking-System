import { Queue, Worker, Processor } from "bullmq";
import getRedis from "../config/redis";

export const QUEUES = {
  BOOKING_EXPIRATION: "booking-expiration",
  BOOKING_PROMOTION: "booking-promotion",
  QUEUE_CONFIRMATION_EXPIRY: "queue-confirmation-expiry",
  NOTIFICATIONS: "notifications",
} as const;

export interface BookingExpirationJobData {
  bookingId: string;
  slotId: string;
  userId: string;
}

export interface BookingPromotionJobData {
  slotId: string;
  availableSeats: number;
}

export interface QueueConfirmationExpiryJobData {
  slotId: string;
  userId: string;
}

export interface NotificationJobData {
  type:
    | "booking_confirmed"
    | "booking_cancelled"
    | "booking_expired"
    | "queue_promoted"
    | "queue_joined"
    | "queue_confirmation_expired";
  userId: string;
  slotId?: string;
  email?: string;
  payload?: Record<string, unknown>;
}

function newConnection() {
  return getRedis().duplicate();
}

let _expirationQueue: Queue<BookingExpirationJobData>;
let _promotionQueue: Queue<BookingPromotionJobData>;
let _confirmationExpiryQueue: Queue<QueueConfirmationExpiryJobData>;
let _notificationQueue: Queue<NotificationJobData>;

export function getBookingExpirationQueue(): Queue<BookingExpirationJobData> {
  if (!_expirationQueue) {
    _expirationQueue = new Queue<BookingExpirationJobData>(
      QUEUES.BOOKING_EXPIRATION,
      {
        connection: newConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      },
    );
  }
  return _expirationQueue;
}

export function getBookingPromotionQueue(): Queue<BookingPromotionJobData> {
  if (!_promotionQueue) {
    _promotionQueue = new Queue<BookingPromotionJobData>(
      QUEUES.BOOKING_PROMOTION,
      {
        connection: newConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 3000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      },
    );
  }
  return _promotionQueue;
}

export function getQueueConfirmationExpiryQueue(): Queue<QueueConfirmationExpiryJobData> {
  if (!_confirmationExpiryQueue) {
    _confirmationExpiryQueue = new Queue<QueueConfirmationExpiryJobData>(
      QUEUES.QUEUE_CONFIRMATION_EXPIRY,
      {
        connection: newConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 3000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      },
    );
  }
  return _confirmationExpiryQueue;
}

export function getNotificationQueue(): Queue<NotificationJobData> {
  if (!_notificationQueue) {
    _notificationQueue = new Queue<NotificationJobData>(QUEUES.NOTIFICATIONS, {
      connection: newConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return _notificationQueue;
}

export function createWorker<T>(
  queueName: string,
  processor: Processor<T>,
  concurrency = 5,
): Worker<T> {
  return new Worker<T>(queueName, processor, {
    connection: newConnection(),
    concurrency,
  });
}
