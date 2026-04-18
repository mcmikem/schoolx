"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Student, CreateStudentInput, Class, School } from "@/types";
import { getQuerySchoolId, withTimeout } from "./utils";
import { getCachedData, setCachedData, invalidateCache } from "./queryCache";
import {
  getErrorMessage,
  normalizeStudentInput,
  validateStudentInput,
} from "@/lib/validation";

import { DEMO_STUDENTS, DEMO_CLASSES, DemoStudent } from "@/lib/demo-data";
import { isDemoSchool } from "@/lib/demo-utils";
import {
  getFeatureLimit,
  getPlanUsageWarning,
  PlanType,
  normalizePlanType,
} from "@/lib/payments/subscription-client";
import { buildDefaultClasses, type SchoolSetupType } from "@/lib/school-setup";

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

const STUDENT_SELECT_FIELDS = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone, parent_phone2, parent_email, address,
  class_id, admission_date, ple_index_number, blood_type, religion, nationality,
  photo_url, status, opening_balance, transfer_from, transfer_to, transfer_reason,
  dropout_reason, dropout_date, repeating, last_attendance_date,
  consecutive_absent_days, created_at, house_id, previous_school, district_origin,
  sub_county, parish, village, boarding_status, games_house, is_class_monitor,
  prefect_role, student_council_role,
  classes(id, name, level, stream), houses(id, name, color)
`;

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
    status: student.status,
  }
}

const STUDENT_SELECT_FIELDS_FALLBACK = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone, parent_phone2,
  class_id, admission_date, ple_index_number, status, opening_balance,
  created_at, classes(id, name, level, stream)
`;

const STUDENT_SELECT_FIELDS_CORE = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone, parent_phone2,
  class_id, admission_date, ple_index_number, status,
  created_at, classes(id, name, level)
`;

const STUDENT_SELECT_FIELDS_MINIMAL = `
  id, school_id, student_number, first_name, last_name, gender,
  date_of_birth, parent_name, parent_phone, parent_phone2,
  class_id, admission_date, ple_index_number, status, created_at
