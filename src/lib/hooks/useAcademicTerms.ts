import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { logger } from "@/lib/logger";
import { queueMutation, isOnline } from "@/lib/offline-db";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
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
  const queryClient = useQueryClient();
  const [localTerms, setLocalTerms] = useState<AcademicTerm[]>([]);

  const cacheParams = options as Record<string, unknown>;
  const cacheKey = `/api/academic-terms/${school?.id}`;

  const {
    data: queryTerms = [],
    isLoading: loading,
    isStale,
    refetch,
  } = useSupabaseQuery<AcademicTerm[]>({
    queryKey: ["academicTerms", school?.id, options.academicYear, options.isCurrent],
    cacheEndpoint: cacheKey,
    cacheParams,
    enabled: Boolean(school?.id),
    queryFn: async () => {
      let query = supabase
        .from("academic_terms")
        .select("*")
        .eq("school_id", school?.id)
        .order("term_number", { ascending: true });

      if (options.academicYear) {
        query = query.eq("academic_year", options.academicYear);
      }
      if (options.isCurrent !== undefined) {
        query = query.eq("is_current", options.isCurrent);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const terms = localTerms.length > 0 ? localTerms : queryTerms;
  const currentTerm = terms.find((t) => t.is_current) || null;

  useEffect(() => {
    const handleOnline = () => {
      refetch().catch(() => undefined);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [refetch]);

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
        setLocalTerms((prev) => [...prev, offlineTerm]);
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
          {
            data: null,
            error: {
              message: "Academic term creation timed out",
              name: "TimeoutError",
              details: "",
              hint: "",
              code: "",
            },
          } as any,
        );

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["academicTerms", school.id] });
        toast.success("Academic term created");
        return data;
      } catch (err) {
        logger.error("Error creating academic term:", err);
        toast.error(err instanceof Error ? err.message : "Failed to create academic term");
        return null;
      }
    },
    [school?.id, toast],
  );

  const updateTerm = useCallback(
    async (id: string, updates: Partial<AcademicTerm>) => {
      try {
        const { data, error } = await withTimeout(
          supabase.from("academic_terms").update(updates).eq("id", id).select().single(),
          15000,
          {
            data: null,
            error: { message: "Academic term update timed out", name: "TimeoutError", details: "", hint: "", code: "" },
          } as any,
        );

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["academicTerms", school?.id] });
        toast.success("Academic term updated");
        return data;
      } catch (err) {
        logger.error("Error updating academic term:", err);
        toast.error(err instanceof Error ? err.message : "Failed to update academic term");
        return null;
      }
    },
    [toast, queryClient, school?.id],
  );

  const setCurrent = useCallback(
    async (termId: string) => {
      try {
        const { data, error } = await supabase.rpc("set_current_term", {
          p_term_id: termId,
        });

        if (error) throw error;

        setLocalTerms((prev) =>
          prev.map((t) => ({
            ...t,
            is_current: t.id === termId,
          })),
        );

        queryClient.invalidateQueries({ queryKey: ["academicTerms", school?.id] });

        toast.success("Current term updated");
      } catch (err) {
        logger.error("Error setting current term:", err);
        toast.error(err instanceof Error ? err.message : "Failed to set current term");
      }
    },
    [queryClient, school?.id, toast],
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
    createTerm,
    updateTerm,
    setCurrent,
    getActiveTerms,
    getTermForDate,
  };
}

export default useAcademicTerms;
