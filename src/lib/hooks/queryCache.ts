type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const CACHE = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 5 * 60 * 1000;

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

export function invalidateCachePattern(pattern: string): void {
  const prefix = getCacheKey(pattern);
  CACHE.forEach((_value, key) => {
    if (key.startsWith(prefix)) {
      CACHE.delete(key);
      LISTENERS.get(key)?.forEach((fn) => fn());
    }
  });
}

export function subscribeToCache(
  key: string,
  callback: () => void,
): () => void {
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
