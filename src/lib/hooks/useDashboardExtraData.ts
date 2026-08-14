"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { isDemoSchool } from "@/lib/demo-utils";
import { logger } from "@/lib/logger";
import { offlineDB } from "@/lib/offline";
import { withTimeout, timeoutFallback, getLocalDateString } from "@/lib/hooks/utils";

// Stale-while-revalidate dashboard data backed by React Query + the canonical
// OfflineDB cache:
// 1. On mount, immediately show cached data (if available) — no loading spinner
// 2. Always fetch fresh data in the background
// 3. Loading spinner only appears when there is NO cached data at all
// 4. isStale=true indicates the displayed data is stale while revalidating

interface ClassAttendance {
  present: number;
  total: number;
}

interface DashboardExtraData {
  classAttendance: Record<string, ClassAttendance>;
  atRiskStudents: any[];
  smsStats: { sentToday: number; deliveryRate: number; remaining: number; total: number };
  pendingExpenses: number;
  pendingLeave: number;
  feesToday: number;
  feesThisWeek: number;
  feesThisTerm: number;
  staffOnDuty: number;
  overdueFeeCount: number;
  lowAttendanceClasses: number;
  dropoutRiskCount: number;
  loading: boolean;
  isStale: boolean;
  timedOut: boolean;
}

interface DashboardPayload {
  classAttendance: Record<string, ClassAttendance>;
  atRiskStudents: any[];
  smsStats: { sentToday: number; deliveryRate: number; remaining: number; total: number };
  pendingExpenses: number;
  pendingLeave: number;
  feesToday: number;
  feesThisWeek: number;
  feesThisTerm: number;
  staffOnDuty: number;
  overdueFeeCount: number;
  lowAttendanceClasses: number;
  dropoutRiskCount: number;
}

const DEMO_PAYLOAD: DashboardPayload = {
  classAttendance: {
    "demo-class-1": { present: 28, total: 30 },
    "demo-class-2": { present: 25, total: 28 },
    "demo-class-3": { present: 22, total: 25 },
  },
  atRiskStudents: [
    { id: "demo-1", first_name: "John", last_name: "Okello", classes: { name: "Primary 4" } },
    { id: "demo-2", first_name: "Sarah", last_name: "Nabukeera", classes: { name: "Primary 5" } },
  ],
  smsStats: { sentToday: 12, deliveryRate: 92, remaining: 0, total: 0 },
  pendingExpenses: 2,
  pendingLeave: 1,
  feesToday: 850000,
  feesThisWeek: 4200000,
  feesThisTerm: 18500000,
  staffOnDuty: 18,
  overdueFeeCount: 15,
  lowAttendanceClasses: 1,
  dropoutRiskCount: 3,
};

const EMPTY_PAYLOAD: DashboardPayload = {
  classAttendance: {},
  atRiskStudents: [],
  smsStats: { sentToday: 0, deliveryRate: 0, remaining: 0, total: 0 },
  pendingExpenses: 0,
  pendingLeave: 0,
  feesToday: 0,
  feesThisWeek: 0,
  feesThisTerm: 0,
  staffOnDuty: 0,
  overdueFeeCount: 0,
  lowAttendanceClasses: 0,
  dropoutRiskCount: 0,
};

// Raised when the core dashboard queries time out AND no cached payload is
// available to fall back on. The dashboard must NOT render a plausible-looking
// zero-stat payload when the data genuinely could not be fetched — that is what
// made live schools with hundreds of students appear empty.
class DashboardTimeoutsError extends Error {
  name = "DashboardTimeoutsError";
}

