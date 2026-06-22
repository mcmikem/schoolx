"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getQuerySchoolId, withTimeout } from "./utils";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { triggerAutomationEvent } from "../automation-engine";
import { DEMO_ATTENDANCE, DemoAttendance } from "@/lib/demo-data";
import { isDemoSchool } from "@/lib/demo-utils";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import {
  logAuditEventWithOfflineSupport,
  logRecordChangeWithOfflineSupport,
} from "@/lib/audit";
import { logger } from "@/lib/logger";
import {
  normalizeAttendanceInput,
  validateAttendanceInput,
} from "@/lib/validation";

export function useAttendance(classId?: string, date?: string) {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDemo, user, school } = useAuth();
  const isOnline = useOnlineStatus();
  const hasInitialized = useRef(false);
  const prevIsDemo = useRef(isDemo);

  useEffect(() => {
    if (prevIsDemo.current && !isDemo) {
      setAttendance([]);
      setLoading(true);
      setError(null);
      hasInitialized.current = false;
    }
    prevIsDemo.current = isDemo;
  }, [isDemo]);

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
    const payload = normalizeAttendanceInput({
      student_id: studentId,
      class_id: classId,
      date: currentDate,
      status,
      recorded_by: recordedBy,
    });
    const validationErrors = validateAttendanceInput(payload);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors[0]);
    }
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
      const { data, error } = await withTimeout(
        supabase
          .from("attendance")
          .upsert(payload, { onConflict: "student_id,date" })
          .select(
            "id, student_id, class_id, date, status, remarks, recorded_by, created_at",
          )
          .single(),
        15000,
        { data: null, error: { message: "Attendance save timed out", name: "TimeoutError", details: "", hint: "", code: "" }, count: null as number | null, status: 408, statusText: "Timeout", success: false } as unknown as PostgrestSingleResponse<Record<string, unknown>>,
      );
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
            (data as { id: string }).id,
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
            (data as { id: string }).id,
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
        logger.error("Error fetching attendance:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchAttendance();
  }, [classId, date, isDemo, isOnline]);

  return { attendance, loading, error, markAttendance };
}

export function useAttendanceHistory(
  schoolId?: string,
  academicYear?: string,
  options?: { limit?: number },
) {
  const limit = options?.limit || 5000;
  const [loading, setLoading] = useState(false);

  const getConsecutiveAbsentStudents = useCallback(async () => {
    if (!schoolId) return [];
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = academicYear
        ? `${academicYear}-01-01`
        : thirtyDaysAgo.toISOString().split("T")[0];
      const endDate = academicYear
        ? `${academicYear}-12-31`
        : new Date().toISOString().split("T")[0];

      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select(
          `
          student_id, date, status, 
          students!inner(id, first_name, last_name, class_id, school_id, status, classes(name))
        `,
        )
        .eq("students.school_id", schoolId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false })
        .limit(limit);

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
      logger.error("Error fetching attendance history:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [schoolId, academicYear, limit]);

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
const { data, error } = await withTimeout(
         supabase
           .from("staff_attendance")
           .upsert(
             {
               staff_id: staffId,
               date: currentDate,
               status,
               remarks,
             },
             { onConflict: "staff_id,date" },
           )
           .select("id, staff_id, date, status, remarks, created_at")
           .single(),
         15000,
          { data: null, error: { message: "Staff attendance save timed out", name: "TimeoutError", details: "", hint: "", code: "" }, count: null as number | null, status: 408, statusText: "Timeout", success: false } as unknown as PostgrestSingleResponse<Record<string, unknown>>,
       );
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
            "id, staff_id, date, status, remarks, created_at, users!staff_id(id, full_name, phone, school_id)",
          )
          .eq("users.school_id", querySchoolId)
          .eq("date", date);
        if (error) throw error;
        setAttendance(data || []);
      } catch (err) {
        logger.error("Error fetching staff attendance:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAttendance();
  }, [schoolId, date, isDemo]);

  return { attendance, loading, markAttendance };
}

