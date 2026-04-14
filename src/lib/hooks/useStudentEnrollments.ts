import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

interface Enrollment {
  id: string;
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

export function useStudentEnrollments(
  options: UseStudentEnrollmentsOptions = {},
) {
  const { school } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const fetchEnrollments = useCallback(async () => {
    if (!school?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from("student_enrollments")
        .select(
          "*, student:students(first_name, last_name, student_number), class:classes(name, level)",
        )
        .eq("school_id", school.id);

      if (options.studentId) {
        query = query.eq("student_id", options.studentId);
      }
      if (options.classId) {
        query = query.eq("class_id", options.classId);
      }
      if (options.academicYear) {
        query = query.eq("academic_year", options.academicYear);
      }
      if (options.state) {
        query = query.eq("state", options.state);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEnrollments(data || []);
    } catch (err) {
      console.error("Error fetching enrollments:", err);
      toast.error("Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  }, [school?.id, options, toast]);

  const createEnrollment = useCallback(
    async (enrollment: Partial<Enrollment>) => {
      if (!school?.id) return null;

      try {
        const { data, error } = await supabase
          .from("student_enrollments")
          .insert({
            school_id: school.id,
            ...enrollment,
          })
          .select()
          .single();

        if (error) throw error;
        setEnrollments((prev) => [...prev, data]);
        toast.success("Enrollment created");
        return data;
      } catch (err) {
        console.error("Error creating enrollment:", err);
        toast.error("Failed to create enrollment");
        return null;
      }
    },
    [school?.id, toast],
  );

  const updateEnrollment = useCallback(
    async (id: string, updates: Partial<Enrollment>) => {
      try {
        const { data, error } = await supabase
          .from("student_enrollments")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        setEnrollments((prev) => prev.map((e) => (e.id === id ? data : e)));
        toast.success("Enrollment updated");
        return data;
      } catch (err) {
        console.error("Error updating enrollment:", err);
        toast.error("Failed to update enrollment");
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
    async (
      enrollmentId: string,
      newClassId: string,
      newAcademicYear: string,
    ) => {
      try {
        const { error } = await supabase
          .from("student_enrollments")
          .update({
            state: "transferred",
            completion_date: new Date().toISOString(),
          })
          .eq("id", enrollmentId);

        if (error) throw error;

        const newEnrollment = await createEnrollment({
          student_id: enrollments.find((e) => e.id === enrollmentId)
            ?.student_id,
          class_id: newClassId,
          academic_year: newAcademicYear,
          state: "running",
          roll_number: null,
        });

        return newEnrollment;
      } catch (err) {
        console.error("Error transferring student:", err);
        toast.error("Failed to transfer student");
        return null;
      }
    },
    [enrollments, createEnrollment, toast],
  );

  return {
    enrollments,
    loading,
    fetchEnrollments,
    createEnrollment,
    updateEnrollment,
    updateState,
    transferStudent,
  };
}

export default useStudentEnrollments;
