import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { DEMO_STUDENTS } from "@/lib/demo-data";
import { isDemoSchool } from "@/lib/demo-utils";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { getCachedData, getOrFetchCached } from "./queryCache";
import { getQuerySchoolId, isTimeoutResult, timeoutFallback, withTimeout } from "./utils";
import type { StudentWithClass } from "./students-helpers";

export interface StudentsCacheEntry {
  students: StudentWithClass[];
  count: number;
}

// A single PostgREST request is capped at 1000 rows by the project's
// max-rows setting, so "give me every student" has to page rather than ask for
// a big Range and hope.
export const ROSTER_PAGE_SIZE = 1000;
// Safety valve: a runaway count must not turn into an unbounded number of
// round trips on a 3G connection. No school is near this.
const ROSTER_MAX_ROWS = 10000;
const ROSTER_TIMEOUT_MS = 15000;

// Deliberately much smaller than STUDENT_SELECT_FIELDS: this array is fetched
// only to count and classify students, never to render a roster. Dropping
// address/religion/date_of_birth/photo keeps a 600-learner payload in the tens
// of kilobytes, which is what a 2GB phone on 3G can actually afford.
const ROSTER_SELECT_FIELDS = `
  id, school_id, first_name, last_name, gender,
  class_id, status, parent_name, parent_phone,
  created_at, classes(id, name, level, stream)
`;

/** Shared cache key for the full roster. Matches the `students:<id>:` prefix
 *  that every mutation invalidates, so adding or editing a student drops it. */
export function rosterCacheKey(schoolId: string): string {
  return `students:${schoolId}:all`;
}

/**
 * Every student in the school, paged until the count is satisfied.
 *
 * The dashboard and the inspection report count things that are true of the
 * whole roster -- students at risk of dropping out, who owes money, the
 * boy/girl split -- and they were being handed `useStudents`' first page. Past
 * 100 students those counts silently stop rising, so a 594-learner school was
 * reported as having at most 100 people in any of them.
 *
 * Throws on failure rather than returning []. A partial or empty roster reads
 * as "nobody is at risk" and "nobody owes money", which is the same lie as a
 * zero balance; the caller converts this into its stale-data path.
 */
export interface RosterPage<T> {
  rows: T[];
  /** How many rows exist in total, when the server says so. */
  total: number | null;
}

/**
 * Walk a paged dataset until the reported total is satisfied.
 *
 * Three invariants this exists to protect:
 *  - the offset advances by the number of rows actually received, so it stays
 *    correct when the server's per-request ceiling is below `pageSize`;
 *  - rows are keyed, so a row inserted mid-scan cannot be counted twice;
 *  - a short page is not treated as the end unless the total agrees (or is
 *    unknown), so a low max-rows setting silently truncating every response
 *    cannot be mistaken for "the school really only has that many".
 */
export async function collectRosterPages<T extends { id: string }>(
  fetchPage: (offset: number, limit: number) => Promise<RosterPage<T>>,
  options?: { pageSize?: number; maxRows?: number },
): Promise<{ rows: T[]; total: number | null }> {
  const pageSize = options?.pageSize ?? ROSTER_PAGE_SIZE;
  const maxRows = options?.maxRows ?? ROSTER_MAX_ROWS;
  const rows: T[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let total: number | null = null;

  while (offset < maxRows && (total === null || offset < total)) {
    const page = await fetchPage(offset, pageSize);
    if (total === null && page.total !== null) total = page.total;
    if (page.rows.length === 0) break;

    for (const item of page.rows) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      rows.push(item);
    }
    offset += page.rows.length;
  }

  return { rows, total };
}

/**
 * Every student in the school, paged until the count is satisfied.
 *
 * The dashboard and the inspection report count things that are true of the
 * whole roster -- students at risk of dropping out, who owes money, the
 * boy/girl split -- and they were being handed `useStudents`' first page. Past
 * 100 students those counts silently stop rising, so a 594-learner school was
 * reported as having at most 100 people in any of them.
 *
 * Throws on failure rather than returning []. A partial or empty roster reads
 * as "nobody is at risk" and "nobody owes money", which is the same lie as a
 * zero balance; the caller converts this into its stale-data path.
 */
