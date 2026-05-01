import { v4 as uuidv4 } from "uuid";
import getRedis from "../config/redis";
import { RELEASE_LOCK_SCRIPT } from "../utils/lua-scripts";
import { AppError } from "../types/errors";

export class LockService {
  async acquire(key: string, ttl: number): Promise<string | null> {
    const redis = getRedis();
    const token = uuidv4();
    const result = await redis.set(key, token, "PX", ttl, "NX");
    return result === "OK" ? token : null;
  }

  async release(key: string, token: string): Promise<boolean> {
    const redis = getRedis();
    const result = await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
    return result === 1;
  }

  async withLock<T>(
    key: string,
    ttl: number,
    fn: () => Promise<T>,
    retries = 3,
    backoff = 50,
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const token = await this.acquire(key, ttl);
      if (token) {
        try {
          return await fn();
        } finally {
          await this.release(key, token);
        }
      }
      await new Promise((resolve) =>
        setTimeout(resolve, backoff * Math.pow(2, attempt)),
      );
    }
    throw new AppError(
      "LOCK_UNAVAILABLE",
      503,
      "Could not acquire lock after retries",
    );
  }
}

export const lockService = new LockService();
