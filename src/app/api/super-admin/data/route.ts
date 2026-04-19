import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/user-provisioning";
import { requireUserWithSchool } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  // Verify the caller is super_admin
  const auth = await requireUserWithSchool(request);
  if (!auth.ok) return auth.response;
  if (auth.context.user.role !== "super_admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = createSupabaseAdminClient();

    const [schoolsRes, usersRes, studentsRes] = await Promise.all([
      admin
        .from("schools")
        .select(
          "id, name, school_code, district, school_type, ownership, phone, email, logo_url, primary_color, subscription_plan, subscription_status, trial_ends_at, feature_stage, created_at, address, motto, principal_name, report_header, report_footer, id_card_style",
        )
        .order("created_at", { ascending: false }),
      admin
        .from("users")
        .select("id, full_name, phone, role, school_id, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      // Count students per school from the users table (role = 'student')
      admin
        .from("users")
        .select("school_id")
        .eq("role", "student")
        .not("school_id", "is", null),
    ]);

    if (schoolsRes.error) {
      console.error("[super-admin/data] schools query error:", schoolsRes.error);
      const fallbackRes = await admin
        .from("schools")
        .select(
          "id, name, district, school_type, ownership, phone, email, logo_url, primary_color, subscription_plan, subscription_status, trial_ends_at, created_at",
        )
        .order("created_at", { ascending: false });

      if (fallbackRes.error) {
        return NextResponse.json(
          { success: false, error: fallbackRes.error.message },
          { status: 500 },
        );
      }
      return NextResponse.json({
        success: true,
        schools: fallbackRes.data ?? [],
        users: usersRes.data ?? [],
      });
    }

    // Build student count map: school_id → count
    const studentCountMap: Record<string, number> = {};
    for (const row of studentsRes.data ?? []) {
      const sid = row.school_id as string;
      studentCountMap[sid] = (studentCountMap[sid] ?? 0) + 1;
    }

    const schools = (schoolsRes.data ?? []).map((s: any) => ({
      ...s,
      student_count: studentCountMap[s.id] ?? 0,
    }));

    return NextResponse.json({
      success: true,
      schools,
      users: usersRes.data ?? [],
    });
  } catch (err: any) {
    console.error("[super-admin/data] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
