/**
 * How much room this phone has left for the offline copy.
 *
 * The browser reports the origin's quota, not the device's free disk, but the
 * gap between them is the part this app can still write. When it closes, the
 * browser evicts IndexedDB and Cache Storage first -- exactly the roster,
 * marks and queued payments a rural school depends on -- so the warning has to
 * arrive before a write fails, not after.
 */

export type StorageLevel = "ok" | "low" | "critical" | "unknown";

export interface StorageHealthInput {
  usage?: number | null;
  quota?: number | null;
  persisted?: boolean | null;
  supported?: boolean;
}

export interface StorageHealth {
  supported: boolean;
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
  free: number | null;
  usedPercent: number | null;
  level: StorageLevel;
}

const MB = 1024 * 1024;

/** Below this the next photo or page download can fail outright. */
export const CRITICAL_FREE_BYTES = 10 * MB;
/** Below this a few days of offline marks and photos can exhaust the quota. */
export const LOW_FREE_BYTES = 50 * MB;
/** Quota pressure matters even when the absolute free space looks generous. */
export const LOW_USED_PERCENT = 80;
export const CRITICAL_USED_PERCENT = 95;

export function assessStorageHealth(input: StorageHealthInput): StorageHealth {
  const supported = input.supported !== false;
  const persisted = typeof input.persisted === "boolean" ? input.persisted : null;

  if (!supported) {
    return {
      supported: false,
      persisted,
      usage: null,
      quota: null,
      free: null,
      usedPercent: null,
      level: "unknown",
    };
  }

  const usage = typeof input.usage === "number" && Number.isFinite(input.usage) ? Math.max(0, input.usage) : null;
  const quota = typeof input.quota === "number" && Number.isFinite(input.quota) ? Math.max(0, input.quota) : null;

  if (usage === null || quota === null || quota <= 0) {
    return { supported, persisted, usage, quota, free: null, usedPercent: null, level: "unknown" };
  }

  const free = Math.max(0, quota - usage);
  const usedPercent = Math.min(100, Math.round((usage / quota) * 1000) / 10);

  let level: StorageLevel = "ok";
  if (free < CRITICAL_FREE_BYTES || usedPercent >= CRITICAL_USED_PERCENT) {
    level = "critical";
  } else if (free < LOW_FREE_BYTES || usedPercent >= LOW_USED_PERCENT) {
    level = "low";
  }

  return { supported, persisted, usage, quota, free, usedPercent, level };
}

/** Compact, phone-sized units: "842 KB", "12.4 MB", "2.1 GB". */
export function formatStorageSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
