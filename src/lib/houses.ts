import { supabase } from "./supabase";
import { isSupabaseLockAbortError, withSupabaseLockRetry } from "./supabase-lock";
import { logger } from "./logger";
import { getErrorMessage } from "./validation";

export interface SchoolHouse {
  id: string;
  name: string;
  color: string | null;
  motto: string | null;
}

const CACHE_TTL_MS = 30_000;

type CacheEntry = { at: number; rows: SchoolHouse[] };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<SchoolHouse[]>>();

/**
 * Houses are read by the students list, by every student detail panel, and by
 * the settings screen, each with a different column selection. They were
 * fetched straight from those call sites, so one page could issue the same
 * query several times over. They also change rarely -- only when a house is
 * created or deleted in settings -- which makes them safe to cache briefly.
 */
export async function loadSchoolHouses(schoolId?: string | null): Promise<SchoolHouse[]> {
  if (!schoolId || !supabase) return [];

  const cached = cache.get(schoolId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rows;

  const existing = inflight.get(schoolId);
  if (existing) return existing;

  const request = (async () => {
    try {
      const { data, error } = await withSupabaseLockRetry(
        async () => await supabase.from("houses").select("*").eq("school_id", schoolId).order("name"),
      );
      if (error) throw error;
      const rows: SchoolHouse[] = (data || []).map((row) => {
        const record = row as unknown as Record<string, unknown>;
        return {
          id: String(record.id),
          name: String(record.name ?? ""),
          color: (record.color as string | null) ?? null,
          motto: (record.motto as string | null) ?? null,
        };
      });
      cache.set(schoolId, { at: Date.now(), rows });
      return rows;
    } finally {
      inflight.delete(schoolId);
    }
  })();

  inflight.set(schoolId, request);
  return request;
}

/** Call after creating, renaming or deleting a house so the next read is fresh. */
export function clearHousesCache(schoolId?: string | null): void {
  if (schoolId) cache.delete(schoolId);
  else cache.clear();
}

/**
 * Narrow wrapper for callers that need a single house id-to-name map, which was
 * previously re-derived from a full query inside every student panel.
 */
export async function loadHouseNames(schoolId?: string | null): Promise<Record<string, string>> {
  try {
    const rows = await loadSchoolHouses(schoolId);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.id] = row.name;
    return map;
  } catch (error) {
    if (isSupabaseLockAbortError(error)) {
      logger.warn("Houses temporarily unavailable during auth recovery");
      return {};
    }
    logger.warn("Houses fallback in use:", getErrorMessage(error));
    return {};
  }
}
