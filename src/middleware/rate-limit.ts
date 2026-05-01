import { Request, Response, NextFunction } from "express";
import getRedis from "../config/redis";
import getEnv from "../config/env";
import { AppError } from "../types/errors";
import { RATE_LIMIT_SCRIPT } from "../utils/lua-scripts";
import { REDIS_KEYS } from "../services/cache.service";

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const env = getEnv();
    const redis = getRedis();

    const key = REDIS_KEYS.rateLimit(req.ip as string, req.path);
    const now = Date.now().toString();
    const windowStart = (Date.now() - env.RATE_LIMIT_WINDOW_MS).toString();
    const ttl = Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000).toString();

    const count = (await redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      key,
      now,
      windowStart,
      ttl,
    )) as number;

    if (count > env.RATE_LIMIT_MAX) {
      res.set("Retry-After", ttl);
      throw new AppError("RATE_LIMIT_EXCEEDED", 429, "Too many requests");
    }

    next();
  } catch (error) {
    next(error);
  }
}
