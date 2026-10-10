"use client";
import type { PostgrestResponse, PostgrestSingleResponse } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { DEMO_CLASSES, DEMO_STUDENTS, DemoStudent } from "@/lib/demo-data";
import { isDemoSchool } from "@/lib/demo-utils";
import { formatStudentNumber, highestStudentNumberSuffix } from "@/lib/import/students";
import { logger } from "@/lib/logger";
import { offlineDB } from "@/lib/offline";
import { getFeatureLimit, getPlanUsageWarning, normalizePlanType, PlanType } from "@/lib/payments/subscription-client";
import { supabase } from "@/lib/supabase";
import {
  getErrorMessage,
  normalizeStudentInput,
  normalizeStudentUpdateInput,
  validateStudentInput,
} from "@/lib/validation";
import type { Class, CreateStudentInput, Student } from "@/types";
import { getCachedData, getOrFetchCached, invalidateCachePattern } from "./queryCache";
import { getLocalDateString, getQuerySchoolId, isTimeoutResult, timeoutFallback, withTimeout } from "./utils";

export type StudentWithClass = Student & {
  classes?: { id: string; name: string; level: string } | Class;
  houses?: { id: string; name: string; color: string } | null;
  prefect_role?: string;
  student_council_role?: string;
  parent_phone2?: string;
  parent_email?: string;
  blood_type?: string;
  house_id?: string;
  previous_school?: string;
  district_origin?: string;
  sub_county?: string;
  parish?: string;
  village?: string;
  boarding_status?: string;
  games_house?: string;
  is_class_monitor?: boolean;
};

let studentPhotoColumnSupported: boolean | null = null;

const STUDENT_SELECT_FIELDS = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone, parent_phone2, parent_email, address,
  class_id, admission_date, ple_index_number, blood_type, religion, nationality,
  photo_url, status, transfer_from, transfer_to, transfer_reason,
  dropout_reason, dropout_date, repeating, last_attendance_date,
  consecutive_absent_days, created_at, house_id, previous_school, district_origin,
  sub_county, parish, village, boarding_status, games_house, is_class_monitor,
  prefect_role, student_council_role, opening_balance, nin,
  classes(id, name, level, stream)
`;

const STUDENT_SELECT_FIELDS_FALLBACK = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone, parent_phone2,
  class_id, admission_date, ple_index_number, status, photo_url,
  house_id, boarding_status, games_house,
  created_at, classes(id, name, level, stream)
`;

const STUDENT_SELECT_FIELDS_CORE = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone, parent_phone2,
  class_id, admission_date, ple_index_number, status, photo_url,
  house_id, boarding_status,
  created_at, classes(id, name, level, stream)
`;

const STUDENT_SELECT_FIELDS_MINIMAL = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone, parent_phone2,
  class_id, admission_date, ple_index_number, status, photo_url,
  created_at, classes(id, name, level, stream)
`;

/**
 * Slim roster row for pick-list screens (behaviour logs, discipline, ID cards,
 * comments, exams, …). Roughly half the columns of the full select: everything
 * a list needs to name, group and find a learner, nothing it doesn't.
 *
 * Includes every *required* `Student` prop so a slim row stays assignable to
 * `StudentWithClass` — screens that read anything heavier fail typecheck and
 * must stay on the full select.
 */
const STUDENT_SLIM_FIELDS = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone,
  class_id, admission_date, status, photo_url,
  created_at, classes(id, name, level, stream)
`;

export type SlimStudent = Pick<
  Student,
  | "id"
  | "school_id"
  | "student_number"
  | "first_name"
  | "last_name"
  | "gender"
  | "date_of_birth"
  | "parent_name"
  | "parent_phone"
  | "class_id"
  | "admission_date"
  | "status"
  | "photo_url"
  | "created_at"
> &
  Pick<StudentWithClass, "classes">;

export interface UseStudentsResult<TStudent> {
  students: TStudent[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  createStudent: (student: CreateStudentInput) => Promise<StudentWithClass>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<StudentWithClass>;
  deleteStudent: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export type StudentQueryOptions = {
  limit?: number;
  offset?: number;
  /** "full" (default) or "slim" — the pick-list row set above. */
  fields?: "full" | "slim";
};

function buildCoreStudentPayload(student: Record<string, unknown>) {
  return {
    school_id: student.school_id,
    student_number: student.student_number,
    first_name: student.first_name,
    last_name: student.last_name,
    gender: student.gender,
    date_of_birth: student.date_of_birth,
    parent_name: student.parent_name,
    parent_phone: student.parent_phone,
    parent_phone2: student.parent_phone2,
    parent_email: student.parent_email,
    address: student.address,
    class_id: student.class_id,
    ple_index_number: student.ple_index_number,
    photo_url: student.photo_url,
    blood_type: student.blood_type,
    boarding_status: student.boarding_status,
    house_id: student.house_id,
    previous_school: student.previous_school,
    district_origin: student.district_origin,
    sub_county: student.sub_county,
    parish: student.parish,
    village: student.village,
    games_house: student.games_house,
    is_class_monitor: student.is_class_monitor,
    prefect_role: student.prefect_role,
    student_council_role: student.student_council_role,
    status: student.status,
  };
}

const STUDENT_SELECT_FIELDS_FALLBACK_LEGACY = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone, parent_phone2,
  class_id, admission_date, ple_index_number, status,
  house_id, boarding_status,
  created_at, classes(id, name, level, stream)
`;

