import { supabase } from "./supabase";

const CACHE_DURATION = 3600; // 1 hour in seconds
const cache = new Map<string, { data: any; expiry: number }>();

async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && cached.expiry > now) {
    return cached.data as T;
  }

  const data = await fetcher();
  cache.set(key, { data, expiry: now + CACHE_DURATION * 1000 });
  return data;
}

export async function getCachedSubjects(schoolId: string) {
  return fetchWithCache(`subjects-${schoolId}`, () =>
    supabase
      .from("subjects")
      .select("*")
      .eq("school_id", schoolId)
      .then((res) => res.data || []),
  );
}

export async function getCachedClasses(schoolId: string, academicYear: string) {
  return fetchWithCache(`classes-${schoolId}-${academicYear}`, () =>
    supabase
      .from("classes")
      .select("*")
      .eq("school_id", schoolId)
      .eq("academic_year", academicYear)
      .then((res) => res.data || []),
  );
}

export async function getCachedFeeStructures(
  schoolId: string,
  term: number,
  academicYear: string,
) {
  return fetchWithCache(
    `fee-structure-${schoolId}-${term}-${academicYear}`,
    () =>
      supabase
        .from("fee_structure")
        .select("*")
        .eq("school_id", schoolId)
        .eq("term", term)
        .eq("academic_year", academicYear)
        .then((res) => res.data || []),
  );
}
