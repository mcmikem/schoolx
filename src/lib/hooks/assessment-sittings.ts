"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";
import { useOnlineStatus } from "@/lib/offline";
import { getQuerySchoolId } from "./utils";

export interface AssessmentSitting {
  id: string;
  school_id: string;
  academic_year: string;
  term: number;
  name: string;
  group_key: string;
  assessment_type: string | null;
  class_id: string | null;
  subject_id: string | null;
  max_score: number;
  weight: number | null;
  scale: string;
  rating_key: string | null;
  reporting_behavior: string;
  is_active: boolean;
  created_at: string;
}

export function useAssessmentSittings(
  schoolId?: string,
  academicYear?: string,
  term?: number,
  classId?: string,
  subjectId?: string,
) {
  const [sittings, setSittings] = useState<AssessmentSitting[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();
  const isOnline = useOnlineStatus();

  const fetchSittings = useCallback(async () => {
    if (!schoolId || !isOnline) {
      setLoading(false);
      return;
    }
    if (isDemo) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const querySchoolId = getQuerySchoolId(schoolId, isDemo);
      if (!querySchoolId) {
        setLoading(false);
        return;
      }
      const params = new URLSearchParams();
      params.set("school_id", querySchoolId);
      if (academicYear) params.set("academic_year", academicYear);
      if (term) params.set("term", String(term));
      if (classId) params.set("class_id", classId);
      if (subjectId) params.set("subject_id", subjectId);
      const res = await fetch(`/api/assessment-sittings/?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch assessment sittings");
      const json = await res.json();
      setSittings((json?.data?.sittings || json?.sittings || []) as AssessmentSitting[]);
    } catch (err) {
      logger.error("Error fetching assessment sittings:", err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, academicYear, term, classId, subjectId, isDemo, isOnline]);

  useEffect(() => {
    fetchSittings();
  }, [fetchSittings]);

  const createSitting = useCallback(
    async (input: Partial<AssessmentSitting>) => {
      if (!schoolId) return null;
      try {
        const res = await fetch("/api/assessment-sittings/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ school_id: schoolId, ...input }),
        });
        if (!res.ok) throw new Error("Failed to create assessment sitting");
        const json = await res.json();
        const sitting = (json?.data?.sitting || json?.sitting) as AssessmentSitting;
        if (sitting) setSittings((prev) => [...prev, sitting]);
        return sitting;
      } catch (err) {
        logger.error("Error creating assessment sitting:", err);
        return null;
      }
    },
    [schoolId],
  );

  return { sittings, loading, refetch: fetchSittings, createSitting };
}
