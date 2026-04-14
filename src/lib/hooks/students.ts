"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Student, CreateStudentInput, Class } from "@/types";
import { getQuerySchoolId, withTimeout } from "./utils";
import { getCachedData, setCachedData, invalidateCache } from "./queryCache";
import {
  normalizeStudentInput,
  validateStudentInput,
} from "@/lib/validation";

import { DEMO_STUDENTS, DEMO_CLASSES, DemoStudent } from "@/lib/demo-data";
import { isDemoSchool } from "@/lib/demo-utils";
import {
  getFeatureLimit,
  getPlanUsageWarning,
  PlanType,
} from "@/lib/payments/subscription-client";

type StudentWithClass = Student & {
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

export function useStudents(
  schoolId?: string,
  options?: { limit?: number; offset?: number },
) {
  const limit = options?.limit || 100;
  const offset = options?.offset || 0;
  const [students, setStudents] = useState<StudentWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const { isDemo, school } = useAuth();
  const hasInitialized = useRef(false);

  const cacheKey = `students:${schoolId}:${limit}:${offset}`;

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

  const fetchStudents = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || isDemoSchool(schoolId)) {
      setStudents(DEMO_STUDENTS as unknown as StudentWithClass[]);
      setTotalCount(DEMO_STUDENTS.length);
      setLoading(false);
      return;
    }

    if (!schoolId) {
      setLoading(false);
      return;
    }

    const cached = getCachedData<StudentWithClass[]>(cacheKey);
    if (cached && hasInitialized.current) {
      setStudents(cached);
      setLoading(false);
      return;
    }

    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      setLoading(true);
      const { count } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("school_id", querySchoolId);
      setTotalCount(count || 0);
      const data = await withTimeout(
        supabase
          .from("students")
          .select(
            `id, school_id, student_number, first_name, last_name, gender, class_id, status, 
            classes(id, name, level), houses(id, name, color), prefect_role, student_council_role`,
          )
          .eq("school_id", querySchoolId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1)
          .then((r) => {
            if (r.error) throw r.error;
            return r.data;
          }),
        8000,
        null,
      );
      const result = (data as unknown as StudentWithClass[]) || [];
      setStudents(result);
      setCachedData(cacheKey, result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
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
      const maxStudents = getFeatureLimit(
        school.subscription_plan as PlanType,
        "maxStudents",
      );
      if (totalCount >= maxStudents) {
        throw new Error(
          `Student limit reached. Your plan allows ${maxStudents.toLocaleString()} students. Upgrade to add more.`,
        );
      }
    }

    if (isDemo || isDemoSchool(schoolId)) {
      const newId = `demo-student-${Date.now()}`;
      const newStudentData: StudentWithClass = {
        ...normalizedStudent,
        id: newId,
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        student_number:
          normalizedStudent.student_number || `STU-${newId.slice(0, 8)}`,
        status: "active" as const,
        admission_date: new Date().toISOString().split("T")[0],
        created_at: new Date().toISOString(),
        classes: (DEMO_CLASSES.find((c) => c.id === normalizedStudent.class_id) ||
          DEMO_CLASSES[0]) as unknown as Class,
      };
      setStudents((prev) => [newStudentData, ...prev]);
      setTotalCount((prev) => prev + 1);
      invalidateCache(`students:${schoolId}`);
      return newStudentData;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      await assertUniqueStudentNumber(normalizedStudent.student_number);
      const { data, error: insertError } = await supabase
        .from("students")
        .insert({ ...normalizedStudent, school_id: querySchoolId })
        .select(
          `
          id, school_id, student_number, first_name, last_name, gender, 
          date_of_birth, parent_name, parent_phone, class_id, admission_date, status, created_at,
          classes(id, name, level), houses(id, name, color), prefect_role, student_council_role
        `,
        )
        .single();
      if (insertError) throw insertError;
      setStudents((prev) => [data as unknown as StudentWithClass, ...prev]);
      setTotalCount((prev) => prev + 1);
      invalidateCache(`students:${schoolId}`);
      return data as unknown as StudentWithClass;
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    const normalizedUpdates = normalizeStudentInput(updates);
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
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? updatedStudent : s)),
      );
      return updatedStudent;
    }
    try {
      await assertUniqueStudentNumber(normalizedUpdates.student_number, id);
      const { data, error: updateError } = await supabase
        .from("students")
        .update(normalizedUpdates)
        .eq("id", id)
        .select(
          `
          id, school_id, student_number, first_name, last_name, gender, 
          date_of_birth, parent_name, parent_phone, class_id, admission_date, status, created_at,
          classes(id, name, level), houses(id, name, color), prefect_role, student_council_role
        `,
        )
        .single();
      if (updateError) throw updateError;
      setStudents((prev) =>
        prev.map((s) =>
          s.id === id ? (data as unknown as StudentWithClass) : s,
        ),
      );
      invalidateCache(`students:${schoolId}`);
      return data as unknown as StudentWithClass;
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const deleteStudent = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setTotalCount((prev) => prev - 1);
      return;
    }
    try {
      const { error: deleteError } = await supabase
        .from("students")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setTotalCount((prev) => prev - 1);
      invalidateCache(`students:${schoolId}`);
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : "Unknown error");
    }
  };

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
  const { isDemo } = useAuth();

  useEffect(() => {
    async function fetchStudent() {
      if (!id) return;

      // Demo mode - use demo data
      if (isDemo) {
        const demoStudent =
          DEMO_STUDENTS.find((s) => s.id === id) || DEMO_STUDENTS[0];
        setStudent({
          ...demoStudent,
          classes: { id: "demo-class", name: "P.5", level: "P.5" },
        } as unknown as StudentWithClass);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("students")
          .select(
            `
            *,
            classes(id, name, level), houses(id, name, color), prefect_role, student_council_role
          `,
          )
          .eq("id", id)
          .single();
        if (error) throw error;
        setStudent(data as unknown as StudentWithClass);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchStudent();
  }, [id, isDemo]);

  return { student, loading, error };
}

export function useClasses(schoolId?: string) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();

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
    try {
      setLoading(true);
      const data = await withTimeout(
        supabase
          .from("classes")
          .select("id, name, level, school_id, created_at")
          .eq("school_id", querySchoolId)
          .order("name")
          .then((r) => {
            if (r.error) throw r.error;
            return r.data;
          }),
        5000,
        [] as unknown as Class[],
      );
      setClasses((data as unknown as Class[]) || []);
    } catch (err) {
      console.warn("Classes fetch error:", err);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo]);

  const createClass = async (newClass: Partial<Class>) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const demoClass: Class = {
        id: `demo-class-${Date.now()}`,
        name: newClass.name || "Unknown Class",
        level: newClass.level || "Primary",
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        max_students: newClass.max_students || 50,
        academic_year:
          newClass.academic_year || new Date().getFullYear().toString(),
        created_at: new Date().toISOString(),
      };
      setClasses((prev) => [...prev, demoClass]);
      return demoClass;
    }

    try {
      const { data, error } = await supabase
        .from("classes")
        .insert({ ...newClass, school_id: schoolId })
        .select()
        .single();
      if (error) throw error;
      setClasses((prev) => [...prev, data as Class]);
      return data as Class;
    } catch (err) {
      throw err;
    }
  };

  const updateClass = async (id: string, updates: Partial<Class>) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setClasses((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      );
      return { id, ...updates } as Class;
    }

    try {
      const { data, error } = await supabase
        .from("classes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      setClasses((prev) =>
        prev.map((c) => (c.id === id ? (data as Class) : c)),
      );
      return data as Class;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);
  return { classes, loading, createClass, updateClass, refetch: fetchClasses };
}
