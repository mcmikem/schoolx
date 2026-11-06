"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { DEMO_CLASSES } from "@/lib/demo-data";
import { isDemoSchool } from "@/lib/demo-utils";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import type { Class } from "@/types";
import { getQuerySchoolId, withTimeout } from "../utils";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/Toast";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { getErrorMessage } from "@/lib/validation";

export function useClasses(schoolId?: string) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();
  const toast = useToast();
  const prevIsDemo = useRef(isDemo);

  useEffect(() => {
    if (prevIsDemo.current && !isDemo) {
      setClasses([]);
    }
    prevIsDemo.current = isDemo;
  }, [isDemo]);

  const isOnline = useOnlineStatus();
  const fetchClasses = useCallback(async () => {
    // Offline: read from cache, never block on a network that cannot answer.
    if (!isOnline) {
      try {
        const querySchoolId = getQuerySchoolId(schoolId, isDemo);
        if (querySchoolId) {
          const cached = await offlineDB.getAllFromCache("classes", { school_id: querySchoolId });
          if (cached.length > 0) setClasses(cached as unknown as Class[]);
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
      return;
    }
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
      const { data, error } = await withTimeout(
        supabase
          .from("classes")
          .select("id, name, level, school_id, created_at, stream, academic_year, class_teacher_id")
          .eq("school_id", querySchoolId)
          .order("name"),
        15000,
        {
          data: null,
          error: { message: "Classes fetch timed out", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
          count: null as number | null,
          status: 408,
          statusText: "Timeout",
          success: false,
        } as unknown as PostgrestSingleResponse<unknown>,
      );

      if (error) throw error;

      const rows = (data as unknown as Class[]) || [];
      setClasses(rows);

      // Best-effort offline cache, in its own try. It used to run on the main
      // path, so a full or broken IndexedDB threw here, fell into the catch
      // below, blanked the rows just loaded and toasted "Failed to load
      // classes" — on every page, on every refresh.
      try {
        await offlineDB.cacheFromServer("classes", rows as unknown as Record<string, unknown>[]);
      } catch (cacheErr) {
        logger.warn("Could not cache classes for offline use:", cacheErr);
      }
    } catch (err) {
      logger.warn("Classes fetch error:", err);
      // Keep the last-known-good data instead of blanking the page when the
      // network is slow/unreliable (3G) — surface the cached copy instead.
      try {
        const cached = await offlineDB.getAllFromCache("classes", { school_id: querySchoolId });
        if (cached.length > 0) {
          setClasses(cached as unknown as Class[]);
          return;
        }
      } catch {
        // ignore cache read failure
      }
      setClasses([]);
      // The reason travels with the toast. Besides telling the user what broke,
      // the wording identifies the running build — older bundles showed a bare
      // "Failed to load classes" even when the error carried a full message.
      const reason = getErrorMessage(err, "");
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code || "") : "";
      toast?.error(
        reason
          ? `Failed to load classes: ${reason}${code ? ` [${code}]` : ""}`
          : `Failed to load classes (error carried no message: ${err === null ? "null" : typeof err})`,
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo, toast, isOnline]);

  const createClass = async (newClass: Partial<Class>) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const demoClass: Class = {
        id: `demo-class-${Date.now()}`,
        name: newClass.name || "Unknown Class",
        level: newClass.level || "Primary",
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        max_students: newClass.max_students || 50,
        academic_year: newClass.academic_year || new Date().getFullYear().toString(),
        created_at: new Date().toISOString(),
      };
      setClasses((prev) => [...prev, demoClass]);
      return demoClass;
    }

    if (!newClass.name || !newClass.academic_year) {
      throw new Error("Class name and academic year are required");
    }

    const { data: existingClass, error: checkError } = await withTimeout(
      supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("name", newClass.name.trim())
        .eq("academic_year", newClass.academic_year)
        .limit(1),
      15000,
      {
        data: null,
        error: {
          message: "Class duplicate check timed out",
          code: "TIMEOUT",
          details: "",
          hint: "",
          name: "TimeoutError",
        },
        count: null as number | null,
        status: 408,
        statusText: "Timeout",
        success: false,
      } as any,
    );

    if (checkError) {
      throw new Error(`Failed to check existing class: ${checkError.message}`);
    }

    if (existingClass && existingClass.length > 0) {
      throw new Error("A class with this name already exists for the specified academic year");
    }

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("classes")
          .insert({ ...newClass, school_id: schoolId })
          .select()
          .single(),
        15000,
        {
          data: null,
          error: { message: "Class creation timed out", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
          count: null as number | null,
          status: 408,
          statusText: "Timeout",
          success: false,
        } as unknown as PostgrestSingleResponse<unknown>,
      );
      if (error) throw error;
      setClasses((prev) => [...prev, data as Class]);
      return data as Class;
    } catch (err) {
      throw err;
    }
  };

  const updateClass = async (id: string, updates: Partial<Class>) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      return { id, ...updates } as Class;
    }

    try {
      const { data, error } = await withTimeout(
        supabase.from("classes").update(updates).eq("id", id).select().single(),
        15000,
        {
          data: null,
          error: { message: "Class update timed out", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
          count: null as number | null,
          status: 408,
          statusText: "Timeout",
          success: false,
        } as unknown as PostgrestSingleResponse<unknown>,
      );
      if (error) throw error;
      setClasses((prev) => prev.map((c) => (c.id === id ? (data as Class) : c)));
      return data as Class;
    } catch (err) {
      throw err;
    }
  };

  // Seed instantly from the persistent IndexedDB cache so revisits don't wait
  // on the network; the fetch effect above then revalidates in the background.
  useEffect(() => {
    if (isDemo || isDemoSchool(schoolId) || !schoolId) return;
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    if (!querySchoolId) return;
    let cancelled = false;
    offlineDB.getAllFromCache("classes", { school_id: querySchoolId }).then((cached) => {
      if (cancelled || cached.length === 0) return;
      const sorted = [...(cached as unknown as Class[])].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setClasses(sorted);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolId, isDemo]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);
  return { classes, loading, createClass, updateClass, refetch: fetchClasses };
}
