import Redis from "ioredis";
import { logger } from "./logger";
import getEnv from "./env";

let _redis: Redis;

export function getRedis(): Redis {
  if (_redis) return _redis;

  const env = getEnv();
  _redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 15000,
    tls: env.REDIS_URL.startsWith("rediss://") ? {} : undefined, 
  });

  _redis.on("connect", () => logger.info("Redis connected"));
  _redis.on("ready", () => logger.info("Redis ready"));
  _redis.on("error", (err) => logger.error({ err }, "Redis error"));
  _redis.on("reconnecting", () => logger.warn("Redis reconnecting"));

  return _redis;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedis();

  if (redis.status === "ready") return;
  await new Promise<void>((resolve, reject) => {
    redis.once("ready", resolve);
    redis.once("error", reject);
  });
}

export default getRedis;
