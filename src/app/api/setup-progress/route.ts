import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  handleApiError,
  requireUserWithSchool,
  withSecurity,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";

const DEFAULT_ITEMS: Array<{ item_key: string; item_label: string }> = [
  { item_key: "academic_calendar", item_label: "Academic Calendar" },
  { item_key: "class_structure", item_label: "Class & Stream Setup" },
  { item_key: "fee_structure", item_label: "Fee Structure" },
  { item_key: "staff_accounts", item_label: "Staff Accounts" },
  { item_key: "student_import", item_label: "Import Students" },
  { item_key: "sms_templates", item_label: "SMS Templates" },
  { item_key: "payment_methods", item_label: "Payment Methods" },
  { item_key: "grading_config", item_label: "Grading System" },
];

// item_key -> { table, condition } used to auto-detect completion from real data.
// Items not listed here are completed manually.
const AUTO_DETECT: Record<string, { table: string; column?: string; value?: boolean | string }> = {
  academic_calendar: { table: "academic_terms", column: "is_current", value: true },
  class_structure: { table: "classes" },
  fee_structure: { table: "fee_structure" },
  staff_accounts: { table: "staff" },
  student_import: { table: "students" },
  sms_templates: { table: "sms_templates" },
  grading_config: { table: "grading_schemes" },
};

async function handleGet(request: NextRequest) {
  const auth = await requireUserWithSchool(request);
  if (!auth.ok) return auth.response;

  const schoolId = auth.context.schoolId;
  if (!schoolId) {
    return apiError("School context required", 403);
  }

  const supabase = createServiceRoleClientOrThrow();

  // Ensure default checklist rows exist for this school.
  await supabase.from("setup_checklist").upsert(
    DEFAULT_ITEMS.map((item) => ({ ...item, school_id: schoolId })),
    { onConflict: "school_id,item_key" },
  );

  // Auto-complete items whose underlying data is present.
  const counts: Record<string, number> = {};
  for (const [key, rule] of Object.entries(AUTO_DETECT)) {
    let query = supabase.from(rule.table).select("id", { count: "exact", head: true }).eq("school_id", schoolId);
    if (rule.column) {
      query = query.eq(rule.column, rule.value);
    }
    const { count } = await query;
    counts[key] = count ?? 0;
    if ((count ?? 0) > 0) {
      await supabase
        .from("setup_checklist")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq("school_id", schoolId)
        .eq("item_key", key)
        .is("is_completed", false);
    }
  }

  const { data: items } = await supabase
    .from("setup_checklist")
    .select("*")
    .eq("school_id", schoolId)
    .order("item_key");

  const list = items ?? [];
  const completed = list.filter((item) => item.is_completed).length;
  const progress = list.length > 0 ? Math.round((completed / list.length) * 100) : 0;

  return apiSuccess({
    items: list,
    progress,
    completed,
    total: list.length,
    counts,
  });
}

export const GET = withSecurity(handleGet, {
  rateLimit: { limit: 60, windowMs: 60000 },
});
