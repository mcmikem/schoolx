"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTimeoutResult, timeoutFallback, withTimeout } from "@/lib/hooks/utils";
import type { Attendance, FeePayment, FeeStructure, Grade, Student } from "@/types";
import { DEMO_STUDENTS } from "./demo-data";
import { isDemoSchool } from "./demo-utils";
import { logger } from "./logger";
import { offlineDB, useOnlineStatus } from "./offline";
import { supabase } from "./supabase";

interface OfflineHookOptions {
  skipCache?: boolean;
}

const OFFLINE_READ_TIMEOUT_MS = 12000;

/**
 * Say what a failed read means, in the words of the person waiting for it.
 *
 * "Loading students took too long" and "Offline database open timed out" are
 * both true and both useless to a headteacher who is standing in a classroom
 * with thirty children. What they need to know is whether their work is safe
 * and whether to try again.
 */
function describeReadFailure(what: string, error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (/took too long|timed out|timeout/i.test(msg)) {
    return `This is taking longer than usual. Check your connection and try again.`;
  }
  if (/offline database/i.test(msg)) {
    return `Saved offline data is unavailable on this device. Reconnect and try again.`;
  }
  return `Could not load ${what}. Check your connection and try again.`;
}

export function useOfflineData<T>(
  table: string,
  fetcher: () => Promise<T[]>,
  cacheKey: string,
  filters?: Record<string, unknown>,
  options?: OfflineHookOptions,
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const isOnline = useOnlineStatus();
  const skipCache = options?.skipCache ?? false;
  const serializedFilters = JSON.stringify(filters ?? {});
  const stableFilters = useMemo(
    () => (serializedFilters ? (JSON.parse(serializedFilters) as Record<string, unknown>) : {}),
    [serializedFilters],
  );
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // The cache and the server are read at the SAME time.
    //
    // They used to run one after the other -- cache first, network second --
    // which put the whole cache round trip in front of every screen. On a
    // phone whose IndexedDB is slow to open, that was seconds of nothing
    // before the real data even started moving, and if the database could not
    // open at all the screen filled with zeros until the user refreshed.
    // Now the server read starts immediately, the cache still paints first
    // when it gets there first, and the user waits for the slower of the two
    // rather than the sum of them.
    let cacheError: unknown = null;
    let networkError: unknown = null;

    const cachePromise = offlineDB.getAllFromCache(cacheKey, stableFilters).catch((e: unknown) => {
      cacheError = e;
      logger.error(`Error reading ${table} cache:`, e);
      return null;
    });

    const networkPromise =
      isOnline && !skipCache
        ? (async () => {
            try {
              const result = await withTimeout(fetcherRef.current(), OFFLINE_READ_TIMEOUT_MS, null as unknown as T[]);
              if (result === null) throw new Error(`Loading ${table} took too long`);
              return result;
            } catch (e: unknown) {
              networkError = e;
              const msg = e instanceof Error ? e.message : "Unknown error";
              logger.error(`Error refreshing ${table} from server:`, msg);
              return null;
            }
          })()
        : null;

    const cached = await cachePromise;
    if (cached && cached.length > 0) {
      setData(cached as T[]);
      setIsFromCache(true);
      setLoading(false);
    }

    const fresh = networkPromise ? await networkPromise : null;
    if (fresh) {
      setData(fresh);
      setIsFromCache(false);
      await offlineDB.cacheFromServer(cacheKey, fresh as Record<string, unknown>[]);
      setLoading(false);
      return;
    }

    // Nothing came back. If the cache had something, it is already on screen
    // and the user is not blocked -- so only complain when there is nothing
    // to look at.
    if (!cached || cached.length === 0) {
      setError(describeReadFailure(table, networkError ?? cacheError));
    }
    setLoading(false);
  }, [isOnline, table, cacheKey, skipCache, stableFilters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, isFromCache, refetch: fetchData };
}

export function useOfflineAcademicTerms(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "academic_terms",
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("academic_terms")
        .select("*")
        .eq("school_id", schoolId)
        .order("academic_year", { ascending: false })
        .order("term_number");
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "academic_terms",
    schoolId ? { school_id: schoolId } : undefined,
    options,
  );
}

