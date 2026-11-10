import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  createServiceRoleClientOrThrow,
  requireUserWithSchool,
  withSecurity,
} from "@/lib/api-utils";

// Ordered setup steps shown to admins after onboarding. The order here IS the
// display order on the dashboard checklist.
const DEFAULT_ITEMS: Array<{ item_key: string; item_label: string; sort_order: number }> = [
  { item_key: "school_details", item_label: "School details", sort_order: 0 },
  { item_key: "academic_term", item_label: "Set current academic term", sort_order: 1 },
  { item_key: "classes", item_label: "Add classes", sort_order: 2 },
  { item_key: "subjects", item_label: "Add subjects", sort_order: 3 },
  { item_key: "teachers", item_label: "Add teachers", sort_order: 4 },
  { item_key: "students", item_label: "Add students", sort_order: 5 },
  { item_key: "attendance", item_label: "Record first attendance", sort_order: 6 },
  { item_key: "first_payment", item_label: "Collect first payment", sort_order: 7 },
];

const ITEM_ORDER: Record<string, number> = Object.fromEntries(DEFAULT_ITEMS.map((item, i) => [item.item_key, i]));

function sortItems<T extends { item_key: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (ITEM_ORDER[a.item_key] ?? 999) - (ITEM_ORDER[b.item_key] ?? 999));
}

async function handleGet(request: NextRequest) {
  const auth = await requireUserWithSchool(request);
  if (!auth.ok) return auth.response;

  const schoolId = auth.context.schoolId;
  if (!schoolId) {
    return apiError("School context required", 403);
  }

  // This GET normally repairs and updates checklist rows. Keep demo sessions
  // isolated even though the route is read-shaped: never run those service-role
  // writes against a shared database while previewing the demo.
  if (auth.context.isDemo) {
    const items = DEFAULT_ITEMS.map((item) => ({
      ...item,
      school_id: schoolId,
      is_completed: false,
      completed_at: null,
    }));
    return apiSuccess({
      items,
      progress: 0,
      completed: 0,
      total: items.length,
      counts: { classes: 0, subjects: 0, staff: 0, students: 0, fee_payments: 0, attendance: 0 },
      has_existing_data: false,
      has_term: false,
      school_complete: false,
      school: { has_name: true, has_email: false, has_phone: false, has_logo: true },
    });
  }

  const supabase = createServiceRoleClientOrThrow();

  // Ensure default checklist rows exist for this school.
  await supabase.from("setup_checklist").upsert(
    DEFAULT_ITEMS.map((item) => ({ ...item, school_id: schoolId })),
    { onConflict: "school_id,item_key" },
  );
  // Self-heal: drop legacy item keys from the pre-migration set so schools
  // whose DB never ran the swap migration don't see stale/duplicate steps.
  // (The upsert above guarantees the current 8 exist, so this only removes.)
  await supabase
    .from("setup_checklist")
    .delete()
    .eq("school_id", schoolId)
    .not(
      "item_key",
      "in",
      "(school_details,academic_term,classes,subjects,teachers,students,attendance,first_payment)",
    );
  // School completeness: name isn't the placeholder, and email/phone/logo present.
  const { data: school } = await supabase
    .from("schools")
    .select("name, email, phone, logo_url")
    .eq("id", schoolId)
    .maybeSingle();

  const schoolName = (school?.name || "").trim();
  const schoolComplete =
    Boolean(school) &&
    schoolName !== "" &&
    schoolName.toLowerCase() !== "my school" &&
    Boolean((school?.email || "").trim()) &&
    Boolean((school?.phone || "").trim()) &&
    Boolean(school?.logo_url);

  // Current term present.
  const { count: termCount } = await supabase
    .from("academic_terms")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("is_current", true);
  const hasTerm = (termCount ?? 0) > 0;

  // Simple counts scoped by school_id.
  const countRules: Array<{ key: string; table: string }> = [
    { key: "classes", table: "classes" },
    { key: "subjects", table: "subjects" },
    { key: "staff", table: "staff" },
    { key: "students", table: "students" },
    { key: "fee_payments", table: "fee_payments" },
  ];

  const counts: Record<string, number> = {};
  for (const rule of countRules) {
    const { count } = await supabase
      .from(rule.table)
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId);
    counts[rule.key] = count ?? 0;
  }

  // The Staff screen is backed by active school user accounts, not only the
  // payroll `staff` table. Match its inclusion rule so valid roles such as
  // class_teacher, school_admin, deputy_headteacher, and subject_teacher do
  // not leave the setup checklist claiming that staff are missing.
  const { count: accountStaffCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .not("role", "in", '("parent","student")');
  counts.staff = Math.max(counts.staff ?? 0, accountStaffCount ?? 0);

  // attendance has no school_id column — count via students of this school.
  const { data: studentIds } = await supabase.from("students").select("id").eq("school_id", schoolId);
  const ids = (studentIds ?? []).map((s: { id: string }) => s.id);
  const attendanceQuery = await (ids.length > 0
    ? supabase.from("attendance").select("id", { count: "exact", head: true }).in("student_id", ids)
    : Promise.resolve({ count: 0 }));
  counts.attendance = attendanceQuery.count ?? 0;

  // Map item_key -> done based on real data.
  // Additionally, if a school already has students enrolled, consider school
  // details complete even if the name is still the default "My School" — this
  // handles the case where onboarding was completed functionally but the UI
  // name hasn't been updated yet.
  const studentCount = counts.students > 0 ? counts.students : 0;
  const detailsCompleteForPopulatedSchool =
    studentCount > 0 && schoolName !== "" && schoolName.toLowerCase() !== "my school" ? true : schoolComplete;

  const detected: Record<string, boolean> = {
    school_details: detailsCompleteForPopulatedSchool,
    academic_term: hasTerm,
    classes: counts.classes > 0,
    subjects: counts.subjects > 0,
    teachers: counts.staff > 0,
    students: counts.students > 0,
    attendance: counts.attendance > 0,
    first_payment: counts.fee_payments > 0,
  };

  // Existing records are a better signal than a legacy/missing onboarding
  // flag. This lets the dashboard distinguish an established school from a
  // newly registered school before deciding to show the full setup wizard.
  const has_existing_data = counts.staff > 0 || counts.students > 0 || counts.attendance > 0 || counts.fee_payments > 0;

  // Persist auto-completions so manual state reflects reality.
  for (const [key, done] of Object.entries(detected)) {
    if (done) {
      await supabase
        .from("setup_checklist")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq("school_id", schoolId)
        .eq("item_key", key)
        .is("is_completed", false);
    }
  }

  // NOTE: previously completed rows are never reset here — the loop above
  // only flips false -> true, so manual completion state always survives.

  const { data: items } = await supabase.from("setup_checklist").select("*").eq("school_id", schoolId);

  const list = sortItems(items ?? []);
  const completed = list.filter((item) => item.is_completed).length;
  const progress = list.length > 0 ? Math.round((completed / list.length) * 100) : 0;

  return apiSuccess({
    items: list,
    progress,
    completed,
    total: list.length,
    counts,
    has_existing_data,
    has_term: hasTerm,
    school_complete: schoolComplete,
    school: {
      has_name: schoolName !== "" && schoolName.toLowerCase() !== "my school",
      has_email: Boolean((school?.email || "").trim()),
      has_phone: Boolean((school?.phone || "").trim()),
      has_logo: Boolean(school?.logo_url),
    },
  });
}

export const GET = withSecurity(handleGet, {
  rateLimit: { limit: 60, windowMs: 60000 },
});
