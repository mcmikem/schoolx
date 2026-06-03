/**
 * React hooks for Syllabus Tracker and Auto Lesson Planner
 */

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withTimeout } from "@/lib/hooks/utils";
import type {
  SyllabusTimelineEntry,
  AutoPlannerConfig,
} from "@/lib/syllabus-planner-utils";
import {
  calculateTermDates,
  distributeTopicsAcrossWeeks,
  calculateSyllabusProgress,
} from "@/lib/syllabus-planner-utils";

export interface SyllabusWithTimeline {
  id: string;
  topic: string;
  subtopics: string[] | null;
  objectives: string | null;
  weeks_covered: string | null;
  resources: string | null;
  status: string;
  timeline?: SyllabusTimelineEntry[];
  progress?: { overall_percentage: number; weeks_completed: number; weeks_total: number; on_track: boolean };
}

export interface TopicPerformance {
  id: string;
  topic: string;
  average_score?: number;
  mastery_level: "beginner" | "developing" | "proficient" | "advanced";
  students_below_50: number;
  student_count: number;
  students_above_75: number;
  students_50_to_75: number;
  common_misconceptions?: string;
  differentiation_needed?: string;
  revision_required: boolean;
}

export function useSyllabusTracker(
  schoolId: string | undefined,
  classId: string | undefined,
  subjectId: string | undefined,
  termNumber: number | string = 1,
  academicYear: string = new Date().getFullYear().toString()
) {
  const [syllabi, setSyllabi] = useState<SyllabusWithTimeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSyllabusWithTimeline = useCallback(async () => {
    if (!schoolId || !classId || !subjectId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch syllabus topics
      const { data: syllabusData, error: syllabusError } = await withTimeout(
        supabase
          .from("syllabus")
          .select("*")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .eq("subject_id", subjectId)
          .eq("term", termNumber)
          .eq("academic_year", academicYear),
        5000,
        { data: null, error: null } as any
      );

      if (syllabusError) throw syllabusError;

      // Fetch timeline for each syllabus
      const syllabusIds = (syllabusData || []).map((s: any) => s.id) || [];

      if (syllabusIds.length === 0) {
        setSyllabi([]);
        return;
      }

      const { data: timelineData, error: timelineError } = await withTimeout<any>(
        supabase
          .from("syllabus_timeline")
          .select("*")
          .in("syllabus_id", syllabusIds)
          .eq("term", termNumber)
          .eq("academic_year", academicYear)
          .order("week_number", { ascending: true }),
        5000,
        { data: null, error: null } as any
      );

      if (timelineError) throw timelineError;

      // Combine data
      const combined = (syllabusData || []).map((syl: any) => {
        const timeline =
          (timelineData || []).filter((t: any) => t.syllabus_id === syl.id) || [];
        const progress = calculateSyllabusProgress(timeline);

        return {
          ...syl,
          timeline,
          progress,
        };
      });

      setSyllabi(combined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch syllabus");
      logger.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId, subjectId, termNumber, academicYear]);

  useEffect(() => {
    fetchSyllabusWithTimeline();
  }, [fetchSyllabusWithTimeline]);

  return {
    syllabi,
    loading,
    error,
    refetch: fetchSyllabusWithTimeline,
  };
}

export function useTopicPerformance(
  schoolId: string | undefined,
  classId: string | undefined,
  subjectId: string | undefined,
  termNumber: number | string = 1,
  academicYear: string = new Date().getFullYear().toString()
) {
  const [performance, setPerformance] = useState<TopicPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (!schoolId || !classId || !subjectId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await withTimeout(
        supabase
          .from("topic_performance")
          .select("*")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .eq("subject_id", subjectId)
          .eq("term", termNumber)
          .eq("academic_year", academicYear)
          .order("created_at", { ascending: false }),
        5000,
        { data: null, error: null } as any
      );

      if (err) throw err;
      setPerformance((data || []) as TopicPerformance[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch performance");
      logger.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId, subjectId, termNumber, academicYear]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  return {
    performance,
    loading,
    error,
    refetch: fetchPerformance,
  };
}

export function useAutoPlannerConfig(schoolId: string | undefined) {
  const [config, setConfig] = useState<Partial<AutoPlannerConfig>>({
    enable_ai_generation: false,
    enable_weekly_distribution: true,
    enable_smart_scheduling: true,
    lessons_per_week_target: 2,
    account_for_holidays: true,
    account_for_exams: true,
    ai_provider: "rules_based",
    ai_temperature: 0.7,
    default_lesson_duration: 40,
    include_homework: true,
    include_assessment: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!schoolId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await withTimeout(
        supabase
          .from("auto_planner_config")
          .select("*")
          .eq("school_id", schoolId)
          .maybeSingle(),
        5000,
        { data: null, error: null } as any
      );

      if (err && err.code !== "PGRST116") throw err; // PGRST116 = no rows

      if (data) {
        setConfig(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch config");
      logger.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const updateConfig = useCallback(
    async (updates: Partial<AutoPlannerConfig>) => {
      if (!schoolId) return;

      try {
        // Upsert config
        const { data, error: err } = await withTimeout(
          supabase
            .from("auto_planner_config")
            .upsert(
              {
                school_id: schoolId,
                ...config,
                ...updates,
              },
              { onConflict: "school_id" }
            )
            .select()
            .single(),
          5000,
          { data: null, error: null } as any
        );

        if (err) throw err;
        setConfig(data || {});
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update config";
        setError(message);
        throw err;
      }
    },
    [schoolId, config]
  );

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    loading,
    error,
    updateConfig,
    refetch: fetchConfig,
  };
}

export function useLessonPlanGeneration(schoolId: string | undefined) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerationId, setLastGenerationId] = useState<string | null>(null);

  const generateLessonPlans = useCallback(
    async (params: {
      syllabusIds: string[];
      classId: string;
      subjectId: string;
      teacherId?: string;
      termNumber: number;
      academicYear: string;
      useAI: boolean;
    }) => {
      if (!schoolId) return null;

      setGenerating(true);
      setError(null);

      try {
        // Create generation record
        const { data: generationRecord, error: genError } = await withTimeout(
          supabase
            .from("lesson_plan_generations")
            .insert({
              school_id: schoolId,
              subject_id: params.subjectId,
              class_id: params.classId,
              teacher_id: params.teacherId,
              syllabus_id: params.syllabusIds[0],
              term: params.termNumber,
              academic_year: params.academicYear,
              generation_source: params.useAI ? "ai_enhanced" : "auto",
              ai_used: params.useAI,
              status: "pending",
            })
            .select()
            .single(),
          5000,
          { data: null, error: null } as any
        );

        if (genError) throw genError;

        setLastGenerationId(generationRecord?.id || null);

        // TODO: Call backend service to actually generate lesson plans
        // This would create lesson_plan entries based on syllabus topics

        return generationRecord;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate lesson plans";
        setError(message);
        throw err;
      } finally {
        setGenerating(false);
      }
    },
    [schoolId]
  );

  return {
    generating,
    error,
    lastGenerationId,
    generateLessonPlans,
  };
}

export function useSyllabusTimeline(
  schoolId: string | undefined,
  classId: string | undefined,
  subjectId: string | undefined,
  termNumber: number | string = 1,
  academicYear: string = new Date().getFullYear().toString()
) {
  const [timeline, setTimeline] = useState<SyllabusTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTimeline = useCallback(async () => {
    if (!schoolId || !classId || !subjectId) return;

    setLoading(true);
    try {
      const { data, error: err } = await withTimeout(
        supabase
          .from("syllabus_timeline")
          .select("*")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .eq("subject_id", subjectId)
          .eq("term", termNumber)
          .eq("academic_year", academicYear)
          .order("week_number", { ascending: true }),
        5000,
        { data: null, error: null } as any
      );

      if (err) throw err;
      setTimeline((data || []) as SyllabusTimelineEntry[]);
    } catch (err) {
      logger.error("Failed to fetch timeline:", err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId, subjectId, termNumber, academicYear]);

  const updateWeekStatus = useCallback(
    async (
      timelineId: string,
      status: "not_started" | "in_progress" | "completed" | "postponed" | "accelerated",
      completion_percentage: number = 0
    ) => {
      try {
        const { data, error: err } = await withTimeout(
          supabase
            .from("syllabus_timeline")
            .update({
              status,
              completion_percentage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", timelineId)
            .select()
            .single(),
          5000,
          { data: null, error: null } as any
        );

        if (err) throw err;

        // Update local state
        setTimeline((prev) =>
          prev.map((item) =>
            item.id === timelineId
              ? {
                  ...item,
                  status,
                  completion_percentage,
                }
              : item
          )
        );

        return data;
      } catch (err) {
        logger.error("Failed to update timeline:", err);
        throw err;
      }
    },
    []
  );

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return {
    timeline,
    loading,
    updateWeekStatus,
    refetch: fetchTimeline,
  };
}