export function useOfflineStudents(schoolId?: string, options?: OfflineHookOptions) {
  const { data, loading, error, isFromCache, refetch } = useOfflineData<Student>(
    "students",
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("students")
        .select("*, classes (id, name, level)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as Student[]) || [];
    },
    "students",
    schoolId ? { school_id: schoolId } : undefined,
    options,
  );

  const demoStudents = useMemo(
    () => (isDemoSchool(schoolId) ? (DEMO_STUDENTS as unknown as Student[]) : null),
    [schoolId],
  );

  return {
    data: demoStudents ?? data,
    loading: demoStudents ? false : loading,
    error: demoStudents ? null : error,
    isFromCache: demoStudents ? false : isFromCache,
    refetch,
  };
}

export function useOfflineAttendance(schoolId?: string, date?: string, options?: OfflineHookOptions) {
  return useOfflineData<Attendance>(
    "attendance",
    async () => {
      if (!schoolId || !date) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*, students!inner (school_id)")
        .eq("students.school_id", schoolId)
        .eq("date", date);

      if (error) throw error;
      return (data as Attendance[]) || [];
    },
    "attendance",
    date ? { date } : undefined,
    options,
  );
}

export function useOfflineGrades(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<Grade>(
    "grades",
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("grades")
        .select("*, students!inner (id, first_name, last_name, school_id), subjects (id, name, code)")
        .eq("students.school_id", schoolId);

      if (error) throw error;
      return (data as Grade[]) || [];
    },
    "grades",
    undefined,
    options,
  );
}

export function useOfflineFees(schoolId?: string, options?: OfflineHookOptions & { limit?: number; offset?: number }) {
  const [data, setData] = useState<(FeePayment & { fee_structure?: FeeStructure })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const isOnline = useOnlineStatus();

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const fetchData = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    // Cache and server at the same time, for the same reason as
    // useOfflineData: a slow local database must not stand in front of the
    // money the bursar came to look at.
    let cacheError: unknown = null;
    let networkError: unknown = null;

    const cachePromise = offlineDB.getAllFromCache("fee_payments", { school_id: schoolId }).catch((e: unknown) => {
      cacheError = e;
      logger.error("Error reading fee_payments cache:", e);
      return null;
    });

    const networkPromise =
      isOnline && !options?.skipCache
        ? (async () => {
            try {
              const payResult = await withTimeout(
                supabase
                  .from("fee_payments")
                  .select("*, students!inner (id, first_name, last_name, school_id, classes (name))", {
                    count: "exact",
                  })
                  .eq("students.school_id", schoolId)
                  .order("payment_date", { ascending: false })
                  .range(offset, offset + limit - 1),
                OFFLINE_READ_TIMEOUT_MS,
                timeoutFallback(),
              );
              if (isTimeoutResult(payResult)) throw new Error("Loading payments took too long");
              if (payResult.error) throw payResult.error;
              return {
                rows: (payResult.data as (FeePayment & { fee_structure?: FeeStructure })[]) || [],
                count: payResult.count,
              };
            } catch (e: unknown) {
              networkError = e;
              const msg = e instanceof Error ? e.message : "Unknown error";
              logger.error("Error fetching fee_payments from server:", msg);
              return null;
            }
          })()
        : null;

    const cached = await cachePromise;
    if (cached && cached.length > 0) {
      setData(cached as unknown as (FeePayment & { fee_structure?: FeeStructure })[]);
      setTotalCount(cached.length);
      setIsFromCache(true);
      setLoading(false);
    }

    const fresh = networkPromise ? await networkPromise : null;
    if (fresh) {
      setData(fresh.rows);
      if (fresh.count !== null) setTotalCount(fresh.count);
      setIsFromCache(false);
      await offlineDB.cacheFromServer("fee_payments", fresh.rows as unknown as Record<string, unknown>[]);
      setLoading(false);
      return;
    }

    if (!cached || cached.length === 0) {
      setError(describeReadFailure("payments", networkError ?? cacheError));
    }
    setLoading(false);
  }, [isOnline, schoolId, options?.skipCache, limit, offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, isFromCache, totalCount, refetch: fetchData };
}

export function useOfflineHealthRecords(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "health_records",
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("health_records")
        .select("*")
        .eq("school_id", schoolId)
        .order("admitted_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "health_records",
    schoolId ? { school_id: schoolId } : undefined,
    options,
  );
}

export function useOfflineCanteenItems(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "canteen_items",
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("canteen_items")
        .select("*")
        .eq("school_id", schoolId)
        .order("category", { ascending: true });
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "canteen_items",
    schoolId ? { school_id: schoolId } : undefined,
    options,
  );
}

