/**
 * Edge cache helper for Cloudflare Workers KV.
 *
 * Used to cache frequently-read, rarely-changing data (fee structures,
 * timetables, notices) at the edge so parents and teachers get instant
 * responses even when the origin (Supabase) is slow or briefly unavailable.
 *
 * Falls back to a no-op when KV isn't available (local dev, or when the
 * binding isn't configured). Never throws — caching is best-effort.
 */

export interface CacheOptions {
  /** Time-to-live in seconds. Defaults to 5 minutes. */
  ttl?: number;
}

const DEFAULT_TTL = 5 * 60;

// Lazily resolve the KV binding. In OpenNext on Cloudflare this comes from
// the Cloudflare context; in local dev it's undefined.
async function getKV(): Promise<{
  get: (k: string) => Promise<string | null>;
  put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void>;
  delete: (k: string) => Promise<void>;
} | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext({ async: true }) as {
      env?: {
        SKOOLMATE_CACHE?: {
          get: (k: string) => Promise<string | null>;
          put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void>;
          delete: (k: string) => Promise<void>;
        };
      };
    };
    return ctx?.env?.SKOOLMATE_CACHE ?? null;
  } catch {
    return null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const kv = await getKV();
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, opts?: CacheOptions): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: opts?.ttl ?? DEFAULT_TTL });
  } catch {
    // best-effort
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  try {
    await kv.delete(key);
  } catch {
    // best-effort
  }
}

/**
 * Cache-aside helper: returns cached value if present, otherwise calls
 * `fetcher`, caches the result, and returns it.
 */
export async function cacheAside<T>(key: string, fetcher: () => Promise<T>, opts?: CacheOptions): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await cacheSet(key, fresh, opts);
  return fresh;
}
