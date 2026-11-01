"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { DEMO_STUDENTS } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";
import { getOrFetchCached } from "./queryCache";
import { withTimeout } from "./utils";

export function useRegistrySummary(schoolId?: string, version?: unknown) {
  const { isDemo } = useAuth();
  const [summary, setSummary] = useState<{ total: number; boys: number; girls: number; active: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    if (isDemo) {
      setSummary({
        total: DEMO_STUDENTS.length,
        boys: DEMO_STUDENTS.filter((s) => s.gender === "M").length,
        girls: DEMO_STUDENTS.filter((s) => s.gender === "F").length,
        active: DEMO_STUDENTS.filter((s) => s.status === "active").length,
      });
      return;
    }
    if (!schoolId) return;
    void getOrFetchCached(`students:${schoolId}:summary`, async () => {
      const results = await Promise.all(
        [undefined, ["gender", "M"], ["gender", "F"], ["status", "active"]].map(async (filter) => {
          let query = supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId);
          if (filter) query = query.eq(filter[0], filter[1]);
          const result = await withTimeout(query, 8000, null);
          if (!result || result.error || result.count === null) throw new Error("Student totals unavailable");
          return result.count;
        }),
      );
      return { total: results[0], boys: results[1], girls: results[2], active: results[3] };
    })
      .then(({ data }) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [schoolId, isDemo, version]);
  return summary;
}
