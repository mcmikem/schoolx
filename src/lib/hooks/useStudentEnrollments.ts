import { useState, useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { logger } from "@/lib/logger";
import { queueMutation, isOnline } from "@/lib/offline-db";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { withTimeout } from "@/lib/hooks/utils";

interface Enrollment {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  academic_year: string;
  roll_number: string | null;
  enrollment_date: string;
  state: "draft" | "running" | "completed" | "transferred" | "dropped";
  completion_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  student?: {
    first_name: string;
    last_name: string;
    student_number: string;
  };
  class?: {
    name: string;
    level: string;
  };
}

interface UseStudentEnrollmentsOptions {
  studentId?: string;
  classId?: string;
  academicYear?: string;
  state?: string;
}

export function useStudentEnrollments(options: UseStudentEnrollmentsOptions = {}) {
  const { school } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [localEnrollments, setLocalEnrollments] = useState<Enrollment[]>([]);

  const cacheKey = `/api/enrollments/${school?.id}`;
  const cacheParams = useMemo(() => options as Record<string, unknown>, [options]);

  const query = useSupabaseQuery<Enrollment[]>({
    queryKey: [
      "studentEnrollments",
      school?.id,
      options.studentId,
      options.classId,
      options.academicYear,
      options.state,
    ],
    cacheEndpoint: cacheKey,
    cacheParams,
    enabled: Boolean(school?.id),
    queryFn: async () => {
      let query = supabase
        .from("student_enrollments")
        .select("*, student:students(first_name, last_name, student_number), class:classes(name, level)")
        .eq("school_id", school?.id);

      if (options.studentId) query = query.eq("student_id", options.studentId);
      if (options.classId) query = query.eq("class_id", options.classId);
      if (options.academicYear) query = query.eq("academic_year", options.academicYear);
      if (options.state) query = query.eq("state", options.state);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const enrollments = query.data ?? [];
  const { isLoading: loading, isStale } = query;

  useEffect(() => {
    const handleOnline = () => {
      queryClient.invalidateQueries({ queryKey: ["studentEnrollments", school?.id] });
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [queryClient, school?.id]);

  const createEnrollment = useCallback(
    async (enrollment: Partial<Enrollment>) => {
      if (!school?.id) return null;

      if (!isOnline()) {
        const tempId = `temp-${Date.now()}`;
        const offlineEnrollment: Enrollment = {
          id: tempId,
          school_id: school.id,
          student_id: enrollment.student_id || "",
          class_id: enrollment.class_id || "",
          academic_year: enrollment.academic_year || "",
          roll_number: enrollment.roll_number || null,
          enrollment_date: enrollment.enrollment_date || new Date().toISOString(),
          state: enrollment.state || "draft",
          completion_date: null,
          notes: enrollment.notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setLocalEnrollments((prev) => [...prev, offlineEnrollment]);
        await queueMutation({
          endpoint: "enrollments",
          method: "POST",
          body: { enrollment, schoolId: school.id },
        });
        toast.success("Enrollment saved (offline)");
        return offlineEnrollment;
      }

      try {
        const { data, error } = await withTimeout(
          supabase
            .from("student_enrollments")
            .insert({
              school_id: school.id,
              ...enrollment,
            })
            .select()
            .single(),
          15000,
          { data: null, error: { message: "Enrollment creation timed out", code: "TIMEOUT" } } as any,
        );

        if (error) throw error;
        setLocalEnrollments((prev) => [...prev, data]);
        toast.success("Enrollment created");
        return data;
      } catch (err) {
        logger.error("Error creating enrollment:", err);
        toast.error(err instanceof Error ? err.message : "Failed to create enrollment");
        return null;
      }
    },
    [school?.id, toast],
  );

  const updateEnrollment = useCallback(
    async (id: string, updates: Partial<Enrollment>) => {
      try {
        const { data, error } = await withTimeout(
          supabase.from("student_enrollments").update(updates).eq("id", id).select().single(),
          15000,
          { data: null, error: { message: "Enrollment update timed out", code: "TIMEOUT" } } as any,
        );

        if (error) throw error;
        setLocalEnrollments((prev) => prev.map((e) => (e.id === id ? data : e)));
        toast.success("Enrollment updated");
        return data;
      } catch (err) {
        logger.error("Error updating enrollment:", err);
        toast.error(err instanceof Error ? err.message : "Failed to update enrollment");
        return null;
      }
    },
    [toast],
  );

  const updateState = useCallback(
    async (id: string, newState: Enrollment["state"]) => {
      const updates: Partial<Enrollment> = { state: newState };
      if (newState === "completed") {
        updates.completion_date = new Date().toISOString();
      }
      return updateEnrollment(id, updates);
    },
    [updateEnrollment],
  );

  const transferStudent = useCallback(
    async (enrollmentId: string, newClassId: string, newAcademicYear: string) => {
      try {
        const { error } = await withTimeout(
          supabase
            .from("student_enrollments")
            .update({
              state: "transferred",
              completion_date: new Date().toISOString(),
            })
            .eq("id", enrollmentId),
          15000,
          { error: { message: "Transfer timed out", code: "TIMEOUT" } } as any,
        );

        if (error) throw error;

        const newEnrollment = await createEnrollment({
          student_id: enrollments.find((e) => e.id === enrollmentId)?.student_id,
          class_id: newClassId,
          academic_year: newAcademicYear,
          state: "running",
          roll_number: null,
        });

        return newEnrollment;
      } catch (err) {
        logger.error("Error transferring student:", err);
        toast.error(err instanceof Error ? err.message : "Failed to transfer student");
        return null;
      }
    },
    [enrollments, createEnrollment, toast],
  );

  return {
    enrollments: localEnrollments.length > 0 ? localEnrollments : enrollments,
    loading,
    isStale,
    createEnrollment,
    updateEnrollment,
    updateState,
    transferStudent,
  };
}

export default useStudentEnrollments;
