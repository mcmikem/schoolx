// Server-side mirror of the class-scoped RLS added in
// supabase/migrations/202611030001_teacher_class_scope.sql.
//
// API routes run on the service role, so RLS never applies to them: every
// route that accepts a class_id or student_id has to repeat the check that the
// database now enforces for direct Supabase calls.
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { isClassScopedRole } from "@/lib/roles";

export { isClassScopedRole };

/** Class ids a staff member leads or teaches (classes.class_teacher_id + teacher_subjects). */
export async function getAssignedClassIds(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const [led, taught] = await Promise.all([
    supabase.from("classes").select("id").eq("class_teacher_id", userId),
    supabase.from("teacher_subjects").select("class_id").eq("teacher_id", userId),
  ]);

  if (led.error) logger.warn("[class-scope] reading class_teacher_id failed", led.error);
  if (taught.error) logger.warn("[class-scope] reading teacher_subjects failed", taught.error);

  const ids = new Set<string>();
  for (const row of led.data ?? []) if (row?.id) ids.add(row.id);
  for (const row of taught.data ?? []) if (row?.class_id) ids.add(row.class_id);
  return ids;
}

/**
 * True when the caller may act on rows of `classId`. Non-scoped roles (admin,
 * dean, bursar, secretary, …) keep the whole school, exactly as RLS does.
 */
export async function canAccessClass(
  supabase: SupabaseClient,
  role: string | null | undefined,
  userId: string,
  classId: string | null | undefined,
): Promise<boolean> {
  if (!isClassScopedRole(role)) return true;
  if (!classId) return false;
  const assigned = await getAssignedClassIds(supabase, userId);
  return assigned.has(classId);
}
