/**
 * React hooks for Syllabus Tracker and Auto Lesson Planner
 */

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import type { AutoPlannerConfig } from "@/lib/syllabus-planner-utils";

export interface SyllabusTopicWithCoverage {
  id: string;
  topic: string;
  subtopics: string[] | null;
  objectives: string | null;
  weeks_covered: string | null;
  resources: string | null;
  status: "not_started" | "in_progress" | "completed";
  completed_date: string | null;
  notes: string | null;
  completion_percentage: number;
  lessons_planned: number;
  lessons_completed: number;
  student_comprehension_rating: number | null;
  teacher_notes: string | null;
  challenges: string | null;
  week_number: number | null;
  progress?: { overall_percentage: number; weeks_completed: number; weeks_total: number; on_track: boolean };
  // Used by legacy SyllabusTimelineView component
  timeline?: Array<{
    id?: string;
    week_number: number;
    status: string;
    completion_percentage: number;
    planned_start_date?: string;
    planned_end_date?: string;
    lessons_planned?: number;
    lessons_completed?: number;
  }>;
}

// Backward-compatible aliases for legacy components
// @deprecated Use SyllabusTopicWithCoverage instead
export type SyllabusWithTimeline = SyllabusTopicWithCoverage;

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
  academicYear: string = new Date().getFullYear().toString(),
) {
  const [syllabi, setSyllabi] = useState<SyllabusTopicWithCoverage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSyllabusWithCoverage = useCallback(async () => {
    if (!schoolId || !classId || !subjectId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await withTimeout(
        supabase
          .from("syllabus")
          .select("*, topic_coverage(*)")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .eq("subject_id", subjectId)
          .eq("term", termNumber)
          .eq("academic_year", academicYear),
        5000,
        timeoutFallback(),
      );

      if (err) throw err;

      // Fetch timeline data
      const { data: timelineData } = await withTimeout(
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
        timeoutFallback(),
      );

      const timelineMap = new Map<string, typeof timelineData>();
      if (timelineData) {
        for (const entry of timelineData as any[]) {
          const existing = timelineMap.get(entry.syllabus_id) || [];
          existing.push(entry);
          timelineMap.set(entry.syllabus_id, existing);
        }
      }

      const mapped = (data || []).map((row: any) => {
        const cov = row.topic_coverage?.[0] || {};
        const timeline = timelineMap.get(row.id) || [];
        const weeksTotal = timeline.length;
        const weeksCompleted = timeline.filter((t: any) => t.status === "completed").length;
        const overallPercentage = weeksTotal > 0 ? Math.round((weeksCompleted / weeksTotal) * 100) : 0;

        return {
          id: row.id,
          topic: row.topic,
          subtopics: row.subtopics,
          objectives: row.objectives,
          weeks_covered: row.weeks_covered,
          resources: row.resources,
          status: cov.status || "not_started",
          completed_date: cov.completed_date || null,
          notes: cov.notes || null,
          completion_percentage: cov.completion_percentage || 0,
          lessons_planned: cov.lessons_planned || 0,
          lessons_completed: cov.lessons_completed || 0,
          student_comprehension_rating: cov.student_comprehension_rating || null,
          teacher_notes: cov.teacher_notes || null,
          challenges: cov.challenges || null,
          week_number: cov.week_number || null,
          progress: {
            overall_percentage: overallPercentage,
            weeks_completed: weeksCompleted,
            weeks_total: weeksTotal,
            on_track: overallPercentage >= 50,
          },
          timeline: timeline.map((t: any) => ({
            id: t.id,
            week_number: t.week_number,
            status: t.status,
            completion_percentage: t.completion_percentage || 0,
            planned_start_date: t.planned_start_date,
            planned_end_date: t.planned_end_date,
            lessons_planned: t.lessons_planned || 0,
            lessons_completed: t.lessons_completed || 0,
          })),
        };
      });

      setSyllabi(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch syllabus");
      logger.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId, subjectId, termNumber, academicYear]);

  useEffect(() => {
    fetchSyllabusWithCoverage();
  }, [fetchSyllabusWithCoverage]);

  return {
    syllabi,
    loading,
    error,
    refetch: fetchSyllabusWithCoverage,
  };
}

export function useSyllabusTimeline(
  schoolId: string | undefined,
  classId: string | undefined,
  subjectId: string | undefined,
  termNumber: number | string = 1,
  academicYear: string = new Date().getFullYear().toString(),
) {
  const [coverage, setCoverage] = useState<SyllabusTopicWithCoverage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCoverage = useCallback(async () => {
    if (!schoolId || !classId || !subjectId) return;

    setLoading(true);
    try {
      const { data, error: err } = await withTimeout(
        supabase
          .from("syllabus")
          .select("*, topic_coverage(*)")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .eq("subject_id", subjectId)
          .eq("term", termNumber)
          .eq("academic_year", academicYear)
          .order("topic", { ascending: true }),
        5000,
        timeoutFallback(),
      );

      if (err) throw err;

      const mapped = (data || []).map((row: any) => {
        const cov = row.topic_coverage?.[0] || {};
        return {
          id: row.id,
          topic: row.topic,
          subtopics: row.subtopics,
          objectives: row.objectives,
          weeks_covered: row.weeks_covered,
          resources: row.resources,
          status: cov.status || "not_started",
          completed_date: cov.completed_date || null,
          notes: cov.notes || null,
          completion_percentage: cov.completion_percentage || 0,
          lessons_planned: cov.lessons_planned || 0,
          lessons_completed: cov.lessons_completed || 0,
          student_comprehension_rating: cov.student_comprehension_rating || null,
          teacher_notes: cov.teacher_notes || null,
          challenges: cov.challenges || null,
          week_number: cov.week_number || null,
        };
      });

      setCoverage(mapped);
    } catch (err) {
      logger.error("Failed to fetch timeline:", err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId, subjectId, termNumber, academicYear]);

  const updateTopicStatus = useCallback(
    async (
      syllabusId: string,
      status: "not_started" | "in_progress" | "completed",
      completion_percentage: number = 0,
    ) => {
      try {
        const existing = coverage.find((c) => c.id === syllabusId);

        if (existing?.status) {
          const { data, error: err } = await withTimeout(
            supabase
              .from("topic_coverage")
              .update({
                status,
                completion_percentage,
                completed_date: status === "completed" ? new Date().toISOString().split("T")[0] : null,
                updated_at: new Date().toISOString(),
              })
              .eq("syllabus_id", syllabusId)
              .select()
              .single(),
            5000,
            timeoutFallback(),
          );

          if (err) throw err;

          setCoverage((prev) =>
            prev.map((item) => (item.id === syllabusId ? { ...item, status, completion_percentage } : item)),
          );

          return data;
        } else {
          const { data, error: err } = await withTimeout(
            supabase
              .from("topic_coverage")
              .insert({
                syllabus_id: syllabusId,
                class_id: classId,
                status,
                completion_percentage,
                completed_date: status === "completed" ? new Date().toISOString().split("T")[0] : null,
              })
              .select()
              .single(),
            5000,
            timeoutFallback(),
          );

          if (err) throw err;
          return data;
        }
      } catch (err) {
        logger.error("Failed to update coverage:", err);
        throw err;
      }
    },
    [coverage, classId],
  );

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  return {
    coverage,
    loading,
    updateTopicStatus,
    refetch: fetchCoverage,
  };
}

// @deprecated topic_performance table is no longer actively populated.
// Returns empty data. Use topic_coverage for syllabus progress tracking instead.
export function useTopicPerformance(
  _schoolId: string | undefined,
  _classId: string | undefined,
  _subjectId: string | undefined,
  _termNumber: number | string = 1,
  _academicYear: string = new Date().getFullYear().toString(),
) {
  return {
    performance: [] as TopicPerformance[],
    loading: false,
    error: null,
    refetch: async () => {},
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
        supabase.from("auto_planner_config").select("*").eq("school_id", schoolId).maybeSingle(),
        5000,
        timeoutFallback(),
      );

      if (err && (err as { code?: string }).code !== "PGRST116") throw err; // PGRST116 = no rows

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
              { onConflict: "school_id" },
            )
            .select()
            .single(),
          5000,
          timeoutFallback(),
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
    [schoolId, config],
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
          timeoutFallback(),
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
    [schoolId],
  );

  return {
    generating,
    error,
    lastGenerationId,
    generateLessonPlans,
  };
}