export function useOfflineCanteenOrders(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "canteen_orders",
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("canteen_orders")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "canteen_orders",
    schoolId ? { school_id: schoolId } : undefined,
    options,
  );
}

export function useOfflineHomework(
  schoolId?: string,
  academicYear?: string,
  term?: string,
  classId?: string,
  options?: OfflineHookOptions,
) {
  return useOfflineData<any>(
    "homework",
    async () => {
      if (!schoolId || !academicYear || !term) return [];
      let query = supabase
        .from("homework")
        .select("*, subjects(name), classes(name), users(full_name)")
        .eq("school_id", schoolId)
        .eq("academic_year", academicYear)
        .eq("term", term)
        .order("due_date", { ascending: false });
      if (classId) query = query.eq("class_id", classId);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "homework",
    schoolId && academicYear && term
      ? classId
        ? { school_id: schoolId, academic_year: academicYear, term, class_id: classId }
        : { school_id: schoolId, academic_year: academicYear, term }
      : undefined,
    options,
  );
}

export function useOfflineHomeworkSubmissions(
  homeworkId?: string,
  schoolId?: string,
  classId?: string,
  options?: OfflineHookOptions,
) {
  return useOfflineData<any>(
    "homework_submissions",
    async () => {
      if (!homeworkId) return [];
      const { data, error } = await supabase
        .from("homework_submissions")
        .select("*, students(first_name, last_name, classes(name))")
        .eq("homework_id", homeworkId);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "homework_submissions",
    homeworkId ? { homework_id: homeworkId } : undefined,
    options,
  );
}

export function useOfflineClasses(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "classes",
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase.from("classes").select("*").eq("school_id", schoolId).order("name");
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "classes",
    schoolId ? { school_id: schoolId } : undefined,
    options,
  );
}

export function useOfflineClassStudentsFull(schoolId?: string, classId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "students",
    async () => {
      if (!schoolId || !classId) return [];
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, classes(name)")
        .eq("school_id", schoolId)
        .eq("class_id", classId);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "students",
    schoolId && classId ? { school_id: schoolId, class_id: classId } : undefined,
    options,
  );
}

export function useOfflineStudentsBasic(schoolId?: string, status?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "students",
    async () => {
      if (!schoolId) return [];
      let query = supabase
        .from("students")
        .select("id, class_id, first_name, last_name, student_number, status")
        .eq("school_id", schoolId);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "students",
    schoolId ? (status ? { school_id: schoolId, status } : { school_id: schoolId }) : undefined,
    options,
  );
}

export function useOfflineFeeStructure(schoolId?: string, term?: number, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "fee_structure",
    async () => {
      if (!schoolId || !term) return [];
      const { data, error } = await supabase
        .from("fee_structure")
        .select("*")
        .eq("school_id", schoolId)
        .eq("term", term);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "fee_structure",
    schoolId && term ? { school_id: schoolId, term } : undefined,
    options,
  );
}

export function useOfflineLeaveRequests(
  schoolId?: string,
  staffId?: string,
  isManager?: boolean,
  options?: OfflineHookOptions,
) {
  return useOfflineData<any>(
    "leave_requests",
    async () => {
      if (!schoolId) return [];
      let query = supabase
        .from("leave_requests")
        .select("*, users:staff_id(full_name)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (!isManager && staffId) {
        query = query.eq("staff_id", staffId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "leave_requests",
    schoolId ? (isManager ? { school_id: schoolId } : { school_id: schoolId, staff_id: staffId }) : undefined,
    options,
  );
}

export function useOfflinePromotionHistory(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "promotion_history",
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("promotion_history")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "promotion_history",
    schoolId ? { school_id: schoolId } : undefined,
    options,
  );
}

export function useOfflineClassStudents(schoolId?: string, classId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "students",
    async () => {
      if (!schoolId || !classId) return [];
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, student_number")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .order("first_name");
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "students",
    schoolId && classId ? { school_id: schoolId, class_id: classId } : undefined,
    options,
  );
}

export function useOfflineEvents(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    "events",
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, event_type, audience, start_date, end_date")
        .eq("school_id", schoolId)
        .order("start_date");
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    "events",
    schoolId ? { school_id: schoolId } : undefined,
    options,
  );
}
