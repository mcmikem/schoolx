import { supabase } from "@/lib/supabase";
import type { RegistryFilters, StudentSortDir, StudentSortKey } from "./registry";

export interface RegistryQuery extends RegistryFilters {
  sortBy?: StudentSortKey;
  sortDir?: StudentSortDir;
}
/** PostgREST filter punctuation must never become part of the expression. */
export function searchWords(search = ""): string[] {
  return search
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}
export function registryQuery(schoolId: string, fields: string, filters: RegistryQuery, head = false) {
  let query = supabase.from("students").select(fields, { count: "exact", head }).eq("school_id", schoolId);
  for (const word of searchWords(filters.search)) {
    query = query.or(
      ["first_name", "last_name", "parent_name", "student_number"].map((field) => `${field}.ilike.%${word}%`).join(","),
    );
  }
  if (filters.classId && filters.classId !== "all") query = query.eq("class_id", filters.classId);
  if (filters.gender && filters.gender !== "all") query = query.eq("gender", filters.gender);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.position === "monitor") query = query.eq("is_class_monitor", true);
  if (filters.position === "prefect")
    query = query.or(
      'and(prefect_role.not.is.null,prefect_role.neq.""),and(student_council_role.not.is.null,student_council_role.neq."")',
    );
  if (filters.defaultersOnly) query = query.gt("opening_balance", 0);
  const ascending = filters.sortDir !== "desc";
  if (filters.sortBy === "class") query = query.order("classes(name)", { ascending });
  else if (filters.sortBy === "number") query = query.order("student_number", { ascending });
  else query = query.order("first_name", { ascending }).order("last_name", { ascending });
  return query.order("id", { ascending: true });
}
