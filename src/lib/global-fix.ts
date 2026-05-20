import { supabase } from "./supabase";
import { logger } from "@/lib/logger";

export async function assignMissingClasses(): Promise<{ fixed: number; errors: string[] }> {
  const errors: string[] = [];
  let fixed = 0;

  const { data: orphans, error: fetchErr } = await supabase
    .from("students")
    .select("id, school_id")
    .is("class_id", null);

  if (fetchErr) {
    errors.push(fetchErr.message);
    return { fixed, errors };
  }

  if (!orphans || orphans.length === 0) return { fixed, errors };

  const schoolIds = [...new Set(orphans.map((s) => s.school_id))];

  for (const schoolId of schoolIds) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!classes || classes.length === 0) {
      errors.push(`No classes for school ${schoolId}`);
      continue;
    }

    const studentIds = orphans.filter((s) => s.school_id === schoolId).map((s) => s.id);
    const { error: updErr } = await supabase
      .from("students")
      .update({ class_id: classes[0].id })
      .in("id", studentIds);

    if (updErr) {
      errors.push(`Failed to update school ${schoolId}: ${updErr.message}`);
    } else {
      fixed += studentIds.length;
    }
  }

  return { fixed, errors };
}

function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[^\d]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) return "256" + cleaned.slice(1);
  if (cleaned.startsWith("256") && cleaned.length > 12) return cleaned.slice(0, 12);
  if (cleaned.length === 9) return "256" + cleaned;
  if (cleaned.startsWith("256") && cleaned.length === 12) return cleaned;
  return null;
}

export async function normalizeParentPhones(): Promise<{ fixed1: number; fixed2: number; errors: string[] }> {
  const errors: string[] = [];
  let fixed1 = 0;
  let fixed2 = 0;

  const { data: students, error: fetchErr } = await supabase
    .from("students")
    .select("id, parent_phone, parent_phone2");

  if (fetchErr) {
    errors.push(fetchErr.message);
    return { fixed1, fixed2, errors };
  }

  for (const s of students || []) {
    const updates: Record<string, string> = {};

    if (s.parent_phone) {
      const norm = normalizePhone(s.parent_phone);
      if (norm && norm !== s.parent_phone.replace(/[^\d]/g, "")) {
        updates.parent_phone = norm;
        fixed1++;
      }
    }

    if (s.parent_phone2) {
      const norm = normalizePhone(s.parent_phone2);
      if (norm && norm !== s.parent_phone2.replace(/[^\d]/g, "")) {
        updates.parent_phone2 = norm;
        fixed2++;
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: ue } = await supabase.from("students").update(updates).eq("id", s.id);
      if (ue) errors.push(`Student ${s.id}: ${ue.message}`);
    }
  }

  return { fixed1, fixed2, errors };
}
