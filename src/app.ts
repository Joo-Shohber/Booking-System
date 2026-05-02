import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { pinoHttp } from "pino-http";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";

import { logger } from "./config/logger";
import getEnv from "./config/env";
import getRedis from "./config/redis";
import { initPassport } from "./config/passport";
import { initCloudinary } from "./config/cloudinary";
import { rateLimiter } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error-handler";
import { AppError } from "./types/errors";

import authRoutes from "./modules/auth/auth.routes";
import providerRoutes from "./modules/provider/provider.routes";
import slotRoutes from "./modules/slot/slot.routes";
import bookingRoutes from "./modules/booking/booking.routes";
import queueRoutes from "./modules/queue/queue.routes";

const app = express();
const env = getEnv();

// 1. Init third-party configs
initPassport();
initCloudinary();

// 2. Security headers
app.use(helmet());

// 3. CORS
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);

// 4. Body parsing
app.use(express.json({ limit: "10kb" }));

// 5. Cookie parsing
app.use(cookieParser(env.COOKIE_SECRET));

// 6. Passport (no sessions — JWT only)
app.use(passport.initialize());

// 7. Request logging
app.use(
  pinoHttp({
    logger,
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.token",
    ],
  }),
);

// 8. Request ID
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.set("X-Request-ID", req.requestId);
  next();
});

// 9. Global rate limiter
app.use(rateLimiter);

// 10. Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/providers", providerRoutes);
app.use("/api/v1/slots", slotRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/queue", queueRoutes);

// 11. Health check
app.get("/health", async (_req, res) => {
  const redis = getRedis();
  const mongoStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  let redisStatus = "disconnected";
  try {
    await redis.ping();
    redisStatus = "connected";
  } catch {
    /* empty */
  }

  const status =
    mongoStatus === "connected" && redisStatus === "connected"
      ? "ok"
      : "degraded";
  res.status(status === "ok" ? 200 : 503).json({
    status,
    mongo: mongoStatus,
    redis: redisStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 12. 404
app.use((_req, _res, next) =>
  next(new AppError("NOT_FOUND", 404, "Route not found")),
);

// 13. Global error handler
app.use(errorHandler);

export default app;
