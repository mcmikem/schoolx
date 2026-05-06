import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { logger } from "@/lib/logger";
import { getCachedResponse, cacheResponse, queueMutation, isOnline, generateCacheKey } from "@/lib/offline-db";

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
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isStale, setIsStale] = useState(false);

  const fetchCourses = useCallback(async () => {
    if (!school?.id) return;

    const cacheKey = generateCacheKey(`/api/courses/${school.id}`, options as Record<string, unknown>);

    if (!isOnline()) {
      const cached = await getCachedResponse<Course[]>(cacheKey);
      if (cached) {
        setCourses(cached);
        setIsStale(true);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      let query = supabase
        .from("courses")
        .select("*")
        .eq("school_id", school.id);

      if (options.category) {
        query = query.eq("category", options.category);
      }
      if (options.isActive !== undefined) {
        query = query.eq("is_active", options.isActive);
      }

      const { data, error } = await query.order("name");

      if (error) throw error;
      setCourses(data || []);
      await cacheResponse(cacheKey, data || [], undefined, 5 * 60 * 1000);
    } catch (err) {
      logger.error("Error fetching courses:", err);
      const cached = await getCachedResponse<Course[]>(cacheKey);
      if (cached) {
        setCourses(cached);
        setIsStale(true);
      } else {
        toast.error("Failed to load courses");
      }
    } finally {
      setLoading(false);
    }
  }, [school?.id, options.category, options.isActive, toast]);

  useEffect(() => {
    const handleOnline = () => {
      setIsStale(true);
      fetchCourses();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchCourses]);

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
        setCourses((prev) => [...prev, offlineCourse]);
        await queueMutation({
          endpoint: "courses",
          method: "POST",
          body: { course, schoolId: school.id },
        });
        toast.success("Course saved (offline)");
        return offlineCourse;
      }

      try {
        const { data, error } = await supabase
          .from("courses")
          .insert({
            school_id: school.id,
            ...course,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success("Course created");
        fetchCourses();
        return data;
      } catch (err) {
        logger.error("Error creating course:", err);
        toast.error("Failed to create course");
        return null;
      }
    },
    [school?.id, toast, fetchCourses],
  );

  const updateCourse = useCallback(
    async (id: string, updates: Partial<Course>) => {
      try {
        const { data, error } = await supabase
          .from("courses")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        toast.success("Course updated");
        fetchCourses();
        return data;
      } catch (err) {
        logger.error("Error updating course:", err);
        toast.error("Failed to update course");
        return null;
      }
    },
    [toast, fetchCourses],
  );

  const deleteCourse = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from("courses").delete().eq("id", id);

        if (error) throw error;
        toast.success("Course deleted");
        fetchCourses();
      } catch (err) {
        logger.error("Error deleting course:", err);
        toast.error("Failed to delete course");
      }
    },
    [toast, fetchCourses],
  );

  return {
    courses,
    loading,
    isStale,
    fetchCourses,
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
          .eq(
            "academic_year",
            academicYear || new Date().getFullYear().toString(),
          );

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
        const { data, error } = await supabase
          .from("course_classes")
          .insert(courseClass)
          .select()
          .single();

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
        const { error } = await supabase
          .from("course_classes")
          .update(updates)
          .eq("id", id);

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
