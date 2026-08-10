import { useCallback, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { logger } from "@/lib/logger";
import { cacheResponse, queueMutation, isOnline } from "@/lib/offline-db";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { withTimeout } from "./utils";

interface Course {
  id: string;
  school_id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  department_id: string;
  is_active: boolean;
  is_elective: boolean;
  is_laboratory: boolean;
  credit_hours: number;
  max_score: number;
  passing_score: number;
  color: string;
  icon: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CourseClass {
  id: string;
  course_id: string;
  class_id: string;
  academic_year: string;
  term_id: string;
  teacher_id: string;
  is_compulsory: boolean;
  weight: number;
  max_score: number;
  course?: Course;
  class?: {
    name: string;
    level: string;
  };
  teacher?: {
    full_name: string;
  };
}

interface UseCoursesOptions {
  category?: string;
  isActive?: boolean;
}

export function useCourses(options: UseCoursesOptions = {}) {
  const { school } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { category, isActive } = options;
  const cacheParams = { category, isActive } as Record<string, unknown>;
  const cacheKey = `/api/courses/${school?.id}`;

  const {
    data: courses = [],
    isLoading: loading,
    isStale,
    refetch,
  } = useSupabaseQuery<Course[]>({
    queryKey: ["courses", school?.id, category, isActive],
    cacheEndpoint: cacheKey,
    cacheParams,
    enabled: Boolean(school?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("school_id", school?.id).order("name");

      if (error) throw error;
      return data || [];
    },
  });

  const createCourse = useCallback(
    async (course: Partial<Course>) => {
      if (!school?.id) return null;

      if (!isOnline()) {
        const tempId = `temp-${Date.now()}`;
        const offlineCourse: Course = {
          id: tempId,
          school_id: school.id,
          name: course.name || "",
          code: course.code || "",
          description: course.description || "",
          category: course.category || "",
          department_id: course.department_id || "",
          is_active: course.is_active ?? true,
          is_elective: course.is_elective ?? false,
          is_laboratory: course.is_laboratory ?? false,
          credit_hours: course.credit_hours ?? 0,
          max_score: course.max_score ?? 100,
          passing_score: course.passing_score ?? 40,
          color: course.color || "#17325f",
          icon: course.icon || "book",
          metadata: course.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        queryClient.setQueryData(["courses", school.id, category, isActive], (old: Course[] | undefined) => [
          ...(old || []),
          offlineCourse,
        ]);
        await queueMutation({
          endpoint: "courses",
          method: "POST",
          body: { course, schoolId: school.id },
        });
        toast.success("Course saved (offline)");
        return offlineCourse;
      }

      try {
        const { data, error } = await withTimeout(
          supabase
            .from("courses")
            .insert({
              school_id: school.id,
              ...course,
            })
            .select()
            .single(),
          15000,
          {
            data: null,
            error: { message: "Course creation timed out", name: "TimeoutError", details: "", hint: "", code: "" },
          } as any,
        );

        if (error) throw error;
        toast.success("Course created");
        refetch();
        return data;
      } catch (err) {
        logger.error("Error creating course:", err);
        toast.error(err instanceof Error ? err.message : "Failed to create course");
        return null;
      }
    },
    [school?.id, toast, refetch, queryClient, category, isActive],
  );

  const updateCourse = useCallback(
    async (id: string, updates: Partial<Course>) => {
      try {
        const { data, error } = await withTimeout(
          supabase.from("courses").update(updates).eq("id", id).select().single(),
          15000,
          {
            data: null,
            error: { message: "Course update timed out", name: "TimeoutError", details: "", hint: "", code: "" },
          } as any,
        );

        if (error) throw error;
        toast.success("Course updated");
        refetch();
        return data;
      } catch (err) {
        logger.error("Error updating course:", err);
        toast.error(err instanceof Error ? err.message : "Failed to update course");
        return null;
      }
    },
    [toast, refetch],
  );

  const deleteCourse = useCallback(
    async (id: string) => {
      try {
        const { error } = await withTimeout(supabase.from("courses").delete().eq("id", id), 15000, {
          error: { message: "Course deletion timed out", name: "TimeoutError", details: "", hint: "", code: "" },
        } as any);

        if (error) throw error;
        toast.success("Course deleted");
        refetch();
      } catch (err) {
        logger.error("Error deleting course:", err);
        toast.error("Failed to delete course");
      }
    },
    [toast, refetch],
  );

  return {
    courses,
    loading,
    isStale,
    fetchCourses: refetch,
    createCourse,
    updateCourse,
    deleteCourse,
  };
}

export function useCourseClasses() {
  const { school } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [courseClasses, setCourseClasses] = useState<CourseClass[]>([]);

  const fetchCourseClasses = useCallback(
    async (classId?: string, academicYear?: string) => {
      if (!school?.id) return;

      setLoading(true);
      try {
        let query = supabase
          .from("course_classes")
          .select(
            "*, course:courses(name, code, category, color, icon), class:classes(name, level), teacher:users(full_name)",
          )
          .eq("academic_year", academicYear || new Date().getFullYear().toString());

        if (classId) {
          query = query.eq("class_id", classId);
        }

        const { data, error } = await query;

        if (error) throw error;
        setCourseClasses(data || []);
      } catch (err) {
        logger.error("Error fetching course classes:", err);
        toast.error("Failed to load course assignments");
      } finally {
        setLoading(false);
      }
    },
    [school?.id, toast],
  );

  const assignCourse = useCallback(
    async (courseClass: Partial<CourseClass>) => {
      try {
        const { data, error } = await withTimeout(
          supabase.from("course_classes").insert(courseClass).select().single(),
          15000,
          { data: null, error: { message: "Course assignment timed out", code: "TIMEOUT" } } as any,
        );

        if (error) throw error;
        toast.success("Course assigned to class");
        return data;
      } catch (err) {
        logger.error("Error assigning course:", err);
        toast.error("Failed to assign course");
        return null;
      }
    },
    [toast],
  );

  const updateCourseClass = useCallback(
    async (id: string, updates: Partial<CourseClass>) => {
      try {
        const { error } = await withTimeout(supabase.from("course_classes").update(updates).eq("id", id), 15000, {
          error: { message: "Course class update timed out", code: "TIMEOUT" },
        } as any);

        if (error) throw error;
        toast.success("Assignment updated");
      } catch (err) {
        logger.error("Error updating course class:", err);
        toast.error("Failed to update assignment");
      }
    },
    [toast],
  );

  return {
    courseClasses,
    loading,
    fetchCourseClasses,
    assignCourse,
    updateCourseClass,
  };
}

export default useCourses;
