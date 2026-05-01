import { cacheService, CACHE_KEYS } from "../../services/cache.service";
import getEnv from "../../config/env";

export async function getCachedSlots<T>(
  providerId: string,
  date: string,
): Promise<T | null> {
  const key = CACHE_KEYS.providerSlots(providerId, date);
  return cacheService.get<T>(key);
}

export async function setCachedSlots<T>(
  providerId: string,
  date: string,
  data: T,
): Promise<void> {
  const env = getEnv();
  const key = CACHE_KEYS.providerSlots(providerId, date);
  await cacheService.set(key, data, env.CACHE_TTL_SECONDS);
}

export async function invalidateProviderSlotsCache(
  providerId: string,
): Promise<void> {
  await cacheService.invalidatePattern(
    CACHE_KEYS.providerSlotsPattern(providerId),
  );
}

export async function getCachedSlotAvailability(
  slotId: string,
): Promise<string | null> {
  const key = CACHE_KEYS.slotAvailability(slotId);
  return cacheService.get<string>(key);
}

export async function setCachedSlotAvailability(
  slotId: string,
  data: unknown,
): Promise<void> {
  const env = getEnv();
  const key = CACHE_KEYS.slotAvailability(slotId);
  await cacheService.set(key, data, env.CACHE_TTL_SECONDS);
}

export async function invalidateSlotAvailabilityCache(
  slotId: string,
): Promise<void> {
  const key = CACHE_KEYS.slotAvailability(slotId);
  await cacheService.del(key);
}
