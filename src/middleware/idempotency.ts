import { Request, Response, NextFunction, RequestHandler } from "express";
import getRedis from "../config/redis";
import getEnv from "../config/env";
import { REDIS_KEYS } from "../services/cache.service";

export function idempotency(): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (!idempotencyKey) {
      return next();
    }

    const redis = getRedis();
    const cacheKey = REDIS_KEYS.idempotency(req.user.userId, idempotencyKey);

    const cached = await redis.get(cacheKey);
    if (cached) {
      res.set("X-Idempotent-Replay", "true").json(JSON.parse(cached));
      return;
    }

    res.locals.idempotencyKey = cacheKey;
    next();
  };
}

export async function storeIdempotentResponse(
  cacheKey: string,
  data: unknown,
): Promise<void> {
  const redis = getRedis();
  const env = getEnv();
  await redis.set(
    cacheKey,
    JSON.stringify(data),
    "EX",
    env.IDEMPOTENCY_TTL_SECONDS,
  );
}