`;

async function fetchStudentsWithFallback(options: {
  schoolId: string;
  offset: number;
  limit: number;
}) {
  const selectAttempts = [
    {
      fields: STUDENT_SELECT_FIELDS,
      label: "extended student select",
    },
    {
      fields: STUDENT_SELECT_FIELDS_FALLBACK,
      label: "fallback student select",
    },
    {
      fields: STUDENT_SELECT_FIELDS_CORE,
      label: "core student select",
    },
    {
      fields: STUDENT_SELECT_FIELDS_MINIMAL,
      label: "minimal student select",
    },
  ];

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

    lastError = result.error;
    console.warn(`${attempt.label} failed, trying a smaller shape:`, result.error);
  }

  throw lastError;
}

async function fetchStudentByIdWithFallback(studentId: string) {
  const selectAttempts = [
    {
      fields: STUDENT_SELECT_FIELDS,
      label: "extended student fetch",
    },
    {
      fields: STUDENT_SELECT_FIELDS_FALLBACK,
      label: "fallback student fetch",
    },
    {
      fields: STUDENT_SELECT_FIELDS_CORE,
      label: "core student fetch",
    },
    {
      fields: STUDENT_SELECT_FIELDS_MINIMAL,
      label: "minimal student fetch",
    },
  ];

  let lastError: unknown = null;

  for (const attempt of selectAttempts) {
    const result = await supabase
      .from("students")
      .select(attempt.fields)
      .eq("id", studentId)
      .single();

    if (!result.error && result.data) {
      return result.data as unknown as StudentWithClass;
    }

    lastError = result.error;
    console.warn(`${attempt.label} failed, trying a smaller shape:`, result.error);
  }

  throw lastError;
}

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

  const generateUniqueStudentNumber = useCallback(async () => {
    const year = new Date().getFullYear();
    let counter = totalCount + 1;

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `SM/${year}/${String(counter).padStart(4, "0")}`;
      try {
        await assertUniqueStudentNumber(candidate);
        return candidate;
      } catch {
        counter += 1;
      }
    }

    return `SM/${year}/${Date.now().toString().slice(-6)}`;
  }, [assertUniqueStudentNumber, totalCount]);

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
    if (!querySchoolId) {
      setLoading(false);
      setError("School context is missing. Please reload and try again.");
      return;
    }

    try {
      setLoading(true);
      const { count } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("school_id", querySchoolId);
      setTotalCount(count || 0);
      const data = await withTimeout(
        fetchStudentsWithFallback({
          schoolId: querySchoolId,
          offset,
          limit,
        }),
        8000,
        null,
      );
      const result = (data as unknown as StudentWithClass[]) || [];
      setStudents(result);
      setCachedData(cacheKey, result);
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
      const maxStudents =
        typeof plan === "string"
          ? getFeatureLimit(plan, "maxStudents")
          : 999999;
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
        classes: (DEMO_CLASSES.find(
          (c) => c.id === normalizedStudent.class_id,
        ) || DEMO_CLASSES[0]) as unknown as Class,
      };
      setStudents((prev) => [newStudentData, ...prev]);
      setTotalCount((prev) => prev + 1);
      invalidateCache(`students:${schoolId}`);
      return newStudentData;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    if (!querySchoolId) {
      throw new Error("School context is missing. Please reload and try again.");
    }

    try {
      const studentPayload = {
        ...normalizedStudent,
        school_id: querySchoolId,
        student_number:
          normalizedStudent.student_number ||
          (await generateUniqueStudentNumber()),
      };

      await assertUniqueStudentNumber(studentPayload.student_number);

      let createdRow: { id: string } | null = null;

      const firstInsert = await supabase
        .from("students")
        .insert(studentPayload)
        .select("id")
        .single();

      if (firstInsert.error) {
        console.warn("Student insert failed with extended payload, retrying core fields:", firstInsert.error);

        const retryInsert = await supabase
          .from("students")
          .insert(buildCoreStudentPayload(studentPayload as Record<string, unknown>))
          .select("id")
          .single();

        if (retryInsert.error) throw retryInsert.error;
        createdRow = retryInsert.data;
      } else {
        createdRow = firstInsert.data;
      }

      let createdStudent: StudentWithClass | null = null;

      try {
        createdStudent = await fetchStudentByIdWithFallback(createdRow.id);
      } catch (fetchError: unknown) {
        console.warn(
          "Student was inserted but could not be re-fetched with current schema shape:",
          fetchError,
        );

        createdStudent = {
          ...(studentPayload as StudentWithClass),
          id: createdRow.id,
          admission_date: new Date().toISOString().split("T")[0],
          created_at: new Date().toISOString(),
          opening_balance:
            typeof studentPayload.opening_balance === "number"
              ? studentPayload.opening_balance
              : 0,
        } as StudentWithClass;
      }

      setStudents((prev) => [createdStudent as StudentWithClass, ...prev]);
      setTotalCount((prev) => prev + 1);
      invalidateCache(`students:${schoolId}`);
      return createdStudent as StudentWithClass;
    } catch (err: unknown) {
      throw new Error(getErrorMessage(err, "Failed to add student"));
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
      const firstUpdate = await supabase
        .from("students")
        .update(normalizedUpdates)
        .eq("id", id)
        .select(STUDENT_SELECT_FIELDS)
        .single();

      let updatedStudent: StudentWithClass | null = null;

      if (firstUpdate.error) {
        console.warn("Student update failed with extended payload, retrying core fields:", firstUpdate.error);

        const retryUpdate = await supabase
          .from("students")
          .update(buildCoreStudentPayload(normalizedUpdates as Record<string, unknown>))
          .eq("id", id)
          .select(STUDENT_SELECT_FIELDS_MINIMAL)
          .single();

        if (retryUpdate.error) throw retryUpdate.error;
        updatedStudent = retryUpdate.data as unknown as StudentWithClass;
      } else {
        updatedStudent = firstUpdate.data as unknown as StudentWithClass;
      }

      setStudents((prev) =>
        prev.map((s) => (s.id === id ? (updatedStudent as StudentWithClass) : s)),
      );
      invalidateCache(`students:${schoolId}`);
      return updatedStudent as StudentWithClass;
    } catch (err: unknown) {
      throw new Error(getErrorMessage(err, "Failed to update student"));
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
      throw new Error(getErrorMessage(err, "Failed to remove student"));
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
  const { isDemo, school } = useAuth();
  const autoProvisionAttempted = useRef(false);

  const autoProvisionDefaultClasses = useCallback(
    async (resolvedSchoolId: string) => {
      const schoolType =
        ((school as School | null)?.school_type ?? "primary") as SchoolSetupType;
      const currentYear = new Date().getFullYear().toString();
      const defaultClasses = buildDefaultClasses(
        resolvedSchoolId,
        schoolType,
        currentYear,
      );

      const { error } = await supabase
        .from("classes")
        .upsert(defaultClasses, {
          onConflict: "school_id,name,academic_year",
        });

      if (error) throw error;

      const { data, error: refetchError } = await supabase
        .from("classes")
        .select("id, name, level, school_id, created_at, stream, academic_year")
        .eq("school_id", resolvedSchoolId)
        .order("name");

      if (refetchError) throw refetchError;

      return (data as unknown as Class[]) || [];
    },
    [school],
  );

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
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, level, school_id, created_at, stream, academic_year")
        .eq("school_id", querySchoolId)
        .order("name");

      if (error) throw error;

      if ((data?.length || 0) === 0 && !autoProvisionAttempted.current) {
        autoProvisionAttempted.current = true;
        const provisionedClasses = await autoProvisionDefaultClasses(
          querySchoolId,
        );
        setClasses(provisionedClasses);
        return;
      }

      setClasses((data as unknown as Class[]) || []);
    } catch (err) {
      console.warn("Classes fetch error:", err);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo, autoProvisionDefaultClasses]);

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
