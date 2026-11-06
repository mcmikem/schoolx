"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { DEMO_STUDENTS } from "@/lib/demo-data";
import { getQuerySchoolId } from "../utils";
import { fetchStudentByIdWithFallback } from "../students";
import type { StudentWithClass } from "../students-helpers";

export function useStudent(id: string) {
  const [student, setStudent] = useState<StudentWithClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDemo, school } = useAuth();

  const fetchStudent = useCallback(async () => {
    if (!id) {
      setStudent(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (isDemo) {
      const demoStudent = DEMO_STUDENTS.find((s) => s.id === id) || DEMO_STUDENTS[0];
      setStudent({
        ...demoStudent,
        classes: { id: "demo-class", name: "P.5", level: "P.5" },
      } as unknown as StudentWithClass);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const querySchoolId = getQuerySchoolId(school?.id, isDemo);
      const data = await fetchStudentByIdWithFallback(id, querySchoolId);
      setStudent(data as StudentWithClass);
    } catch (err: unknown) {
      setStudent(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id, isDemo, school?.id]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  return { student, loading, error, refetch: fetchStudent };
}