export function usePeriodAttendance(
  classId?: string,
  date?: string,
  period?: string,
) {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { school } = useAuth();
  const isOnline = useOnlineStatus();

  const fetchData = useCallback(async () => {
    if (!classId || !date || !period || !school?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      if (!isOnline) {
        const cachedStudents = await offlineDB.getAllFromCache("students", {
          school_id: school.id,
          class_id: classId,
          status: "active",
        });
        setStudents(cachedStudents as unknown as any[]);
        const cachedAtt = await offlineDB.getAllFromCache("period_attendance", {
          class_id: classId,
          date,
          period,
        });
        setAttendance(cachedAtt as unknown as any[]);
        setLoading(false);
        return;
      }
      const { data: studentData } = await supabase
        .from("students")
        .select("id, first_name, last_name, student_number")
        .eq("school_id", school.id)
        .eq("class_id", classId)
        .eq("status", "active")
        .order("first_name");
      setStudents(studentData || []);
      await offlineDB.cacheFromServer(
        "students",
        (studentData || []) as unknown as Record<string, unknown>[],
      );

      const { data: attData } = await supabase
        .from("period_attendance")
        .select("*")
        .eq("class_id", classId)
        .eq("date", date)
        .eq("period", period);
      setAttendance(attData || []);
      await offlineDB.cacheFromServer(
        "period_attendance",
        (attData || []) as unknown as Record<string, unknown>[],
      );
    } catch (err) {
      logger.error("Error fetching period attendance:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [classId, date, period, school?.id, isOnline]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markAttendance = async (studentId: string, status: string) => {
    const payload = {
      school_id: school?.id,
      student_id: studentId,
      class_id: classId,
      date,
      period,
      status,
    };
    setAttendance((prev) => {
      const existing = prev.findIndex((a) => a.student_id === studentId);
      if (existing >= 0) {
        const u = [...prev];
        u[existing] = { ...u[existing], ...payload };
        return u;
      }
      return [...prev, payload];
    });
    if (!isOnline) {
      await offlineDB.save(
        "period_attendance",
        payload as unknown as Record<string, unknown>,
      );
    } else {
      try {
        const { error: upsertError } = await supabase
          .from("period_attendance")
          .upsert(payload, { onConflict: "student_id,date,period" });
        if (upsertError) throw upsertError;
        await offlineDB.cacheFromServer("period_attendance", [
          payload as unknown as Record<string, unknown>,
        ]);
      } catch {
        await offlineDB.save(
          "period_attendance",
          payload as unknown as Record<string, unknown>,
        );
      }
    }
  };

  return { attendance, students, loading, error, markAttendance, refetch: fetchData };
}

export function useDormAttendance(
  dormId?: string,
  date?: string,
  checkType?: string,
) {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [dorms, setDorms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { school } = useAuth();
  const isOnline = useOnlineStatus();

  const fetchDorms = useCallback(async () => {
    if (!school?.id) return;
    if (!isOnline) {
      const cached = await offlineDB.getAllFromCache("dorms", {
        school_id: school.id,
      });
      setDorms(cached as unknown as any[]);
      return;
    }
    const { data } = await supabase
      .from("dorms")
      .select("*")
      .eq("school_id", school.id);
    setDorms(data || []);
    await offlineDB.cacheFromServer(
      "dorms",
      (data || []) as unknown as Record<string, unknown>[],
    );
  }, [school?.id, isOnline]);

  const fetchData = useCallback(async () => {
    if (!dormId || !date || !checkType) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      if (!isOnline) {
        const cachedStudents = await offlineDB.getAllFromCache("dorm_students", {
          dorm_id: dormId,
        });
        const studentList = cachedStudents.map((ds: any) => ds.students).filter(Boolean);
        setStudents(studentList);
        const cachedAtt = await offlineDB.getAllFromCache("dorm_attendance", {
          dorm_id: dormId,
          date,
          check_type: checkType,
        });
        setAttendance(cachedAtt as unknown as any[]);
        setLoading(false);
        return;
      }
      const { data: dormStudents } = await supabase
        .from("dorm_students")
        .select("student_id, students(*)")
        .eq("dorm_id", dormId);
      const studentList = dormStudents?.map((ds: any) => ds.students) || [];
      setStudents(studentList);
      await offlineDB.cacheFromServer(
        "dorm_students",
        (dormStudents || []) as unknown as Record<string, unknown>[],
      );

      const { data: attData } = await supabase
        .from("dorm_attendance")
        .select("*")
        .eq("dorm_id", dormId)
        .eq("date", date)
        .eq("check_type", checkType);
      setAttendance(attData || []);
      await offlineDB.cacheFromServer(
        "dorm_attendance",
        (attData || []) as unknown as Record<string, unknown>[],
      );
    } catch (err) {
      logger.error("Error fetching dorm attendance:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [dormId, date, checkType, isOnline]);

  useEffect(() => {
    if (school?.id) fetchDorms();
  }, [fetchDorms, school?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markAttendance = async (studentId: string, status: string, extras?: Record<string, any>) => {
    setAttendance((prev) => {
      const existing = prev.findIndex((a) => a.student_id === studentId);
      const payload = { student_id: studentId, status, ...extras };
      if (existing >= 0) {
        const u = [...prev];
        u[existing] = { ...u[existing], ...payload };
        return u;
      }
      return [...prev, payload];
    });
    const payload = {
      dorm_id: dormId,
      student_id: studentId,
      date,
      check_type: checkType,
      status,
      ...extras,
    };
    if (!isOnline) {
      await offlineDB.save(
        "dorm_attendance",
        payload as unknown as Record<string, unknown>,
      );
    } else {
      try {
        const { error: upsertError } = await supabase
          .from("dorm_attendance")
          .upsert(payload, { onConflict: "student_id,dorm_id,date,check_type" });
        if (upsertError) throw upsertError;
        await offlineDB.cacheFromServer("dorm_attendance", [
          payload as unknown as Record<string, unknown>,
        ]);
      } catch {
        await offlineDB.save(
          "dorm_attendance",
          payload as unknown as Record<string, unknown>,
        );
      }
    }
  };

  return { attendance, students, dorms, loading, error, markAttendance, refetch: fetchData };
}
