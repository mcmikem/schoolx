import { logger } from "@/lib/logger";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

// Shared utilities used by all domain hooks
export const DEMO_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

export function getQuerySchoolId(schoolId: string | undefined, isDemo: boolean): string | undefined {
  if (!schoolId) return undefined;
  if (isDemo && schoolId === "demo-school") return DEMO_SCHOOL_ID;
  return schoolId;
}

const inflightReads = new Map<string, Promise<unknown>>();

/**
 * Collapse simultaneous identical reads into a single request.
 *
 * Unlike the TTL cache in queryCache, nothing is retained after the response
 * lands, so this cannot serve stale data. It only removes duplicate work that
 * would otherwise have been in flight at the same moment -- which is what
 * happens when a screen's effects run more than once on mount, or when two
 * components need the same rows at load.
 *
 * Appropriate for data that must never be stale (attendance, balances). For
 * data that tolerates a short cache, prefer getOrFetchCached.
 */
export function dedupeRead<T>(key: string, run: () => PromiseLike<T>): Promise<T> {
  const existing = inflightReads.get(key);
  if (existing) return existing as Promise<T>;

  // Supabase query builders are thenables rather than Promises, so normalise
  // before attaching the cleanup handler.
  const request = Promise.resolve(run()).finally(() => {
    inflightReads.delete(key);
  });
  inflightReads.set(key, request);
  return request;
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
 *  Used as a sentinel when queries time out — callers destructure `{ data, error }`.
 *  IMPORTANT: a 408 result means UNKNOWN, not empty. Callers must check
 *  `isTimeoutResult(result)` and show stale/offline UI instead of zero balances. */
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

/** True when a withTimeout() call hit its deadline. Data is unknown — never
 *  render it as an empty list / zero balance. */
export function isTimeoutResult(result: unknown): boolean {
  return !!result && typeof result === "object" && (result as { status?: number }).status === 408;
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

/**
 * True when a write failed only because the named column does not exist.
 *
 * Two different layers report this two different ways, and handling just one
 * leaves the other fatal: Postgres answers `42703 undefined_column`, but when
 * PostgREST itself rejects an unknown column from its schema cache the query
 * never reaches Postgres and comes back as `PGRST204` ("Could not find the
 * 'subject' column of 'users' in the schema cache"). That second shape is what
 * made every staff edit fail in production while the 42703-only fallback sat
 * right next to it, never firing.
 */
export function isMissingTableColumnError(error: unknown, table: string, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const code = String((error as { code?: unknown }).code || "");
  const message = String((error as { message?: unknown }).message || "");
  if (code === "42703" && message.includes(`column ${table}."${column}"`)) return true;
  if (code === "42703" && message.includes(`column "${column}" does not exist`)) return true;
  if (
    (code === "PGRST204" || code === "PGRST301") &&
    message.toLowerCase().includes(`could not find the '${column}' column of '${table}'`)
  ) {
    return true;
  }
  return false;
}
