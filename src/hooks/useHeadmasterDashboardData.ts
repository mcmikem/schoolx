import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Student } from "@/types";

export function useHeadmasterDashboardData(
  schoolId?: string,
  currentTerm?: number,
  academicYear?: string,
  students: Student[] = [],
) {
  const [data, setData] = useState({
    classAttendance: {} as Record<string, { present: number; total: number }>,
    atRiskStudents: [] as Student[],
    smsStats: { sentToday: 0, deliveryRate: 0 },
    pendingExpenses: 0,
    pendingLeave: 0,
    feesToday: 0,
    feesThisWeek: 0,
    feesThisTerm: 0,
    staffOnDuty: 0,
    overdueFeeCount: 0,
    lowAttendanceClasses: 0,
    dropoutRiskCount: 0,
    loading: true,
  });

  useEffect(() => {
    if (!schoolId) return;

    async function fetchData() {
      setData((prev) => ({ ...prev, loading: true }));
      try {
        const today = new Date().toISOString().split("T")[0];
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(
          now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1),
        );
        const weekStart = monday.toISOString().split("T")[0];

        // Execute all queries in parallel
        const [
          { data: attendanceData },
          { data: gradesData },
          { data: dropoutAttData },
          { data: messagesData },
          { count: expCount },
          { count: leaveCount },
          { data: allPayments },
          { data: staffAttData },
        ] = await Promise.all([
          supabase
            .from("attendance")
            .select("student_id, class_id, status")
            .eq("date", today)
            .limit(2000),
          supabase
            .from("grades")
            .select("student_id, score, term, academic_year")
            .eq("term", currentTerm || 1)
            .eq("academic_year", academicYear || "2026")
            .limit(5000),
          supabase
            .from("attendance")
            .select("student_id, status, date")
            .order("date", { ascending: false })
            .limit(5000),
          supabase
            .from("messages")
            .select("status, created_at")
            .eq("school_id", schoolId)
            .gte("created_at", today)
            .limit(1000),
          supabase
            .from("expenses")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId)
            .eq("status", "pending"),
          supabase
            .from("leave_requests")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId)
            .eq("status", "pending"),
          supabase
            .from("fee_payments")
            .select("amount_paid, payment_date, students!inner(school_id)")
            .eq("students.school_id", schoolId)
            .limit(10000),
          supabase
            .from("staff_attendance")
            .select("status")
            .eq("school_id", schoolId)
            .eq("date", today)
            .in("status", ["present", "late"])
            .limit(500),
        ]);

        // Process Class Attendance
        const attendanceByClass: Record<
          string,
          { present: number; total: number }
        > = {};
        const studentClassMap: Record<string, string> = {};
        students.forEach((s) => {
          studentClassMap[s.id] = s.class_id;
        });
        attendanceData?.forEach((a) => {
          const classId = studentClassMap[a.student_id];
          if (!classId) return;
          if (!attendanceByClass[classId])
            attendanceByClass[classId] = { present: 0, total: 0 };
          attendanceByClass[classId].total++;
          if (a.status === "present") attendanceByClass[classId].present++;
        });

        // Process At-Risk Students
        const studentScores: Record<string, number[]> = {};
        gradesData?.forEach((g) => {
          if (!studentScores[g.student_id]) studentScores[g.student_id] = [];
          studentScores[g.student_id].push(Number(g.score));
        });
        const atRisk = Object.entries(studentScores)
          .filter(([_, scores]) => scores.filter((s) => s < 50).length >= 2)
          .map(([studentId]) => students.find((s) => s.id === studentId))
          .filter((s): s is Student => Boolean(s))
          .slice(0, 5);

        // Process dropout risk from repeated recent absences
        const activeStudentIds = new Set(
          students.filter((s) => s.status === "active").map((s) => s.id),
        );
        const recentAbsencesByStudent: Record<string, number> = {};
        dropoutAttData?.forEach((record) => {
          if (!activeStudentIds.has(record.student_id)) return;
          if (record.status === "absent") {
            recentAbsencesByStudent[record.student_id] =
              (recentAbsencesByStudent[record.student_id] || 0) + 1;
          }
        });
        const dropoutCount = Object.values(recentAbsencesByStudent).filter(
          (count) => count >= 3,
        ).length;

        // Fee totals
        const overdueFeeCount = students.filter(
          (student) => Number((student as any).opening_balance || 0) > 0,
        ).length;
        let todayTotal = 0,
          weekTotal = 0,
          termTotal = 0;
        allPayments?.forEach((p: any) => {
          const amt = Number(p.amount_paid) || 0;
          termTotal += amt;
          if (p.payment_date >= weekStart) weekTotal += amt;
          if (p.payment_date >= today) todayTotal += amt;
        });

        setData({
          classAttendance: attendanceByClass,
          atRiskStudents: atRisk,
          smsStats: {
            sentToday: messagesData?.length || 0,
            deliveryRate: messagesData?.length
              ? Math.round(
                  (messagesData.filter((m) => m.status === "delivered").length /
                    messagesData.length) *
                    100,
                )
              : 0,
          },
          pendingExpenses: expCount || 0,
          pendingLeave: leaveCount || 0,
          feesToday: todayTotal,
          feesThisWeek: weekTotal,
          feesThisTerm: termTotal,
          staffOnDuty: staffAttData?.length || 0,
          overdueFeeCount,
          lowAttendanceClasses: Object.values(attendanceByClass).filter(
            (c) => c.total > 0 && c.present / c.total < 0.7,
          ).length,
          dropoutRiskCount: dropoutCount,
          loading: false,
        });
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setData((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchData();
  }, [schoolId, currentTerm, academicYear, students]);

  return data;
}
