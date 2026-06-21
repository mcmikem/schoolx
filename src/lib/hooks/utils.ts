import { logger } from "@/lib/logger";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

// Shared utilities used by all domain hooks
export const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001'

export function getQuerySchoolId(schoolId: string | undefined, isDemo: boolean): string | undefined {
  if (!schoolId) return undefined
  if (isDemo && schoolId === 'demo-school') return DEMO_SCHOOL_ID
  return schoolId
}

export async function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  const result = await Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
    )
  ]).catch((e) => {
    if (e instanceof Error && e.message.startsWith('Query timed out')) {
      logger.warn('[hooks] Timeout — returning fallback')
      return fallback
    }
    throw e
  })
  return result as T
}

/** Creates a type-compatible timeout fallback for Supabase withTimeout calls.
 *  The fallback simulates a PostgrestSingleResponse with no data and no error.
 *  Used as a sentinel when queries time out — callers destructure `{ data, error }`. */
export function timeoutFallback<T = unknown>(): PostgrestSingleResponse<T> {
  return { data: null, error: null, count: null, status: 408, statusText: "Timeout", success: false } as unknown as PostgrestSingleResponse<T>;
}

/** Fallback for Supabase Storage operations (returns a different shape than .from().select()) */
export function storageTimeoutFallback<T = unknown>(): { data: T | null; error: unknown | null } {
  return { data: null, error: null };
}
