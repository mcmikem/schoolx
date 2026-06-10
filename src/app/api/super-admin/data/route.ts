import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/user-provisioning";
import { requireUserWithSchool } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const DEMO_COOKIE = "skoolmate_demo_v1";
const DEMO_MODE_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

function isSupabaseUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Supabase server client is not configured");
}

function hasDemoSuperAdminSession(request: NextRequest): boolean {
  if (!DEMO_MODE_ENABLED) return false;
  const cookieValue = request.cookies.get(DEMO_COOKIE)?.value;
  if (!cookieValue) return false;

  try {
    const decoded = Buffer.from(cookieValue, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as {
      demoUser?: { role?: unknown };
      demoSchool?: { id?: unknown; name?: unknown };
    };

    return Boolean(
      parsed.demoUser?.role === "super_admin" &&
        typeof parsed.demoSchool?.id === "string" &&
        typeof parsed.demoSchool?.name === "string",
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (hasDemoSuperAdminSession(request)) {
    return NextResponse.json({
      success: true,
      schools: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          name: "St. Mary's Primary School (Demo)",
          school_code: "DEMO001",
          district: "Kampala",
          school_type: "primary",
          ownership: "private",
          phone: "+256700000000",
          email: "demo@omuto.org",
          logo_url: "",
          primary_color: "#17325F",
          subscription_plan: "growth",
          subscription_status: "active",
          trial_ends_at: null,
          feature_stage: "full",
          created_at: new Date().toISOString(),
          address: "Demo Road",
          motto: "Learning for Life",
          principal_name: "John Headmaster",
          report_header: "",
          report_footer: "",
          id_card_style: "default",
          student_count: 0,
        },
      ],
      users: [
        {
          id: "demo-super-admin",
          full_name: "SkoolMate Super Admin",
          phone: "256700000006",
          role: "super_admin",
          school_id: null,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ],
    });
  }

  // Verify the caller is super_admin
  let auth;
  try {
    auth = await requireUserWithSchool(request);
  } catch (error) {
    if (DEMO_MODE_ENABLED && isSupabaseUnavailableError(error)) {
      logger.warn("[super-admin/data] degraded mode: Supabase unavailable in dev");
      return NextResponse.json({
        success: true,
        schools: [],
        users: [],
        degraded: true,
      });
    }
    throw error;
  }

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
      // Count active enrolled students per school from the students table (source of truth)
      admin
        .from("students")
        .select("school_id")
        .eq("status", "active")
        .not("school_id", "is", null),
    ]);

    if (schoolsRes.error) {
      logger.error("[super-admin/data] schools query error:", schoolsRes.error);
      const fallbackRes = await admin
        .from("schools")
        .select(
          "id, name, district, school_type, ownership, phone, email, logo_url, primary_color, subscription_plan, subscription_status, trial_ends_at, created_at",
        )
        .order("created_at", { ascending: false });

      if (fallbackRes.error) {
        return NextResponse.json(
          { success: false, error: "Internal server error" },
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
    logger.error("[super-admin/data] error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
