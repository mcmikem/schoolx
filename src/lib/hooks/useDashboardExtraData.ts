"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { isDemoSchool } from "@/lib/demo-utils";
import { logger } from "@/lib/logger";
import { getCachedResponse, cacheResponse, isOnline, generateCacheKey } from "@/lib/offline-db";

// Stale-while-revalidate cache pattern for dashboard data:
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
}

export function useDashboardExtraData(
  schoolId: string | undefined,
  students: any[],
  feeStructure: any[],
  currentTerm: string | number | undefined,
  academicYear: string | undefined,
): DashboardExtraData {
  const [classAttendance, setClassAttendance] = useState<
    Record<string, ClassAttendance>
  >({});
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([]);
  const [smsStats, setSmsStats] = useState({ sentToday: 0, deliveryRate: 0, remaining: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [pendingExpenses, setPendingExpenses] = useState(0);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [feesToday, setFeesToday] = useState(0);
  const [feesThisWeek, setFeesThisWeek] = useState(0);
  const [feesThisTerm, setFeesThisTerm] = useState(0);
  const [staffOnDuty, setStaffOnDuty] = useState(0);
  const [overdueFeeCount, setOverdueFeeCount] = useState(0);
  const [lowAttendanceClasses, setLowAttendanceClasses] = useState(0);
  const [dropoutRiskCount, setDropoutRiskCount] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const { isDemo } = useAuth();

  const studentsRef = useRef(students);
  useEffect(() => { studentsRef.current = students; }, [students]);
  const feeStructureRef = useRef(feeStructure);
  useEffect(() => { feeStructureRef.current = feeStructure; }, [feeStructure]);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const cacheKey = generateCacheKey(`/api/dashboard-extra/${schoolId}`, { currentTerm, academicYear });
    let cancelled = false;
    let freshDataApplied = false;

    // Demo mode — return mock data immediately
    if (isDemo || isDemoSchool(schoolId)) {
      setClassAttendance({
        "demo-class-1": { present: 28, total: 30 },
        "demo-class-2": { present: 25, total: 28 },
        "demo-class-3": { present: 22, total: 25 },
      });
      setAtRiskStudents([
        { id: "demo-1", first_name: "John", last_name: "Okello", classes: { name: "Primary 4" } },
        { id: "demo-2", first_name: "Sarah", last_name: "Nabukeera", classes: { name: "Primary 5" } },
      ]);
      setSmsStats({ sentToday: 12, deliveryRate: 92, remaining: 0, total: 0 });
      setPendingExpenses(2);
      setPendingLeave(1);
      setFeesToday(850000);
      setFeesThisWeek(4200000);
      setFeesThisTerm(18500000);
      setStaffOnDuty(18);
      setOverdueFeeCount(15);
      setLowAttendanceClasses(1);
      setDropoutRiskCount(3);
      setLoading(false);
      return;
    }

    const applyCachedData = (cached: any) => {
      setClassAttendance(cached.classAttendance || {});
      setAtRiskStudents(cached.atRiskStudents || []);
      setSmsStats(cached.smsStats || { sentToday: 0, deliveryRate: 0, remaining: 0, total: 0 });
      setPendingExpenses(cached.pendingExpenses || 0);
      setPendingLeave(cached.pendingLeave || 0);
      setFeesToday(cached.feesToday || 0);
      setFeesThisWeek(cached.feesThisWeek || 0);
      setFeesThisTerm(cached.feesThisTerm || 0);
      setStaffOnDuty(cached.staffOnDuty || 0);
      setOverdueFeeCount(cached.overdueFeeCount || 0);
      setLowAttendanceClasses(cached.lowAttendanceClasses || 0);
      setDropoutRiskCount(cached.dropoutRiskCount || 0);
    };

    // Stale-while-revalidate: show cached data immediately (non-blocking)
    getCachedResponse<any>(cacheKey).then((cached) => {
      if (cancelled || freshDataApplied) return;
      if (cached) {
        applyCachedData(cached);
        setIsStale(true);
        setLoading(false);
      } else if (!isOnline()) {
        setLoading(false);
      }
    });

    // Offline — skip fetch, rely on cached data (or empty if unavailable)
    if (!isOnline()) return;

    async function fetchExtraData() {
      let fetchSucceeded = false;
      try {
        const today = new Date().toISOString().split("T")[0];
        const now = new Date();
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

        const [
          attendanceRes,
          gradesRes,
          messagesRes,
          paymentsRes,
          staffAttRes,
          dropoutAttRes,
        ] = await Promise.all([
          supabase
            .from("attendance")
            .select("student_id, class_id, status, students!inner(school_id)")
            .eq("students.school_id", schoolId)
            .eq("date", today),
          supabase
            .from("grades")
            .select(
              "student_id, score, term, academic_year, students!inner(school_id)",
            )
            .eq("students.school_id", schoolId)
            .eq("term", currentTerm || 1)
            .eq("academic_year", effectiveAcademicYear),
          supabase
            .from("messages")
            .select("status, created_at")
            .eq("school_id", schoolId)
            .gte("created_at", today),
          supabase
            .from("fee_payments")
            .select("student_id, amount_paid, payment_date, students!inner(school_id)")
            .eq("students.school_id", schoolId)
            .gte("payment_date", termStart),
          supabase
            .from("staff_attendance")
            .select("status, staff_id, users!inner(school_id)")
            .eq("users.school_id", schoolId)
            .eq("date", today)
            .in("status", ["present", "late"]),
          supabase
            .from("attendance")
            .select("student_id, status, date, students!inner(school_id)")
            .eq("students.school_id", schoolId)
            .gte("date", dropoutStartDate)
            .lte("date", today)
            .order("date", { ascending: false }),
        ]);

        const [expensesRes, leaveRes] = await Promise.all([
          supabase
            .from("expenses")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId)
            .eq("status", "pending")
            .then((r) => {
              if (r.error) {
                logger.warn("expenses query skipped:", r.error.message);
                return { count: 0, error: null };
              }
              return r;
            }),
          supabase
            .from("leave_requests")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId)
            .eq("status", "pending")
            .then((r) => {
              if (r.error) {
                logger.warn("leave_requests query skipped:", r.error.message);
                return { count: 0, error: null };
              }
              return r;
            }),
        ]);

        if (cancelled) return;

        // Attendance by class
        const attendanceByClass: Record<string, ClassAttendance> = {};
        const hasAttendanceMarkedToday = (attendanceRes.data?.length || 0) > 0;
        const studentClassMap: Record<string, string> = {};
        studentsRef.current.forEach((s) => {
          studentClassMap[s.id] = s.class_id;
        });

        if (hasAttendanceMarkedToday) {
          attendanceRes.data?.forEach((a) => {
            const classId = studentClassMap[a.student_id];
            if (!classId) return;
            if (!attendanceByClass[classId]) {
              attendanceByClass[classId] = { present: 0, total: 0 };
            }
            attendanceByClass[classId].total++;
            if (a.status === "present") attendanceByClass[classId].present++;
          });
        }

        setClassAttendance(hasAttendanceMarkedToday ? attendanceByClass : {});

        let lowAtt = 0;
        if (hasAttendanceMarkedToday) {
          Object.values(attendanceByClass).forEach((c) => {
            if (c.total > 0 && c.present / c.total < 0.7) lowAtt++;
          });
        }
        setLowAttendanceClasses(lowAtt);

        // At-risk students
        const studentScores: Record<string, number[]> = {};
        gradesRes.data?.forEach((g) => {
          if (!studentScores[g.student_id]) studentScores[g.student_id] = [];
          studentScores[g.student_id].push(Number(g.score));
        });

        const atRisk = Object.entries(studentScores)
          .filter(([_, scores]) => scores.filter((s) => s < 50).length >= 2)
          .map(([studentId]) => studentsRef.current.find((s) => s.id === studentId))
          .filter(Boolean)
          .slice(0, 5);
        setAtRiskStudents(atRisk);

        // Dropout risk
        let computedDropoutCount = 0;
        if (!cancelled) {
          try {
            const dropoutAttData = dropoutAttRes?.data || [];
            const studentAbsenceMap: Record<
              string,
              { allAbsent: boolean; count: number }
            > = {};
            const activeStudentIds = new Set(
              studentsRef.current.filter((s) => s.status === "active").map((s) => s.id),
            );

            dropoutAttData.forEach((r: any) => {
              if (!activeStudentIds.has(r.student_id)) return;
              if (!studentAbsenceMap[r.student_id]) {
                studentAbsenceMap[r.student_id] = {
                  allAbsent: r.status === "absent",
                  count: r.status === "absent" ? 1 : 0,
                };
              } else if (
                studentAbsenceMap[r.student_id].allAbsent &&
                r.status === "absent"
              ) {
                studentAbsenceMap[r.student_id].count++;
              } else {
                studentAbsenceMap[r.student_id].allAbsent = false;
              }
            });

            computedDropoutCount = Object.values(studentAbsenceMap).filter(
              (v) => v.allAbsent && v.count >= 14,
            ).length;
            setDropoutRiskCount(computedDropoutCount);
          } catch (err) {
            logger.error("Dropout risk calculation error:", err);
            if (!cancelled) setDropoutRiskCount(0);
          }
        }

        // SMS stats
        const sentToday = messagesRes.data?.length || 0;
        const delivered =
          messagesRes.data?.filter((m: any) => m.status === "delivered")
            .length || 0;
        const rate =
          sentToday > 0 ? Math.round((delivered / sentToday) * 100) : 0;
        setSmsStats({ sentToday, deliveryRate: rate, remaining: 0, total: 0 });

        // Pending approvals
        setPendingExpenses(expensesRes.count || 0);
        setPendingLeave(leaveRes.count || 0);

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

        setFeesToday(todayTotal);
        setFeesThisWeek(weekTotal);
        setFeesThisTerm(termTotal);

        // Staff on duty
        setStaffOnDuty(staffAttRes.data?.length || 0);

        let overdueCount = 0;
        if (feeStructureRef.current.length > 0) {
          const paidByStudent: Record<string, number> = {};
          allPayments?.forEach((p: any) => {
            const sid = p.student_id || "";
            if (sid)
              paidByStudent[sid] =
                (paidByStudent[sid] || 0) + Number(p.amount_paid);
          });

          overdueCount = studentsRef.current.filter(
            (student) => {
              const expectedForStudent = feeStructureRef.current
                .filter(
                  (fee) => !fee.class_id || fee.class_id === student.class_id,
                )
                .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

              if (expectedForStudent <= 0) {
                return false;
              }

              return (paidByStudent[student.id] || 0) < expectedForStudent * 0.5;
            },
          ).length;
          setOverdueFeeCount(overdueCount);
        } else {
          setOverdueFeeCount(0);
        }

        const cacheData = {
          classAttendance: attendanceByClass,
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
        await cacheResponse(cacheKey, cacheData, undefined, 2 * 60 * 1000);
        fetchSucceeded = true;
      } catch (err) {
        logger.error("Error fetching dashboard extra data:", err);
        if (!cancelled) {
          const cached = await getCachedResponse<any>(cacheKey);
          if (cached && !cancelled) {
            applyCachedData(cached);
          }
        }
      } finally {
        if (!cancelled) {
          freshDataApplied = true;
          setLoading(false);
          setIsStale(!fetchSucceeded);
        }
      }
    }

    fetchExtraData();

    return () => {
      cancelled = true;
    };
  }, [schoolId, currentTerm, academicYear, isDemo]);

  useEffect(() => {
    const handleOnline = () => {
      setIsStale(true);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return {
    classAttendance,
    atRiskStudents,
    smsStats,
    pendingExpenses,
    pendingLeave,
    feesToday,
    feesThisWeek,
    feesThisTerm,
    staffOnDuty,
    overdueFeeCount,
    lowAttendanceClasses,
    dropoutRiskCount,
    loading,
    isStale,
  };
}
