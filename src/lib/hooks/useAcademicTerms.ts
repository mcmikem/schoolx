import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

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

  const fetchTerms = useCallback(async () => {
    if (!school?.id) return;

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

      const current = data?.find((t) => t.is_current);
      setCurrentTerm(current || null);
    } catch (err) {
      console.error("Error fetching academic terms:", err);
      toast.error("Failed to load academic terms");
    } finally {
      setLoading(false);
    }
  }, [school?.id, options, toast]);

  const createTerm = useCallback(
    async (term: Partial<AcademicTerm>) => {
      if (!school?.id) return null;

      try {
        const { data, error } = await supabase
          .from("academic_terms")
          .insert({
            school_id: school.id,
            ...term,
          })
          .select()
          .single();

        if (error) throw error;
        setTerms((prev) => [...prev, data]);
        toast.success("Academic term created");
        return data;
      } catch (err) {
        console.error("Error creating academic term:", err);
        toast.error("Failed to create academic term");
        return null;
      }
    },
    [school?.id, toast],
  );

  const updateTerm = useCallback(
    async (id: string, updates: Partial<AcademicTerm>) => {
      try {
        const { data, error } = await supabase
          .from("academic_terms")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        setTerms((prev) => prev.map((t) => (t.id === id ? data : t)));

        if (data.is_current) {
          setCurrentTerm(data);
        }

        toast.success("Academic term updated");
        return data;
      } catch (err) {
        console.error("Error updating academic term:", err);
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
        console.error("Error setting current term:", err);
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
    fetchTerms,
    createTerm,
    updateTerm,
    setCurrent,
    getActiveTerms,
    getTermForDate,
  };
}

export default useAcademicTerms;