function computePayload(
  schoolId: string,
  students: any[],
  feeStructure: any[],
  currentTerm: string | number | undefined,
  academicYear: string | undefined,
  fallback?: DashboardPayload | null,
): Promise<DashboardPayload> {
  return (async () => {
    const now = new Date();
    // Local date — must match how attendance is marked in the UI.
    const today = getLocalDateString(now);
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekStart = monday.toISOString().split("T")[0];

    const termLookbackDate = new Date(now);
    termLookbackDate.setDate(now.getDate() - 180);
    const termStart = termLookbackDate.toISOString().split("T")[0];

    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 14);
    const dropoutStartDate = fourteenDaysAgo.toISOString().split("T")[0];
    const effectiveAcademicYear = academicYear || new Date().getFullYear().toString();

    const [attendanceRes, gradesRes, messagesRes, paymentsRes, staffAttRes, dropoutAttRes] = await Promise.all([
      withTimeout(
        supabase
          .from("attendance")
          .select("student_id, class_id, status, students!inner(school_id)")
          .eq("students.school_id", schoolId)
          .eq("date", today),
        15000,
        timeoutFallback(),
      ),
      withTimeout(
        supabase
          .from("grades")
          .select("student_id, score, term, academic_year, students!inner(school_id)")
          .eq("students.school_id", schoolId)
          .eq("term", currentTerm || 1)
          .eq("academic_year", effectiveAcademicYear),
        15000,
        timeoutFallback(),
      ),
      withTimeout(
        supabase.from("messages").select("status, created_at").eq("school_id", schoolId).gte("created_at", today),
        15000,
        timeoutFallback(),
      ),
      withTimeout(
        supabase
          .from("fee_payments")
          .select("student_id, amount_paid, payment_date, students!inner(school_id)")
          .eq("students.school_id", schoolId)
          .gte("payment_date", termStart),
        15000,
        timeoutFallback(),
      ),
      withTimeout(
        supabase
          .from("staff_attendance")
          .select("status, staff_id, users!inner(school_id)")
          .eq("users.school_id", schoolId)
          .eq("date", today)
          .in("status", ["present", "late"]),
        15000,
        timeoutFallback(),
      ),
      withTimeout(
        supabase
          .from("attendance")
          .select("student_id, status, date, students!inner(school_id)")
          .eq("students.school_id", schoolId)
          .gte("date", dropoutStartDate)
          .lte("date", today)
          .order("date", { ascending: false }),
        15000,
        timeoutFallback(),
      ),
    ]);

    // If ANY core query timed out (status 408 from timeoutFallback()), the
    // payload below would be full of plausible-looking zeros. Prefer the last
    // known-good cached payload; if there is none, raise so the caller can
    // surface a retry state instead of claiming the school has no data.
    const mainTimedOut = [attendanceRes, gradesRes, messagesRes, paymentsRes, staffAttRes, dropoutAttRes].some(
      (r) => r.status === 408,
    );
    if (mainTimedOut) {
      if (fallback) return { ...fallback };
      throw new DashboardTimeoutsError();
    }

    const [expensesRes, leaveRes] = await Promise.all([
      withTimeout(
        supabase
          .from("expenses")
          .select("*", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("status", "pending"),
        15000,
        timeoutFallback(),
      ).then((r) => {
        if (r.error) {
          logger.warn("expenses query skipped:", r.error.message);
          return { count: 0, error: null };
        }
        return r;
      }),
      withTimeout(
        supabase
          .from("leave_requests")
          .select("*", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("status", "pending"),
        15000,
        timeoutFallback(),
      ).then((r) => {
        if (r.error) {
          logger.warn("leave_requests query skipped:", r.error.message);
          return { count: 0, error: null };
        }
        return r;
      }),
    ]);

    // Attendance by class
    const attendanceByClass: Record<string, ClassAttendance> = {};
    const hasAttendanceMarkedToday = (attendanceRes.data?.length || 0) > 0;
    const studentClassMap: Record<string, string> = {};
    students.forEach((s) => {
      studentClassMap[s.id] = s.class_id;
    });

    if (hasAttendanceMarkedToday) {
      attendanceRes.data?.forEach((a) => {
        // Prefer the class_id stamped on the attendance row itself; fall back
        // to the (possibly paginated) student list for legacy rows without it.
        const classId = a.class_id || studentClassMap[a.student_id];
        if (!classId) return;
        if (!attendanceByClass[classId]) {
          attendanceByClass[classId] = { present: 0, total: 0 };
        }
        attendanceByClass[classId].total++;
        if (a.status === "present") attendanceByClass[classId].present++;
      });
    }

    let lowAtt = 0;
    if (hasAttendanceMarkedToday) {
      Object.values(attendanceByClass).forEach((c) => {
        if (c.total > 0 && c.present / c.total < 0.7) lowAtt++;
      });
    }

    // At-risk students
    const studentScores: Record<string, number[]> = {};
    gradesRes.data?.forEach((g) => {
      if (!studentScores[g.student_id]) studentScores[g.student_id] = [];
      studentScores[g.student_id].push(Number(g.score));
    });

    const atRisk = Object.entries(studentScores)
      .filter(([_, scores]) => scores.filter((s) => s < 50).length >= 2)
      .map(([studentId]) => students.find((s) => s.id === studentId))
      .filter(Boolean)
      .slice(0, 5);

    // Dropout risk
    let computedDropoutCount = 0;
    try {
      const dropoutAttData = dropoutAttRes?.data || [];
      const studentAbsenceMap: Record<string, { allAbsent: boolean; count: number }> = {};
      const activeStudentIds = new Set(students.filter((s) => s.status === "active").map((s) => s.id));

      dropoutAttData.forEach((r: any) => {
        if (!activeStudentIds.has(r.student_id)) return;
        if (!studentAbsenceMap[r.student_id]) {
          studentAbsenceMap[r.student_id] = {
            allAbsent: r.status === "absent",
            count: r.status === "absent" ? 1 : 0,
          };
        } else if (studentAbsenceMap[r.student_id].allAbsent && r.status === "absent") {
          studentAbsenceMap[r.student_id].count++;
        } else {
          studentAbsenceMap[r.student_id].allAbsent = false;
        }
      });

      computedDropoutCount = Object.values(studentAbsenceMap).filter((v) => v.allAbsent && v.count >= 14).length;
    } catch (err) {
      logger.error("Dropout risk calculation error:", err);
    }

    // SMS stats
    const sentToday = messagesRes.data?.length || 0;
    const delivered = messagesRes.data?.filter((m: any) => m.status === "delivered").length || 0;
    const rate = sentToday > 0 ? Math.round((delivered / sentToday) * 100) : 0;

    // Fees by period
    const allPayments = paymentsRes.data;
    let todayTotal = 0;
    let weekTotal = 0;
    let termTotal = 0;

    allPayments?.forEach((p: any) => {
      const pDate = p.payment_date || "";
      const amt = Number(p.amount_paid) || 0;
      termTotal += amt;
      if (pDate >= weekStart) weekTotal += amt;
      if (pDate >= today) todayTotal += amt;
    });

    let overdueCount = 0;
    if (feeStructure.length > 0) {
      const paidByStudent: Record<string, number> = {};
      allPayments?.forEach((p: any) => {
        const sid = p.student_id || "";
        if (sid) paidByStudent[sid] = (paidByStudent[sid] || 0) + Number(p.amount_paid);
      });

      overdueCount = students.filter((student) => {
        const expectedForStudent = feeStructure
          .filter((fee) => !fee.class_id || fee.class_id === student.class_id)
          .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

        if (expectedForStudent <= 0) {
          return false;
        }

        return (paidByStudent[student.id] || 0) < expectedForStudent * 0.5;
      }).length;
    }

    return {
      classAttendance: hasAttendanceMarkedToday ? attendanceByClass : {},
      atRiskStudents: atRisk,
      smsStats: { sentToday, deliveryRate: rate, remaining: 0, total: 0 },
      pendingExpenses: expensesRes.count || 0,
      pendingLeave: leaveRes.count || 0,
      feesToday: todayTotal,
      feesThisWeek: weekTotal,
      feesThisTerm: termTotal,
      staffOnDuty: staffAttRes.data?.length || 0,
      overdueFeeCount: overdueCount,
      lowAttendanceClasses: lowAtt,
      dropoutRiskCount: computedDropoutCount,
    };
  })();
}

function cacheKeyFor(
  schoolId: string,
  currentTerm: string | number | undefined,
  academicYear: string | undefined,
): string {
  return `dashboard-extra:${schoolId}:${currentTerm ?? "none"}:${academicYear ?? "none"}`;
}

async function readDashboardCache(cacheKey: string): Promise<DashboardPayload | null> {
  try {
    const cached = await offlineDB.get("dashboard_cache", cacheKey);
    return cached ? (cached.payload as DashboardPayload) : null;
  } catch {
    return null;
  }
}

async function writeDashboardCache(cacheKey: string, payload: DashboardPayload): Promise<void> {
  try {
    await offlineDB.cacheFromServer("dashboard_cache", [
      { id: cacheKey, payload } as unknown as Record<string, unknown>,
    ]);
  } catch (err) {
    logger.error("Failed to write dashboard cache:", err);
  }
}

export function useDashboardExtraData(
  schoolId: string | undefined,
  students: any[],
  feeStructure: any[],
  currentTerm: string | number | undefined,
  academicYear: string | undefined,
): DashboardExtraData {
  const { isDemo } = useAuth();
  const queryClient = useQueryClient();
  const isDemoSchoolId = isDemoSchool(schoolId);
  const enabled = !!schoolId && !isDemo && !isDemoSchoolId;
  const cacheKey = schoolId ? cacheKeyFor(schoolId, currentTerm, academicYear) : "";
  const [isStale, setIsStale] = useState(false);
  const [cachedPayload, setCachedPayload] = useState<DashboardPayload | null>(null);
  const usedFallbackRef = useRef(false);

  const query = useQuery<DashboardPayload>({
    queryKey: ["dashboard-extra", schoolId, currentTerm, academicYear],
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      usedFallbackRef.current = false;
      try {
        return await computePayload(schoolId as string, students, feeStructure, currentTerm, academicYear);
      } catch (error) {
        if (error instanceof DashboardTimeoutsError) {
          const cached = await readDashboardCache(cacheKey);
          if (cached) {
            // Core queries timed out but the OfflineDB has a last-known-good
            // payload — show that (marked stale) rather than zeroing the board.
            usedFallbackRef.current = true;
            return cached;
          }
        }
        throw error;
      }
    },
  });

  // Seed instantly from offline cache so the dashboard renders without a spinner.
  useEffect(() => {
    if (!enabled || !cacheKey) return;
    let cancelled = false;
    readDashboardCache(cacheKey).then((cached) => {
      if (cancelled || !cached) return;
      setCachedPayload(cached);
      setIsStale(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, cacheKey]);

  // Write-through: persist fresh data to the offline cache.
  useEffect(() => {
    if (!enabled || query.data === undefined) return;
    if (usedFallbackRef.current) {
      // The payload came from the OfflineDB fallback — nothing new to write.
      return;
    }
    setCachedPayload(null);
    setIsStale(false);
    writeDashboardCache(cacheKey, query.data);
  }, [enabled, cacheKey, query.data]);

  // Refresh immediately when attendance/fees change elsewhere in the app so the
  // "Attendance not taken for today" / low-attendance tasks stay in sync.
  useEffect(() => {
    if (!enabled) return;
    const invalidate = () =>
      void queryClient.invalidateQueries({ queryKey: ["dashboard-extra", schoolId], refetchType: "all" });
    window.addEventListener("dashboard-stats:refresh", invalidate);
    return () => window.removeEventListener("dashboard-stats:refresh", invalidate);
  }, [enabled, schoolId, queryClient]);

  useEffect(() => {
    if (!enabled) return;
    const handleOnline = () => setIsStale(true);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [enabled]);

  if (isDemo || isDemoSchoolId) {
    return { ...DEMO_PAYLOAD, loading: false, isStale: false, timedOut: false };
  }

  const data = query.data ?? cachedPayload;

  return {
    ...(data ?? EMPTY_PAYLOAD),
    loading: !data,
    isStale: isStale || (query.data !== undefined && usedFallbackRef.current),
    timedOut: query.data !== undefined && usedFallbackRef.current,
  };
}
