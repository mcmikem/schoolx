type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const CACHE = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 5 * 60 * 1000;

// Requests currently in flight, keyed the same way as the cache. Without this,
// every component that mounts in the same tick misses the cache together and
// fires its own identical request -- which on a slow connection means the same
// query is paid for several times over before the first response lands.
const INFLIGHT = new Map<string, Promise<unknown>>();

const LISTENERS = new Map<string, Set<() => void>>();

function getCacheKey(key: string): string {
  return `swr:${key}`;
}

export function getCachedData<T>(key: string): T | null {
  const entry = CACHE.get(getCacheKey(key)) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    CACHE.delete(getCacheKey(key));
    return null;
  }
  return entry.data;
}

export function setCachedData<T>(key: string, data: T): void {
  CACHE.set(getCacheKey(key), { data, timestamp: Date.now() });
  LISTENERS.get(key)?.forEach((fn) => fn());
}

export function invalidateCache(key: string): void {
  CACHE.delete(getCacheKey(key));
  LISTENERS.get(key)?.forEach((fn) => fn());
}

/**
 * Read-through helper: serve fresh cached data if present, otherwise run the
 * fetcher once and share that single promise with every concurrent caller.
 *
 * A rejected fetch is not cached and not left behind in the in-flight map, so a
 * transient network failure does not poison the key for the next attempt.
 */
export async function getOrFetchCached<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  const cached = getCachedData<T>(key);
  if (cached !== null) return { data: cached, fromCache: true };

  const existing = INFLIGHT.get(getCacheKey(key));
  if (existing) return { data: (await existing) as T, fromCache: false };

  const request = fetcher()
    .then((data) => {
      setCachedData(key, data);
      return data;
    })
    .finally(() => {
      INFLIGHT.delete(getCacheKey(key));
    });

  INFLIGHT.set(getCacheKey(key), request);
  return { data: await request, fromCache: false };
}

/**
 * Always run the fetcher, but share one in-flight promise per key and publish
 * the result to the cache.
 *
 * Unlike getOrFetchCached this never answers from cache, so a caller that must
 * revalidate (a screen whose own actions just changed the rows) still hits the
 * database — it just stops paying for the same call once per component that
 * mounted in the same tick. Concurrent callers therefore see one round trip
 * instead of N, and everyone else reading the key gets a warm cache.
 */
export async function revalidateShared<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cacheKey = getCacheKey(key);
  const existing = INFLIGHT.get(cacheKey);
  if (existing) return (await existing) as T;

  const request = fetcher()
    .then((data) => {
      setCachedData(key, data);
      return data;
    })
    .finally(() => {
      INFLIGHT.delete(cacheKey);
    });

  INFLIGHT.set(cacheKey, request);
  return await request;
}

export function invalidateCachePattern(pattern: string): void {
  const prefix = getCacheKey(pattern);
  CACHE.forEach((_value, key) => {
    if (key.startsWith(prefix)) {
      CACHE.delete(key);
      // Strip the internal prefix: listeners are registered under the raw key,
      // so looking them up with the storage key silently notified nobody.
      const rawKey = key.slice("swr:".length);
      LISTENERS.get(rawKey)?.forEach((fn) => fn());
    }
  });
}

export function subscribeToCache(key: string, callback: () => void): () => void {
  if (!LISTENERS.has(key)) {
    LISTENERS.set(key, new Set());
  }
  LISTENERS.get(key)!.add(callback);
  return () => {
    LISTENERS.get(key)?.delete(callback);
    if (LISTENERS.get(key)?.size === 0) {
      LISTENERS.delete(key);
    }
  };
}

export function clearAllCache(): void {
  CACHE.clear();
  LISTENERS.forEach((callbacks) => {
    callbacks.forEach((fn) => fn());
  });
  LISTENERS.clear();
}
