/** Short-lived cache so spectator live polls skip heavy first-timer / birthday scans. */

const FIRST_TIMER_TTL_MS = 5 * 60_000;
const BIRTHDAY_COUNT_TTL_MS = 5 * 60_000;

type CacheEntry<T> = { value: T; expiresAt: number };

const firstTimerCache = new Map<string, CacheEntry<Set<string>>>();
const birthdayCountCache = new Map<string, CacheEntry<number>>();

function readCache<T>(store: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = store.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache<T>(store: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function firstTimerCacheKey(ownerId: string, gameId: string) {
  return `${ownerId}:${gameId}`;
}

export function getCachedFirstTimerIdentityKeys(key: string) {
  return readCache(firstTimerCache, key);
}

export function setCachedFirstTimerIdentityKeys(key: string, value: Set<string>) {
  writeCache(firstTimerCache, key, value, FIRST_TIMER_TTL_MS);
}

export function getCachedBirthdayThisMonthCount(gameId: string) {
  return readCache(birthdayCountCache, gameId);
}

export function setCachedBirthdayThisMonthCount(gameId: string, count: number) {
  writeCache(birthdayCountCache, gameId, count, BIRTHDAY_COUNT_TTL_MS);
}