const STUDENT_SELECT_FIELDS_MINIMAL_LEGACY = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone, parent_phone2,
  class_id, admission_date, ple_index_number, status, created_at
`;

function isMissingStudentColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";

  return (
    (code === "42703" && message.includes(`students.${columnName}`)) ||
    ((code === "PGRST204" || code === "PGRST301") &&
      message.includes(`'${columnName}'`) &&
      message.toLowerCase().includes("students") &&
      message.toLowerCase().includes("schema cache"))
  );
}

/**
 * UNIQUE(school_id, student_number) was violated — the number handed out by the
 * sequence was already in the table. Distinguishable from every other insert
 * failure because it is the only one that a fresh allocation can fix.
 */
function isStudentNumberConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";

  return code === "23505" && message.includes("students_school_id_student_number");
}

function isAnyMissingStudentsColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";

  return (
    (code === "42703" && /column students\."?[a-zA-Z0-9_]+"? does not exist/.test(message)) ||
    ((code === "PGRST204" || code === "PGRST301") &&
      /could not find the '.+' column of 'students' in the schema cache/i.test(message))
  );
}

function buildStudentSelectAttempts(fetchLabel: "select" | "fetch") {
  const suffix = fetchLabel === "fetch" ? "fetch" : "select";

  const attempts = [] as Array<{ fields: string; label: string }>;

  if (studentPhotoColumnSupported !== false) {
    attempts.push(
      { fields: STUDENT_SELECT_FIELDS, label: `extended student ${suffix}` },
      {
        fields: STUDENT_SELECT_FIELDS_FALLBACK,
        label: `fallback student ${suffix}`,
      },
      { fields: STUDENT_SELECT_FIELDS_CORE, label: `core student ${suffix}` },
      {
        fields: STUDENT_SELECT_FIELDS_MINIMAL,
        label: `minimal student ${suffix}`,
      },
    );
  }

  attempts.push(
    {
      fields: STUDENT_SELECT_FIELDS_FALLBACK_LEGACY,
      label: `fallback student ${suffix} (legacy)`,
    },
    {
      fields: STUDENT_SELECT_FIELDS_MINIMAL_LEGACY,
      label: `minimal student ${suffix} (legacy)`,
    },
  );

  return attempts;
}

function buildPortableStudentPayload(student: Record<string, unknown>) {
  const payload = buildCoreStudentPayload(student) as Record<string, unknown>;

  if (studentPhotoColumnSupported === false) {
    delete payload.photo_url;
  }

  return payload;
}

function getStudentSelectTimeoutFallback(cachedData: StudentWithClass[] | null, previousData: StudentWithClass[]) {
  if (cachedData && cachedData.length > 0) {
    return cachedData;
  }

  if (previousData.length > 0) {
    return previousData;
  }

  return null;
}

async function fetchStudentsWithFallback(options: {
  schoolId: string;
  offset: number;
  limit: number;
  fields?: "full" | "slim";
}) {
  // Slim rows are all core columns, so one attempt is enough; if the schema
  // turns out older than expected, fall through to the full ladder below.
  if (options.fields === "slim") {
    const result = await supabase
      .from("students")
      .select(STUDENT_SLIM_FIELDS)
      .eq("school_id", options.schoolId)
      .order("created_at", { ascending: false })
      .range(options.offset, options.offset + options.limit - 1);

    if (!result.error) {
      return result.data as unknown as StudentWithClass[];
    }

    if (!isAnyMissingStudentsColumnError(result.error)) {
      throw result.error;
    }
  }

  const selectAttempts = buildStudentSelectAttempts("select");

  let lastError: unknown = null;

  for (const attempt of selectAttempts) {
    const result = await supabase
      .from("students")
      .select(attempt.fields)
      .eq("school_id", options.schoolId)
      .order("created_at", { ascending: false })
      .range(options.offset, options.offset + options.limit - 1);

    if (!result.error) {
      return result.data as unknown as StudentWithClass[];
    }

    if (isAnyMissingStudentsColumnError(result.error)) {
      studentPhotoColumnSupported = false;
      return fetchStudentsWithFallback(options);
    }

    lastError = result.error;
    logger.warn(`${attempt.label} failed, trying a smaller shape:`, result.error);
  }

  throw lastError;
}

async function fetchStudentByIdWithFallback(studentId: string, schoolId?: string) {
  const selectAttempts = buildStudentSelectAttempts("fetch");

  let lastError: unknown = null;

  for (const attempt of selectAttempts) {
    let query = supabase.from("students").select(attempt.fields).eq("id", studentId);

    if (schoolId) {
      query = query.eq("school_id", schoolId);
    }

    const result = await query.single();

    if (!result.error && result.data) {
      return result.data as unknown as StudentWithClass;
    }

    if (isAnyMissingStudentsColumnError(result.error)) {
      studentPhotoColumnSupported = false;
      return fetchStudentByIdWithFallback(studentId, schoolId);
    }

    lastError = result.error;
    logger.warn(`${attempt.label} failed, trying a smaller shape:`, result.error);
  }

  throw lastError;
}

interface StudentsCacheEntry {
  students: StudentWithClass[];
  count: number;
}

// A single PostgREST request is capped at 1000 rows by the project's
// max-rows setting, so "give me every student" has to page rather than ask for
// a big Range and hope.
const ROSTER_PAGE_SIZE = 1000;
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
export function useStudents(
  schoolId?: string,
  options?: StudentQueryOptions & { fields?: "full" },
): UseStudentsResult<StudentWithClass>;
export function useStudents(
  schoolId?: string,
  options?: StudentQueryOptions & { fields: "slim" },
): UseStudentsResult<SlimStudent>;
export function useStudents(schoolId?: string, options?: StudentQueryOptions): UseStudentsResult<StudentWithClass> {
  const limit = options?.limit || 100;
  const offset = options?.offset || 0;
  const slim = options?.fields === "slim";
  const cacheKey = `students:${schoolId}:${limit}:${offset}:${slim ? "slim" : "full"}`;
  const cachedData = getCachedData<StudentsCacheEntry>(cacheKey);
  const [students, setStudents] = useState<StudentWithClass[]>(cachedData?.students || []);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);
  // Seeded from the cache: a cache hit previously left the count at 0, so the
  // list could render as "0 students" until an unrelated refetch corrected it.
  const [totalCount, setTotalCount] = useState(cachedData?.count ?? 0);
  // Mirror of totalCount that we update ourselves.
  //
  // `totalCount` is React state, so inside a bulk import loop the value a
  // closure captures never advances: the plan-limit check kept reading the
  // roster size from before the import started, so a 500-learner file sailed
  // past a 100-student plan without ever raising. The ref moves with the loop.
  const studentCountRef = useRef(totalCount);
  const { isDemo, school } = useAuth();
  const hasInitialized = useRef(false);
  const lastResolvedStudentsRef = useRef<StudentWithClass[]>([]);
  const prevIsDemo = useRef(isDemo);

  useEffect(() => {
    if (prevIsDemo.current && !isDemo) {
      setStudents([]);
      setTotalCount(0);
      studentCountRef.current = 0;
      hasInitialized.current = false;
    }
    prevIsDemo.current = isDemo;
  }, [isDemo]);

  const assertUniqueStudentNumber = useCallback(
    async (studentNumber: string | undefined, studentId?: string) => {
      if (!studentNumber || !schoolId || isDemo || isDemoSchool(schoolId)) {
        return;
      }

      let query = supabase
        .from("students")
        .select("id")
        .eq("school_id", getQuerySchoolId(schoolId, isDemo))
        .eq("student_number", studentNumber)
        .limit(1);

      if (studentId) {
        query = query.neq("id", studentId);
      }

      const { data, error: duplicateError } = await query;
      if (duplicateError) throw duplicateError;
      if (data && data.length > 0) {
        throw new Error("Student number already exists for this school");
      }
    },
    [schoolId, isDemo],
  );

  // Every number this browser session has handed out, plus the highest number
  // already in the database for the current year.
  //
  // This used to start at `totalCount + 1` and probe the database once per
  // attempt. `totalCount` is React state, so it never advances inside a bulk
  // import loop: row k proposed the same base number as row 1, found it taken,
  // and stepped forward until it landed. That is N(N+1)/2 round trips for N
  // students -- 45,000 queries for a 300-learner roster. Seeding once from the
  // database and then counting locally is one query total.
  const assignedStudentNumbersRef = useRef<Set<string>>(new Set());
  const studentNumberSequenceRef = useRef(0);
  const studentNumberSeededRef = useRef(false);

  const seedStudentNumberSequence = useCallback(async () => {
    if (studentNumberSeededRef.current) return;
    if (!schoolId || isDemo || isDemoSchool(schoolId)) return;

    try {
      const prefix = `SM/${new Date().getFullYear()}/`;
      // The timeout fallback must LOOK like a failure, not like an empty
      // table. Returning [] here read as "this school has no students yet",
      // which left the sequence at 0 and handed out SM/<year>/0001 — a number
      // the table already had. That is how Add Student became a duplicate-key
      // error on a slow connection.
      const seedFallback = {
        data: null,
        error: {
          message: "Timed out reading existing student numbers",
          code: "TIMEOUT",
          details: "",
          hint: "",
          name: "TimeoutError",
        },
        count: null,
        status: 408,
        statusText: "Timeout",
        success: false,
      } as unknown as PostgrestResponse<{ student_number: string }>;

      const { data, error } = await withTimeout<PostgrestResponse<{ student_number: string }>>(
        supabase
          .from("students")
          .select("student_number")
          .eq("school_id", getQuerySchoolId(schoolId, isDemo))
          .like("student_number", `${prefix}%`)
          // Fixed-width, zero-padded suffixes sort correctly as text below 10000,
          // and the numeric pass below handles anything beyond that.
          .order("student_number", { ascending: false })
          .limit(50),
        5000,
        seedFallback,
      );
      // Deliberately not marked as seeded: this runs before the query, so one
      // slow request used to disable seeding for the entire session.
      if (error || !data) return;

      const highest = highestStudentNumberSuffix(
        data.map((row) => String(row.student_number)),
        prefix,
      );
      if (highest > studentNumberSequenceRef.current) {
        studentNumberSequenceRef.current = highest;
      }
      // Trust the read only when it actually saw numbered students. Zero rows
      // is ambiguous — a genuinely new school, or existing numbers the LIKE
      // pattern never matched — and trusting it would skip the uniqueness probe
      // and hand out SM/<year>/0001 on every add, forever.
      if (highest > 0) studentNumberSeededRef.current = true;
    } catch (error) {
      logger.warn("Could not seed the student number sequence:", error);
    }
  }, [schoolId, isDemo]);

  // A cheap existence probe, used only when the sequence above could not be
  // trusted. One query per created student, not one per counter step — the
  // difference between O(N) and the quadratic walk this code replaced.
  const isStudentNumberTaken = useCallback(
    async (studentNumber: string) => {
      if (!schoolId || isDemo || isDemoSchool(schoolId)) return false;

      try {
        const { data, error } = await withTimeout<PostgrestResponse<{ id: string }>>(
          supabase
            .from("students")
            .select("id")
            .eq("school_id", getQuerySchoolId(schoolId, isDemo))
            .eq("student_number", studentNumber)
            .limit(1),
          5000,
          // A timed-out probe is indistinguishable from "cannot check"; both
          // fall through to the constraint below.
          null as unknown as PostgrestResponse<{ id: string }>,
        );
        if (error) throw error;
        return Boolean(data && data.length > 0);
      } catch {
        // Cannot check — assume free. The insert's unique constraint is the
        // authority, and createStudent retries on that specific violation.
        return false;
      }
    },
    [schoolId, isDemo],
  );

  const generateUniqueStudentNumber = useCallback(async () => {
    const year = new Date().getFullYear();
    const prefix = `SM/${year}/`;

    await seedStudentNumberSequence();
    // Only true when the read above actually completed, so a school whose
    // sequence is still unproven pays for one probe rather than trusting 0.
    const sequenceIsTrusted = studentNumberSeededRef.current;

    for (let attempt = 0; attempt < 1000; attempt++) {
      studentNumberSequenceRef.current += 1;
      const candidate = formatStudentNumber(year, studentNumberSequenceRef.current);
      // Only the in-memory set is checked: these numbers came from the database
      // (or from a previous hand-out), so re-asking for each one would repeat
      // exactly the query this replaces.
      if (assignedStudentNumbersRef.current.has(candidate)) continue;
      if (!sequenceIsTrusted && (await isStudentNumberTaken(candidate))) continue;
      assignedStudentNumbersRef.current.add(candidate);
      return candidate;
    }

    return `${prefix}${Date.now().toString().slice(-6)}`;
  }, [seedStudentNumberSequence, isStudentNumberTaken]);

  const fetchStudents = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || isDemoSchool(schoolId)) {
      setStudents(DEMO_STUDENTS as unknown as StudentWithClass[]);
      setTotalCount(DEMO_STUDENTS.length);
      studentCountRef.current = DEMO_STUDENTS.length;
      setLoading(false);
      return;
    }

    if (!schoolId) {
      // Keep loading=true while the auth context is still hydrating the
      // school: flipping it to false here made every consumer render its
      // "0 students" state (and the hub opened its import card) for the
      // window between mount and school?.id arriving.
      return;
    }

    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    if (!querySchoolId) {
      setLoading(false);
      setError("School context is missing. Please reload and try again.");
      return;
    }

    try {
      setLoading(true);
      // Count and rows are fetched under one shared promise and cached
      // together. Previously every consumer that mounted in the same tick found
      // an empty cache and issued its own identical pair of round-trips, which
      // is expensive when each query crosses an ocean to reach the database.
      const { data: entry } = await getOrFetchCached<StudentsCacheEntry>(cacheKey, async () => {
        const timeoutFallback = getStudentSelectTimeoutFallback(null, lastResolvedStudentsRef.current);
        const [countResult, data] = await Promise.all([
          withTimeout(
            supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", querySchoolId),
            5000,
            null,
          ),
          withTimeout(
            fetchStudentsWithFallback({
              schoolId: querySchoolId,
              offset,
              limit,
              fields: slim ? "slim" : "full",
            }),
            8000,
            timeoutFallback,
          ),
        ]);

        const rows = (data as unknown as StudentWithClass[]) || [];
        const count = typeof countResult?.count === "number" && countResult.count > 0 ? countResult.count : rows.length;

        return { students: rows, count };
      });

      setStudents(entry.students);
      setTotalCount(entry.count);
      studentCountRef.current = entry.count;
      lastResolvedStudentsRef.current = entry.students;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load students"));
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo, limit, offset, cacheKey]);

  const createStudent = async (student: CreateStudentInput) => {
    const normalizedStudent = normalizeStudentInput(student);
    const validationErrors = validateStudentInput(normalizedStudent);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors[0]);
    }

    // Check plan limit for non-demo schools
    if (!isDemo && !isDemoSchool(schoolId) && school?.subscription_plan) {
      const plan = normalizePlanType(school.subscription_plan);
      const maxStudents = typeof plan === "string" ? getFeatureLimit(plan, "maxStudents") : 999999;
      if (maxStudents !== -1 && studentCountRef.current >= maxStudents) {
        throw new Error(
          `Student limit reached. Your plan allows ${maxStudents.toLocaleString()} students. Upgrade to add more.`,
        );
      }
    }

    if (isDemo || isDemoSchool(schoolId)) {
      const newId = `demo-student-${Date.now()}`;
      const newStudentData = {
        ...normalizedStudent,
        id: newId,
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        student_number: (normalizedStudent.student_number as string) || `STU-${newId.slice(0, 8)}`,
        status: "active" as const,
        admission_date: getLocalDateString(),
        created_at: new Date().toISOString(),
        classes: (DEMO_CLASSES.find((c) => c.id === normalizedStudent.class_id) || DEMO_CLASSES[0]) as unknown as Class,
      } as unknown as StudentWithClass;
      setStudents((prev) => [newStudentData, ...prev]);
      setTotalCount((prev) => prev + 1);
      studentCountRef.current += 1;
      invalidateCachePattern(`students:${schoolId}:`);
      return newStudentData;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    if (!querySchoolId) {
      throw new Error("School context is missing. Please reload and try again.");
    }

    try {
      // A number we just allocated from the seeded sequence does not need a
      // second database round trip to prove it is free: it came from the table
      // moments ago and the schema already enforces UNIQUE(school_id,
      // student_number). Only a number typed into the roster needs checking,
      // because that is the one that can genuinely collide.
      let studentNumber = (normalizedStudent.student_number as string) || undefined;
      const autoAllocated = !studentNumber;
      if (!studentNumber) {
        studentNumber = await generateUniqueStudentNumber();
      }

      const studentPayload = {
        ...normalizedStudent,
        school_id: querySchoolId,
        student_number: studentNumber,
      };

      if (!autoAllocated) {
        await withTimeout(assertUniqueStudentNumber(studentPayload.student_number as string), 5000, undefined);
      }

      let createdRow: { id: string } | null = null;

      // UNIQUE(school_id, student_number) is the only authority on whether a
      // number is free, and it can still reject one the sequence just handed
      // out — a seed read that failed, or a second tab inserting at the same
      // moment. A violation therefore means "allocate again and retry". This
      // used to fall through to the portable-payload retry, which carries the
      // identical student_number, so it failed the same way twice and Add
      // Student reported a duplicate-key error instead of adding anyone.
      const MAX_NUMBER_RETRIES = 5;
      const reallocateOrThrow = async (candidateError: unknown, attempt: number): Promise<boolean> => {
        if (!isStudentNumberConflict(candidateError)) return false;
        if (!autoAllocated) throw new Error("Student number already exists for this school");
        if (attempt >= MAX_NUMBER_RETRIES) throw candidateError;

        // The number we believed was free is taken, so the seed that produced
        // it is stale (or never ran). Drop the "seeded" mark so the next
        // allocation re-reads the real maximum and jumps past it, instead of
        // walking one counter step at a time into the same wall — the probe is
        // best-effort and times out on a slow connection.
        studentNumberSeededRef.current = false;

        const replacement = await generateUniqueStudentNumber();
        logger.warn(`Student number ${studentPayload.student_number} was already taken; retrying with ${replacement}`);
        studentPayload.student_number = replacement;
        return true;
      };

      for (let numberAttempt = 0; ; numberAttempt++) {
        const firstInsert = await withTimeout(
          supabase.from("students").insert(studentPayload).select("id").single(),
          10000,
          {
            data: null,
            error: { message: "Timeout", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
            count: null as number | null,
            status: 408,
            statusText: "Timeout",
            success: false,
          } as unknown as PostgrestSingleResponse<{ id: string }>,
        );

        if (await reallocateOrThrow(firstInsert.error, numberAttempt)) continue;

        if (firstInsert.error) {
          logger.warn("Student insert failed with extended payload, retrying core fields:", firstInsert.error);

          const retryInsert = await withTimeout(
            supabase
              .from("students")
              .insert(buildPortableStudentPayload(studentPayload as Record<string, unknown>))
              .select("id")
              .single(),
            10000,
            {
              data: null,
              error: { message: "Timeout", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
              count: null as number | null,
              status: 408,
              statusText: "Timeout",
              success: false,
            } as unknown as PostgrestSingleResponse<{ id: string }>,
          );

          if (await reallocateOrThrow(retryInsert.error, numberAttempt)) continue;

          if (isMissingStudentColumnError(retryInsert.error, "photo_url")) {
            studentPhotoColumnSupported = false;

            const legacyRetryInsert = await withTimeout(
              supabase
                .from("students")
                .insert(buildPortableStudentPayload(studentPayload as Record<string, unknown>))
                .select("id")
                .single(),
              10000,
              {
                data: null,
                error: { message: "Timeout", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
                count: null as number | null,
                status: 408,
                statusText: "Timeout",
                success: false,
              } as unknown as PostgrestSingleResponse<{ id: string }>,
            );

            if (legacyRetryInsert.error) throw legacyRetryInsert.error;
            createdRow = legacyRetryInsert.data;
          } else {
            if (retryInsert.error) throw retryInsert.error;
            createdRow = retryInsert.data;
          }
        } else {
          createdRow = firstInsert.data;
        }
        break;
      }

      if (!createdRow) {
        throw new Error("Failed to create student record");
      }

      let createdStudent: StudentWithClass | null = null;

      try {
        createdStudent = await withTimeout(fetchStudentByIdWithFallback(createdRow.id), 10000, null);
      } catch (fetchError: unknown) {
        logger.warn("Student was inserted but could not be re-fetched with current schema shape:", fetchError);

        createdStudent = {
          ...(studentPayload as StudentWithClass),
          id: createdRow.id,
          admission_date: getLocalDateString(),
          created_at: new Date().toISOString(),
          opening_balance:
            typeof (studentPayload as Record<string, unknown>).opening_balance === "number"
              ? (studentPayload as Record<string, unknown>).opening_balance
              : 0,
        } as StudentWithClass;
      }

      setStudents((prev) => [createdStudent as StudentWithClass, ...prev]);
      setTotalCount((prev) => prev + 1);
      studentCountRef.current += 1;
      invalidateCachePattern(`students:${schoolId}:`);

      // Auto-create parent portal account if student has a parent phone
      const parentPhoneRaw = (studentPayload as Record<string, unknown>).parent_phone;
      if (createdStudent && parentPhoneRaw) {
        fetch(`/api/students/create-parent-portal/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: createdRow.id,
            schoolId: querySchoolId,
          }),
        })
          .then((r) => r.json())
          .then((result) => {
            if (result.created) {
              logger.info(
                `Parent portal created for ${result.parentPhone} (credentials delivered: ${Boolean(result.credentialsDelivered)})`,
              );
            }
          })
          .catch((err) => logger.warn("[create-parent-portal] API call failed:", err));
      }

      return createdStudent as StudentWithClass;
    } catch (err: unknown) {
      throw new Error(getErrorMessage(err, "Failed to add student"));
    }
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    const normalizedUpdates = normalizeStudentUpdateInput(updates);
    const validationErrors = validateStudentInput(normalizedUpdates, {
      partial: true,
    });
    if (validationErrors.length > 0) {
      throw new Error(validationErrors[0]);
    }

    if (isDemo || isDemoSchool(schoolId)) {
      const existingStudent = students.find((s) => s.id === id);
      if (!existingStudent) {
        throw new Error("Student not found");
      }
      const updatedStudent = {
        ...existingStudent,
        ...normalizedUpdates,
      } as StudentWithClass;
      setStudents((prev) => prev.map((s) => (s.id === id ? updatedStudent : s)));
      return updatedStudent;
    }
    try {
      await assertUniqueStudentNumber(normalizedUpdates.student_number as string | undefined, id);
      const firstUpdate = await withTimeout(
        supabase.from("students").update(normalizedUpdates).eq("id", id).select(STUDENT_SELECT_FIELDS).single(),
        15000,
        {
          data: null,
          error: { message: "Student update timed out", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
          count: null as number | null,
          status: 408,
          statusText: "Timeout",
          success: false,
        } as unknown as PostgrestSingleResponse<unknown>,
      );

      let updatedStudent: StudentWithClass | null = null;

      if (firstUpdate.error) {
        logger.warn("Student update failed with extended payload, retrying core fields:", firstUpdate.error);

        const retryUpdate = await withTimeout(
          supabase
            .from("students")
            .update(buildPortableStudentPayload(normalizedUpdates as Record<string, unknown>))
            .eq("id", id)
            .select(
              studentPhotoColumnSupported === false
                ? STUDENT_SELECT_FIELDS_MINIMAL_LEGACY
                : STUDENT_SELECT_FIELDS_MINIMAL,
            )
            .single(),
          15000,
          {
            data: null,
            error: {
              message: "Student update retry timed out",
              code: "TIMEOUT",
              details: "",
              hint: "",
              name: "TimeoutError",
            },
            count: null as number | null,
            status: 408,
            statusText: "Timeout",
            success: false,
          } as unknown as PostgrestSingleResponse<unknown>,
        );

        if (isMissingStudentColumnError(retryUpdate.error, "photo_url")) {
          studentPhotoColumnSupported = false;

          const legacyRetryUpdate = await withTimeout(
            supabase
              .from("students")
              .update(buildPortableStudentPayload(normalizedUpdates as Record<string, unknown>))
              .eq("id", id)
              .select(STUDENT_SELECT_FIELDS_MINIMAL_LEGACY)
              .single(),
            15000,
            {
              data: null,
              error: {
                message: "Student update legacy retry timed out",
                code: "TIMEOUT",
                details: "",
                hint: "",
                name: "TimeoutError",
              },
              count: null as number | null,
              status: 408,
              statusText: "Timeout",
              success: false,
            } as unknown as PostgrestSingleResponse<unknown>,
          );

          if (legacyRetryUpdate.error) throw legacyRetryUpdate.error;
          updatedStudent = legacyRetryUpdate.data as unknown as StudentWithClass;
        } else {
          if (retryUpdate.error) throw retryUpdate.error;
          updatedStudent = retryUpdate.data as unknown as StudentWithClass;
        }
      } else {
        updatedStudent = firstUpdate.data as unknown as StudentWithClass;
      }

      setStudents((prev) => prev.map((s) => (s.id === id ? (updatedStudent as StudentWithClass) : s)));
      invalidateCachePattern(`students:${schoolId}:`);
      return updatedStudent as StudentWithClass;
    } catch (err: unknown) {
      throw new Error(getErrorMessage(err, "Failed to update student"));
    }
  };

  const deleteStudent = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setTotalCount((prev) => prev - 1);
      studentCountRef.current = Math.max(0, studentCountRef.current - 1);
      return;
    }
    try {
      const { error: deleteError } = await withTimeout(supabase.from("students").delete().eq("id", id), 15000, {
        data: null,
        error: { message: "Delete timed out", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
        count: null as number | null,
        status: 408,
        statusText: "Timeout",
        success: false,
      } as unknown as PostgrestSingleResponse<never>);
      if (deleteError) throw deleteError;
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setTotalCount((prev) => prev - 1);
      studentCountRef.current = Math.max(0, studentCountRef.current - 1);
      invalidateCachePattern(`students:${schoolId}:`);
    } catch (err: unknown) {
      throw new Error(getErrorMessage(err, "Failed to remove student"));
    }
  };

  // Seed instantly from the persistent IndexedDB cache so revisits reflect the
  // previous data while the network fetch revalidates in the background. We only
  // read here (never overwrite) — the shared cache is populated by the full
  // select hooks so a reference refresh can't degrade the stored records.
  useEffect(() => {
    if (isDemo || isDemoSchool(schoolId) || !schoolId) return;
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    if (!querySchoolId) return;
    let cancelled = false;
    offlineDB.getAllFromCache("students", { school_id: querySchoolId }).then((cached) => {
      if (cancelled || cached.length === 0) return;
      const sorted = [...(cached as unknown as StudentWithClass[])].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
      const slice = sorted.slice(0, limit);
      setStudents(slice);
      // Seed the count too: flipping loading to false while totalCount was
      // still 0 flashed "0 students enrolled" and force-opened the hub's
      // import card before the head-count query landed.
      setTotalCount((prev) => (prev === 0 ? slice.length : prev));
      lastResolvedStudentsRef.current = slice;
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolId, isDemo, limit]);

  useEffect(() => {
    fetchStudents();
    hasInitialized.current = true;
  }, [fetchStudents]);
  return {
    students,
    loading,
    error,
    totalCount,
    createStudent,
    updateStudent,
    deleteStudent,
    refetch: fetchStudents,
  };
}

export function useStudent(id: string) {
  const [student, setStudent] = useState<StudentWithClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDemo, school } = useAuth();

  const fetchStudent = useCallback(async () => {
    if (!id) {
      setStudent(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (isDemo) {
      const demoStudent = DEMO_STUDENTS.find((s) => s.id === id) || DEMO_STUDENTS[0];
      setStudent({
        ...demoStudent,
        classes: { id: "demo-class", name: "P.5", level: "P.5" },
      } as unknown as StudentWithClass);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const querySchoolId = getQuerySchoolId(school?.id, isDemo);
      const data = await fetchStudentByIdWithFallback(id, querySchoolId);
      setStudent(data as StudentWithClass);
    } catch (err: unknown) {
      setStudent(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id, isDemo, school?.id]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  return { student, loading, error, refetch: fetchStudent };
}

export function useClasses(schoolId?: string) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();
  const toast = useToast();
  const prevIsDemo = useRef(isDemo);

  useEffect(() => {
    if (prevIsDemo.current && !isDemo) {
      setClasses([]);
    }
    prevIsDemo.current = isDemo;
  }, [isDemo]);

  const fetchClasses = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || isDemoSchool(schoolId)) {
      setClasses(DEMO_CLASSES as unknown as Class[]);
      setLoading(false);
      return;
    }

    if (!schoolId) {
      setLoading(false);
      return;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    if (!querySchoolId) {
      setClasses([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await withTimeout(
        supabase
          .from("classes")
          .select("id, name, level, school_id, created_at, stream, academic_year, class_teacher_id")
          .eq("school_id", querySchoolId)
          .order("name"),
        15000,
        {
          data: null,
          error: { message: "Classes fetch timed out", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
          count: null as number | null,
          status: 408,
          statusText: "Timeout",
          success: false,
        } as unknown as PostgrestSingleResponse<unknown>,
      );

      if (error) throw error;

      const rows = (data as unknown as Class[]) || [];
      setClasses(rows);

      // Best-effort offline cache, in its own try. It used to run on the main
      // path, so a full or broken IndexedDB threw here, fell into the catch
      // below, blanked the rows just loaded and toasted "Failed to load
      // classes" — on every page, on every refresh.
      try {
        await offlineDB.cacheFromServer("classes", rows as unknown as Record<string, unknown>[]);
      } catch (cacheErr) {
        logger.warn("Could not cache classes for offline use:", cacheErr);
      }
    } catch (err) {
      logger.warn("Classes fetch error:", err);
      // Keep the last-known-good data instead of blanking the page when the
      // network is slow/unreliable (3G) — surface the cached copy instead.
      try {
        const cached = await offlineDB.getAllFromCache("classes", { school_id: querySchoolId });
        if (cached.length > 0) {
          setClasses(cached as unknown as Class[]);
          return;
        }
      } catch {
        // ignore cache read failure
      }
      setClasses([]);
      // The reason travels with the toast. Besides telling the user what broke,
      // the wording identifies the running build — older bundles showed a bare
      // "Failed to load classes" even when the error carried a full message.
      const reason = getErrorMessage(err, "");
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code || "") : "";
      toast?.error(
        reason
          ? `Failed to load classes: ${reason}${code ? ` [${code}]` : ""}`
          : `Failed to load classes (error carried no message: ${err === null ? "null" : typeof err})`,
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo, toast]);

  const createClass = async (newClass: Partial<Class>) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const demoClass: Class = {
        id: `demo-class-${Date.now()}`,
        name: newClass.name || "Unknown Class",
        level: newClass.level || "Primary",
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        max_students: newClass.max_students || 50,
        academic_year: newClass.academic_year || new Date().getFullYear().toString(),
        created_at: new Date().toISOString(),
      };
      setClasses((prev) => [...prev, demoClass]);
      return demoClass;
    }

    if (!newClass.name || !newClass.academic_year) {
      throw new Error("Class name and academic year are required");
    }

    const { data: existingClass, error: checkError } = await withTimeout(
      supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("name", newClass.name.trim())
        .eq("academic_year", newClass.academic_year)
        .limit(1),
      15000,
      {
        data: null,
        error: {
          message: "Class duplicate check timed out",
          code: "TIMEOUT",
          details: "",
          hint: "",
          name: "TimeoutError",
        },
        count: null as number | null,
        status: 408,
        statusText: "Timeout",
        success: false,
      } as any,
    );

    if (checkError) {
      throw new Error(`Failed to check existing class: ${checkError.message}`);
    }

    if (existingClass && existingClass.length > 0) {
      throw new Error("A class with this name already exists for the specified academic year");
    }

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("classes")
          .insert({ ...newClass, school_id: schoolId })
          .select()
          .single(),
        15000,
        {
          data: null,
          error: { message: "Class creation timed out", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
          count: null as number | null,
          status: 408,
          statusText: "Timeout",
          success: false,
        } as unknown as PostgrestSingleResponse<unknown>,
      );
      if (error) throw error;
      setClasses((prev) => [...prev, data as Class]);
      return data as Class;
    } catch (err) {
      throw err;
    }
  };

  const updateClass = async (id: string, updates: Partial<Class>) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      return { id, ...updates } as Class;
    }

    try {
      const { data, error } = await withTimeout(
        supabase.from("classes").update(updates).eq("id", id).select().single(),
        15000,
        {
          data: null,
          error: { message: "Class update timed out", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
          count: null as number | null,
          status: 408,
          statusText: "Timeout",
          success: false,
        } as unknown as PostgrestSingleResponse<unknown>,
      );
      if (error) throw error;
      setClasses((prev) => prev.map((c) => (c.id === id ? (data as Class) : c)));
      return data as Class;
    } catch (err) {
      throw err;
    }
  };

  // Seed instantly from the persistent IndexedDB cache so revisits don't wait
  // on the network; the fetch effect above then revalidates in the background.
  useEffect(() => {
    if (isDemo || isDemoSchool(schoolId) || !schoolId) return;
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    if (!querySchoolId) return;
    let cancelled = false;
    offlineDB.getAllFromCache("classes", { school_id: querySchoolId }).then((cached) => {
      if (cancelled || cached.length === 0) return;
      const sorted = [...(cached as unknown as Class[])].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setClasses(sorted);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolId, isDemo]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);
  return { classes, loading, createClass, updateClass, refetch: fetchClasses };
}
