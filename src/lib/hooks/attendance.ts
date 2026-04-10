"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getQuerySchoolId } from "./utils";
import { triggerAutomationEvent } from "../automation-engine";
import { DEMO_ATTENDANCE, DemoAttendance } from "@/lib/demo-data";
import { isDemoSchool } from "@/lib/demo-utils";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import {
  logAuditEventWithOfflineSupport,
  logRecordChangeWithOfflineSupport,
} from "@/lib/audit";

export function useAttendance(classId?: string, date?: string) {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo, user, school } = useAuth();
  const isOnline = useOnlineStatus();

  const markAttendance = async (
    studentId: string,
    status: string,
    recordedBy?: string,
  ) => {
    const currentDate = date || new Date().toISOString().split("T")[0];
    if (isDemo) {
      const newRecord = {
        student_id: studentId,
        class_id: classId,
        date: currentDate,
        status,
        recorded_by: recordedBy,
        id: `demo-att-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      setAttendance((prev) => {
        const existing = prev.findIndex((a) => a.student_id === studentId);
        if (existing >= 0) {
          const u = [...prev];
          u[existing] = newRecord;
          return u;
        }
        return [...prev, newRecord];
      });
      return newRecord;
    }
    const payload = {
      student_id: studentId,
      class_id: classId,
      date: currentDate,
      status,
      recorded_by: recordedBy,
    };
    const previousRecord = attendance.find((a) => a.student_id === studentId);

    if (!isOnline) {
      const offlineSaved = await offlineDB.save(
        "attendance",
        payload as unknown as Record<string, unknown>,
      );
      const newRecord = {
        ...payload,
        id: String(offlineSaved.id || `offline-att-${Date.now()}`),
        created_at: new Date().toISOString(),
      };
      setAttendance((prev) => {
        const existing = prev.findIndex((a) => a.student_id === studentId);
        if (existing >= 0) {
          const u = [...prev];
          u[existing] = newRecord;
          return u;
        }
        return [...prev, newRecord];
      });
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          false,
          school.id,
          user.id,
          user.full_name,
          "update",
          "attendance",
          `Queued offline attendance as ${status}`,
          studentId,
          previousRecord,
          payload as Record<string, unknown>,
        );
      }
      return newRecord;
    }
    try {
      const { data, error } = await supabase
        .from("attendance")
        .upsert(payload, { onConflict: "student_id,date" })
        .select(
          "id, student_id, class_id, date, status, remarks, recorded_by, created_at",
        )
        .single();
      if (error) throw error;
      setAttendance((prev) => {
        const existing = prev.findIndex((a) => a.student_id === studentId);
        if (existing >= 0) {
          const u = [...prev];
          u[existing] = data;
          return u;
        }
        return [...prev, data];
      });
      if (school?.id && user?.id) {
        if (previousRecord) {
          await logRecordChangeWithOfflineSupport(
            true,
            school.id,
            user.id,
            user.full_name,
            "attendance",
            "Updated attendance record",
            previousRecord,
            data,
            data.id,
          );
        } else {
          await logAuditEventWithOfflineSupport(
            true,
            school.id,
            user.id,
            user.full_name,
            "create",
            "attendance",
            "Created attendance record",
            data.id,
            undefined,
            data,
          );
        }
      }
      triggerAutomationEvent(school?.id, "student_absent", payload);
      await offlineDB.cacheFromServer("attendance", [
        data as unknown as Record<string, unknown>,
      ]);
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    async function fetchAttendance() {
      if (isDemo) {
        setAttendance(DEMO_ATTENDANCE as unknown as DemoAttendance[]);
        setLoading(false);
        return;
      }
      if (!classId || !date) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (!isOnline) {
          const cached = await offlineDB.getAllFromCache("attendance", {
            class_id: classId,
            date,
          });
          setAttendance(cached as unknown as DemoAttendance[]);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("attendance")
          .select(
            "id, student_id, class_id, date, status, remarks, recorded_by, created_at",
          )
          .eq("class_id", classId)
          .eq("date", date);
        if (error) throw error;
        setAttendance(data || []);
        await offlineDB.cacheFromServer(
          "attendance",
          (data || []) as unknown as Record<string, unknown>[],
        );
      } catch (err) {
        console.error("Error fetching attendance:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAttendance();
  }, [classId, date, isDemo, isOnline]);

  return { attendance, loading, markAttendance };
}

export function useAttendanceHistory(schoolId?: string) {
  const [loading, setLoading] = useState(false);

  const getConsecutiveAbsentStudents = useCallback(async () => {
    if (!schoolId) return [];
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select(
          `
          student_id, date, status, 
          students!inner(id, first_name, last_name, class_id, school_id, status, classes(name))
        `,
        )
        .eq("students.school_id", schoolId)
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("date", { ascending: false });

      if (error) throw error;

      const studentAttendance: Record<
        string,
        { dates: string[]; statuses: Record<string, string>; student: any }
      > = {};
      attendanceData?.forEach((record: any) => {
        const sid = record.student_id;
        if (!studentAttendance[sid])
          studentAttendance[sid] = {
            dates: [],
            statuses: {},
            student: record.students,
          };
        studentAttendance[sid].dates.push(record.date);
        studentAttendance[sid].statuses[record.date] = record.status;
      });

      const atRiskStudents: Array<{
        student: any;
        consecutiveAbsent: number;
        lastAttendanceDate: string | null;
        riskLevel: "at_risk" | "likely_dropout";
      }> = [];

      for (const [, data] of Object.entries(studentAttendance)) {
        if (data.student?.status !== "active") continue;
        const sortedDates = data.dates.sort().reverse();
        let consecutiveAbsent = 0;
        let lastAttendanceDate: string | null = null;
        for (const date of sortedDates) {
          if (data.statuses[date] === "absent") {
            consecutiveAbsent++;
          } else {
            lastAttendanceDate = date;
            break;
          }
        }
        if (consecutiveAbsent >= 14) {
          atRiskStudents.push({
            student: data.student,
            consecutiveAbsent,
            lastAttendanceDate,
            riskLevel: consecutiveAbsent >= 30 ? "likely_dropout" : "at_risk",
          });
        }
      }
      return atRiskStudents.sort(
        (a, b) => b.consecutiveAbsent - a.consecutiveAbsent,
      );
    } catch (err) {
      console.error("Error fetching attendance history:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  return { getConsecutiveAbsentStudents, loading };
}

export function useStaffAttendance(schoolId?: string, date?: string) {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();

  const markAttendance = async (
    staffId: string,
    status: string,
    remarks?: string,
  ) => {
    const currentDate = date || new Date().toISOString().split("T")[0];
    if (isDemo || isDemoSchool(schoolId)) {
      const newRecord = {
        staff_id: staffId,
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        date: currentDate,
        status,
        remarks,
        id: `demo-staff-att-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      setAttendance((prev) => [...prev, newRecord]);
      return newRecord;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      const { data, error } = await supabase
        .from("staff_attendance")
        .upsert(
          {
            staff_id: staffId,
            school_id: querySchoolId,
            date: currentDate,
            status,
            remarks,
          },
          { onConflict: "staff_id,date" },
        )
        .select("id, staff_id, school_id, date, status, remarks, created_at")
        .single();
      if (error) throw error;
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    async function fetchAttendance() {
      if (!schoolId || !date) {
        setLoading(false);
        return;
      }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo);
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("staff_attendance")
          .select(
            "id, staff_id, school_id, date, status, remarks, created_at, users!staff_id(id, full_name, phone)",
          )
          .eq("school_id", querySchoolId)
          .eq("date", date);
        if (error) throw error;
        setAttendance(data || []);
      } catch (err) {
        console.error("Error fetching staff attendance:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAttendance();
  }, [schoolId, date, isDemo]);

  return { attendance, loading, markAttendance };
}
