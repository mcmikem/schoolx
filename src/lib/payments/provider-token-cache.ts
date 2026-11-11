import { createHash } from "crypto";

const ACCESS_TOKEN_SKEW_MS = 30_000;
const MAX_CACHED_TOKENS = 200;
const cachedTokens = new Map<string, { value: string; expiresAt: number }>();

export function providerTokenCacheKey(provider: string, parts: string[]): string {
  return createHash("sha256")
    .update([provider, ...parts].join("\u0000"))
    .digest("hex");
}

export function readCachedProviderToken(key: string): string | null {
  const cached = cachedTokens.get(key);
  if (!cached || cached.expiresAt <= Date.now() + ACCESS_TOKEN_SKEW_MS) {
    cachedTokens.delete(key);
    return null;
  }
  return cached.value;
}

export function cacheProviderToken(key: string, value: string, expiresInSeconds?: number): void {
  if (!value) return;
  if (cachedTokens.size >= MAX_CACHED_TOKENS) {
    const firstKey = cachedTokens.keys().next().value;
    if (firstKey) cachedTokens.delete(firstKey);
  }
  const ttl = Math.max(60, Number(expiresInSeconds) || 300);
  cachedTokens.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
}
