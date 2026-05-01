import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import mongoose from "mongoose";

import { parseEnv } from "./config/env";
import { logger } from "./config/logger";
import { connectDatabase } from "./config/database";
import { connectRedis, getRedis } from "./config/redis";
import { initWebSocket } from "./services/websocket.service";
import app from "./app";

import { ExpirationWorker } from "./workers/expiration.worker";
import { PromotionWorker } from "./workers/promotion.worker";
import { QueueConfirmationExpiryWorker } from "./workers/queue-confirmation-expiry.worker";
import { NotificationWorker } from "./workers/notification.worker";

const env = parseEnv();
const httpServer = createServer(app);

type AnyWorker = { close(): Promise<void> };
let workers: AnyWorker[] = [];

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, "Shutdown signal received");

  httpServer.close(async () => {
    try {
      await Promise.all(workers.map((w) => w.close()));
      await mongoose.disconnect();
      const redis = getRedis();
      await redis.quit();
      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Force exit — shutdown timed out");
    process.exit(1);
  }, 10000);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection");
  shutdown("unhandledRejection");
});

async function start(): Promise<void> {
  logger.info("Starting server...");

  await connectDatabase();
  await connectRedis();

  initWebSocket(httpServer);
  logger.info("WebSocket server initialized");

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, `Server listening on port ${env.PORT}`);
  });

  workers = [
    new ExpirationWorker(),
    new PromotionWorker(),
    new QueueConfirmationExpiryWorker(),
    new NotificationWorker(),
  ];

  logger.info("All workers initialized");
}

start().catch((err) => {
  logger.error({ err }, "Startup failed");
  process.exit(1);
});
