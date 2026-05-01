import getRedis from "../config/redis";

export const REDIS_KEYS = {
  slotAvailability: (slotId: string) => `slot:${slotId}:available`,
  providerSlots: (providerId: string, date: string) => `provider:slots:${providerId}:${date}`,
  queue: (slotId: string) => `queue:${slotId}`,
  queueLength: (slotId: string) => `queue:length:${slotId}`,
  refreshToken: (userId: string, jti: string) => `rt:${userId}:${jti}`,
  otpEmailVerify: (email: string) => `verify:${email}`,
  otpPasswordReset: (email: string) => `reset:${email}`,
  rateLimit: (ip: string, path: string) => `rl:${ip}:${path}`,
  idempotency: (userId: string, key: string) => `idem:${userId}:${key}`,
  allProviderSlots: () => `provider:slots:*`,    
  providerSlotsPattern: (providerId: string) => `provider:slots:${providerId}:*`, 
  allRefreshTokens: (userId: string) => `rt:${userId}:*`,
};

export const CACHE_KEYS = REDIS_KEYS;

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    const redis = getRedis();
    if (keys.length > 0) await redis.del(...keys);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const redis = getRedis();
    let cursor = "0";
    const keysToDelete: string[] = [];
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== "0");
    if (keysToDelete.length > 0) await redis.del(...keysToDelete);
  }
}

export const cacheService = new CacheService();
