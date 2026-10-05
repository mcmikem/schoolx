import type { PostgrestResponse } from "@supabase/supabase-js";
import { withTimeout } from "@/lib/hooks/utils";
import { studentIdentityKey } from "@/lib/import/students";
import { supabase } from "@/lib/supabase";

export interface ExistingStudent {
  student_number: string | null;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
}

export interface RosterKeys {
  /** Trimmed student numbers already taken in this school. */
  numbers: Set<string>;
  /** name|gender|date-of-birth of everyone already on file. */
  people: Set<string>;
}

/**
 * Reads the roster this school already has, in pages.
 *
 * Without this the importer only knows about numbers it generated itself, so
 * re-uploading a file after a partial failure -- the most likely thing a user
 * does when some rows failed -- created a second copy of every learner that had
 * gone in first time. PostgREST caps a single response, so the read pages.
 *
 * A read that fails throws rather than returning an empty list: continuing as
 * though the table were empty is exactly how those duplicates were made.
 */
export async function loadExistingStudents(schoolId: string): Promise<ExistingStudent[]> {
  const rows: ExistingStudent[] = [];
  const pageSize = 1000;

  for (let from = 0; from < 50000; from += pageSize) {
    const fallback = {
      data: null,
      error: { message: "Timeout", code: "TIMEOUT", details: "", hint: "", name: "TimeoutError" },
      count: null,
      status: 408,
      statusText: "Timeout",
      success: false,
    } as unknown as PostgrestResponse<ExistingStudent>;

    const { data, error } = await withTimeout<PostgrestResponse<ExistingStudent>>(
      supabase
        .from("students")
        .select("student_number, first_name, last_name, gender, date_of_birth")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1),
      10000,
      fallback,
    );

    if (error) throw new Error(`Could not check existing students: ${String(error.message || error)}`);

    const batch = (data || []) as unknown as ExistingStudent[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

/** Indexes the roster so a row can be matched against it in memory. */
export function buildRosterKeys(existing: ExistingStudent[]): RosterKeys {
  const numbers = new Set<string>();
  const people = new Set<string>();

  for (const row of existing) {
    const number = String(row.student_number || "").trim();
    if (number) numbers.add(number);
    people.add(
      studentIdentityKey(row.first_name || "", row.last_name || "", row.gender || "", row.date_of_birth || ""),
    );
  }

  return { numbers, people };
}
