import { supabase } from "./supabase";
import { isSupabaseLockAbortError, withSupabaseLockRetry } from "./supabase-lock";
import { logger } from "./logger";
import { getErrorMessage } from "./validation";

export type SchoolSettingsMap = Record<string, string>;

export function serializeSettingValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function parseSettingValue<T>(value: string | null | undefined, fallback: T): T {
  if (value === undefined || value === null || value === "") return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

// A school load was firing the same school_settings query up to three times:
// several components each asked for the keys they needed, and because the
// database is hosted in another region every duplicate is a full round-trip
// before the page can finish loading.
//
// Cache the whole (small) settings map per school for a short window, and share
// one in-flight promise so concurrent readers collapse into a single request.
const CACHE_TTL_MS = 30_000;

type CacheEntry = { at: number; map: SchoolSettingsMap };
const settingsCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<SchoolSettingsMap>>();

async function fetchAllSchoolSettings(schoolId: string): Promise<SchoolSettingsMap> {
  const cached = settingsCache.get(schoolId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.map;

  const existing = inflight.get(schoolId);
  if (existing) return existing;

  const request = (async () => {
    try {
      const { data, error } = await withSupabaseLockRetry(
        async () => await supabase.from("school_settings").select("key, value").eq("school_id", schoolId),
      );
      if (error) throw error;
      const map: SchoolSettingsMap = Object.fromEntries((data || []).map((row) => [row.key, row.value ?? ""] as const));
      settingsCache.set(schoolId, { at: Date.now(), map });
      return map;
    } finally {
      inflight.delete(schoolId);
    }
  })();

  inflight.set(schoolId, request);
  return request;
}

export function clearSchoolSettingsCache(schoolId?: string): void {
  if (schoolId) settingsCache.delete(schoolId);
  else settingsCache.clear();
}

export async function loadSchoolSettings(schoolId: string, keys?: string[]): Promise<SchoolSettingsMap> {
  if (!schoolId || !supabase) return {};

  try {
    const all = await fetchAllSchoolSettings(schoolId);
    if (!keys || keys.length === 0) return all;
    const filtered: SchoolSettingsMap = {};
    for (const key of keys) {
      if (key in all) filtered[key] = all[key];
    }
    return filtered;
  } catch (error) {
    if (isSupabaseLockAbortError(error)) {
      logger.warn("School settings temporarily unavailable during auth recovery");
      return {};
    }
    logger.warn("School settings fallback in use:", getErrorMessage(error));
    return {};
  }
}

export async function loadSchoolSetting<T>(schoolId: string, key: string, fallback: T): Promise<T> {
  const settings = await loadSchoolSettings(schoolId, [key]);
  return parseSettingValue(settings[key], fallback);
}

export async function saveSchoolSetting(schoolId: string, key: string, value: unknown): Promise<void> {
  if (!schoolId || !supabase) return;

  const { error } = await withSupabaseLockRetry(
    async () =>
      await supabase.from("school_settings").upsert(
        {
          school_id: schoolId,
          key,
          value: serializeSettingValue(value),
        },
        { onConflict: "school_id,key" },
      ),
  );

  if (error) {
    throw error;
  }

  // Keep the cached copy truthful so a just-saved value is visible immediately
  // instead of after the TTL expires.
  const cached = settingsCache.get(schoolId);
  if (cached) {
    cached.map = { ...cached.map, [key]: serializeSettingValue(value) };
    cached.at = Date.now();
  }
}
