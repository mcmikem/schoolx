import { logger } from "./logger";

const LOG_PREFIX = "[Storage]";

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      logger.warn(LOG_PREFIX, "Storage quota exceeded reading", key);
      return null;
    }
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      logger.warn(LOG_PREFIX, "Storage quota exceeded writing", key, "- attempting cleanup");
      attemptStorageCleanup();
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

function attemptStorageCleanup(): void {
  const keysToPreserve = new Set([
    "skoolmate_offline_user_v1",
    "skoolmate_offline_school_v1",
    "remember_session",
    "skoolmate-theme",
  ]);

  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith("draft_") || k.startsWith("query_cache_") || k.startsWith("skoolmate_recent_pages"));
    for (const key of cacheKeys) {
      if (!keysToPreserve.has(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Give up on cleanup
  }
}