export async function fetchAllStudents(schoolId: string): Promise<StudentWithClass[]> {
  const { rows, total } = await collectRosterPages(async (offset, limit) => {
    // Count on the data request rather than with a separate head query: a
    // school under one page (the normal case) then costs exactly one round
    // trip, which is the difference between a dashboard that arrives on 3G and
    // one that makes you wait for it.
    const page = await withTimeout(
      supabase
        .from("students")
        .select(ROSTER_SELECT_FIELDS, { count: "exact" })
        .eq("school_id", schoolId)
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1),
      ROSTER_TIMEOUT_MS,
      timeoutFallback(),
    );
    if (isTimeoutResult(page)) throw new Error("Timed out reading the student roster");
    if (page.error) throw page.error;

    return {
      rows: (page.data ?? []) as unknown as StudentWithClass[],
      total: page.count,
    };
  });

  if (total !== null && total > ROSTER_MAX_ROWS) {
    logger.warn(`[students] roster of ${total} exceeds ${ROSTER_MAX_ROWS}; counts will be partial`);
  }

  return rows;
}

/**
 * The full roster for screens that aggregate over it.
 *
 * `ready` is false until a read has actually succeeded. Callers must treat a
 * not-ready roster as UNKNOWN (pass null to useDashboardExtraData) rather than
 * as an empty school -- an empty array renders "0 students at risk" and "0
 * overdue" over a school that simply could not be reached.
 */
export function useAllStudents(schoolId?: string) {
  const { isDemo } = useAuth();
  const demoMode = isDemo || isDemoSchool(schoolId);
  const querySchoolId = demoMode ? undefined : getQuerySchoolId(schoolId, isDemo);
  const cacheKey = querySchoolId ? rosterCacheKey(querySchoolId) : "";

  const [students, setStudents] = useState<StudentWithClass[]>(() =>
    demoMode ? (DEMO_STUDENTS as unknown as StudentWithClass[]) : [],
  );
  const [ready, setReady] = useState(demoMode);

  useEffect(() => {
    if (demoMode) {
      setStudents(DEMO_STUDENTS as unknown as StudentWithClass[]);
      setReady(true);
      return;
    }
    if (!querySchoolId || !cacheKey) {
      setStudents([]);
      setReady(false);
      return;
    }

    let cancelled = false;
    const cached = getCachedData<StudentWithClass[]>(cacheKey);
    if (cached) {
      setStudents(cached);
      setReady(true);
    }

    getOrFetchCached(cacheKey, () => fetchAllStudents(querySchoolId))
      .then(({ data }) => {
        if (cancelled) return;
        setStudents(data);
        setReady(true);
      })
      .catch((err) => {
        // Keep whatever we already have (cache or last good read) and stay
        // not-ready only if we never had anything. Never report an empty school.
        if (!cancelled && !cached) setReady(false);
        logger.error("Failed to load the full student roster:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, demoMode, querySchoolId]);

  return { students, ready };
}

/**
 * The canonical "how many students" number for a school: one uncapped head
 * count over every student on the roster, all statuses.
 *
 * Use this for headline totals. `students.length` is only ever as big as the
 * page that was fetched, so two screens fetching different pages of the same
 * school disagree — which is exactly what sent users looking for "deleted"
 * accounts that were never deleted.
 */
export function useStudentTotal(schoolId?: string) {
  const { isDemo } = useAuth();
  const demoMode = isDemo || isDemoSchool(schoolId);
  const querySchoolId = demoMode ? undefined : getQuerySchoolId(schoolId, isDemo);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    if (demoMode) {
      setTotal(DEMO_STUDENTS.length);
      return;
    }
    if (!querySchoolId) {
      setTotal(null);
      return;
    }

    let cancelled = false;
    withTimeout(
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", querySchoolId)
        .then((r) => {
          if (r.error) throw r.error;
          return r.count;
        }),
      8000,
      null,
    )
      .then((count) => {
        if (!cancelled) setTotal(typeof count === "number" ? count : null);
      })
      .catch((err) => {
        logger.error("Failed to count students:", err);
        if (!cancelled) setTotal(null);
      });

    return () => {
      cancelled = true;
    };
  }, [querySchoolId, demoMode]);

  return total;
}

/**
 * Students for a screen.
 *
 * The default `limit` of 100 is a *first page*, not a roster: it exists so a
 * list renders fast. Any screen that counts, exports, prints or promotes the
 * whole school must pass `{ limit: 1000 }` (the most a single PostgREST
 * request will answer with — see `ROSTER_PAGE_SIZE`) or page with
 * `fetchAllStudents()`. Counting `students.length` off the default is how a
 * 320-learner school came to be shown as 100 on some screens and 320 on others.
 */
