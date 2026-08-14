import { logger } from "@/lib/logger";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

// Shared utilities used by all domain hooks
export const DEMO_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

export function getQuerySchoolId(schoolId: string | undefined, isDemo: boolean): string | undefined {
  if (!schoolId) return undefined;
  if (isDemo && schoolId === "demo-school") return DEMO_SCHOOL_ID;
  return schoolId;
}

export async function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  const result = await Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)),
  ]).catch((e) => {
    if (e instanceof Error && e.message.startsWith("Query timed out")) {
      logger.warn("[hooks] Timeout — returning fallback");
      return fallback;
    }
    throw e;
  });
  return result as T;
}

/** Creates a type-compatible timeout fallback for Supabase withTimeout calls.
 *  The fallback simulates a PostgrestSingleResponse with no data and no error.
 *  Used as a sentinel when queries time out — callers destructure `{ data, error }`. */
export function timeoutFallback<T = unknown>(): PostgrestSingleResponse<T> {
  return {
    data: null,
    error: null,
    count: null,
    status: 408,
    statusText: "Timeout",
    success: false,
  } as unknown as PostgrestSingleResponse<T>;
}

/** Fallback for Supabase Storage operations (returns a different shape than .from().select()) */
export function storageTimeoutFallback<T = unknown>(): { data: T | null; error: unknown | null } {
  return { data: null, error: null };
}

/** Broadcasts that dashboard headline stats changed (attendance/fees saved),
 *  so `useDashboardStats` revalidates immediately instead of waiting for TTL.
 *  A per-school localStorage marker also makes a dashboard mounted *after* the
 *  change (e.g. bulk-marked attendance, then navigated to the dashboard) force
 *  a refresh even though no event listener was attached yet. */
export function notifyDashboardStatsChanged(schoolId?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("dashboard-stats:refresh"));
  if (schoolId) {
    try {
      localStorage.setItem(`dashboard-stats-dirty:${schoolId}`, String(Date.now()));
    } catch {
      // ignore storage failures
    }
  }
}

function dirtyMarkerKey(schoolId: string): string {
  return `dashboard-stats-dirty:${schoolId}`;
}

/** True when a save happened after the given cached timestamp for this school. */
export function isDashboardStatsDirty(schoolId: string, since: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const value = Number(localStorage.getItem(dirtyMarkerKey(schoolId)) || 0);
    return value > since;
  } catch {
    return false;
  }
}

export function clearDashboardStatsDirty(schoolId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(dirtyMarkerKey(schoolId));
  } catch {
    // ignore storage failures
  }
}

/** Local calendar date (YYYY-MM-DD). The attendance UI marks attendance by the
 *  device's local date, so the dashboard must aggregate using the same date —
 *  `toISOString()` converts to UTC and can shift a day on ±UTC networks. */
export function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
