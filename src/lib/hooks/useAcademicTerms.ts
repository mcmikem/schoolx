import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { logger } from "@/lib/logger";
import { getCachedResponse, cacheResponse, queueMutation, isOnline, generateCacheKey } from "@/lib/offline-db";
import { withTimeout } from "./utils";

interface AcademicTerm {
  id: string;
  school_id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  term_number: number;
  academic_year: string;
  is_active: boolean;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

interface UseAcademicTermsOptions {
  academicYear?: string;
  isCurrent?: boolean;
}

export function useAcademicTerms(options: UseAcademicTermsOptions = {}) {
  const { school } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [currentTerm, setCurrentTerm] = useState<AcademicTerm | null>(null);
  const [isStale, setIsStale] = useState(false);

  const fetchTerms = useCallback(async () => {
    if (!school?.id) return;

    const cacheKey = generateCacheKey(`/api/academic-terms/${school.id}`, options as Record<string, unknown>);

    if (!isOnline()) {
      const cached = await getCachedResponse<AcademicTerm[]>(cacheKey);
      if (cached) {
        setTerms(cached);
        setCurrentTerm(cached.find((t) => t.is_current) || null);
        setIsStale(true);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      let query = supabase
        .from("academic_terms")
        .select("*")
        .eq("school_id", school.id)
        .order("term_number", { ascending: true });

      if (options.academicYear) {
        query = query.eq("academic_year", options.academicYear);
      }
      if (options.isCurrent !== undefined) {
        query = query.eq("is_current", options.isCurrent);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTerms(data || []);
      await cacheResponse(cacheKey, data || [], undefined, 60 * 60 * 1000);

      const current = data?.find((t) => t.is_current);
      setCurrentTerm(current || null);
    } catch (err) {
      logger.error("Error fetching academic terms:", err);
      const cached = await getCachedResponse<AcademicTerm[]>(cacheKey);
      if (cached) {
        setTerms(cached);
        setCurrentTerm(cached.find((t) => t.is_current) || null);
        setIsStale(true);
      } else {
        toast.error("Failed to load academic terms");
      }
    } finally {
      setLoading(false);
    }
  }, [school?.id, options, toast]);

  useEffect(() => {
    const handleOnline = () => {
      setIsStale(true);
      fetchTerms();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchTerms]);

  const createTerm = useCallback(
    async (term: Partial<AcademicTerm>) => {
      if (!school?.id) return null;

      if (!isOnline()) {
        const tempId = `temp-${Date.now()}`;
        const offlineTerm: AcademicTerm = {
          id: tempId,
          school_id: school.id,
          name: term.name || "",
          code: term.code || "",
          start_date: term.start_date || "",
          end_date: term.end_date || "",
          term_number: term.term_number || 1,
          academic_year: term.academic_year || "",
          is_active: term.is_active ?? true,
          is_current: term.is_current ?? false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setTerms((prev) => [...prev, offlineTerm]);
        await queueMutation({
          endpoint: "academic_terms",
          method: "POST",
          body: { term, schoolId: school.id },
        });
        toast.success("Term saved (offline)");
        return offlineTerm;
      }

      try {
        const { data, error } = await withTimeout(
          supabase
            .from("academic_terms")
            .insert({
              school_id: school.id,
              ...term,
            })
            .select()
            .single(),
          15000,
          { data: null, error: { message: "Academic term creation timed out", name: "TimeoutError", details: "", hint: "", code: "" } } as any,
        );

        if (error) throw error;
        setTerms((prev) => [...prev, data]);
        toast.success("Academic term created");
        return data;
      } catch (err) {
        logger.error("Error creating academic term:", err);
        toast.error("Failed to create academic term");
        return null;
      }
    },
    [school?.id, toast],
  );

  const updateTerm = useCallback(
    async (id: string, updates: Partial<AcademicTerm>) => {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("academic_terms")
            .update(updates)
            .eq("id", id)
            .select()
            .single(),
          15000,
          { data: null, error: { message: "Academic term update timed out", name: "TimeoutError", details: "", hint: "", code: "" } } as any,
        );

        if (error) throw error;
        setTerms((prev) => prev.map((t) => (t.id === id ? data : t)));

        if (data.is_current) {
          setCurrentTerm(data);
        }

        toast.success("Academic term updated");
        return data;
      } catch (err) {
        logger.error("Error updating academic term:", err);
        toast.error("Failed to update academic term");
        return null;
      }
    },
    [toast],
  );

  const setCurrent = useCallback(
    async (termId: string) => {
      try {
        const { data, error } = await supabase.rpc("set_current_term", {
          p_term_id: termId,
        });

        if (error) throw error;

        setTerms((prev) =>
          prev.map((t) => ({
            ...t,
            is_current: t.id === termId,
          })),
        );

        const updated = terms.find((t) => t.id === termId);
        if (updated) {
          setCurrentTerm({ ...updated, is_current: true });
        }

        toast.success("Current term updated");
      } catch (err) {
        logger.error("Error setting current term:", err);
        toast.error("Failed to set current term");
      }
    },
    [terms, toast],
  );

  const getActiveTerms = useCallback(() => {
    return terms.filter((t) => t.is_active);
  }, [terms]);

  const getTermForDate = useCallback(
    (date: Date) => {
      return (
        terms.find((t) => {
          const start = new Date(t.start_date);
          const end = new Date(t.end_date);
          return date >= start && date <= end;
        }) || null
      );
    },
    [terms],
  );

  return {
    terms,
    currentTerm,
    loading,
    isStale,
    fetchTerms,
    createTerm,
    updateTerm,
    setCurrent,
    getActiveTerms,
    getTermForDate,
  };
}

export default useAcademicTerms;
