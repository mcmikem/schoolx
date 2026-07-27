import { NextRequest } from "next/server";
import {
  createServiceRoleClientOrThrow,
  apiSuccess,
  apiError,
  handleApiError,
  requireAuthenticatedUser,
} from "@/lib/api-utils";
import { withTimeout } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";

const MISSING_SCHEMA_CODES = new Set(["42P01", "42703"]);

function isSchemaError(error: unknown): boolean {
  return MISSING_SCHEMA_CODES.has((error as { code?: string }).code || "");
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabase = createServiceRoleClientOrThrow();

    const profileRes = await withTimeout(
      supabase.from("users").select("id, role").eq("auth_id", auth.context.authUserId).maybeSingle(),
      5000,
      null,
    );

    if (!profileRes) return apiError("Database timeout. Please try again.", 500);

    const profile = profileRes.data;
    if (!profile || (profile.role !== "marketer" && profile.role !== "super_admin")) {
      return apiError("Forbidden", 403);
    }

    let schools: any[] = [];
    let earnings: any[] = [];
    let payouts: any[] = [];

    // Schools data — gracefully handle missing onboarded_by column
    const schoolsRes = await withTimeout(
      supabase
        .from("schools")
        .select(
          "id, name, school_code, district, school_type, subscription_plan, subscription_status, student_count, created_at, trial_ends_at, phone, email, onboarding_completed, onboarding_complete",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      10000,
      null,
    );

    if (schoolsRes?.data) {
      schools = schoolsRes.data;
    } else if (schoolsRes?.error && !isSchemaError(schoolsRes.error)) {
      logger.error("Schools fetch error:", schoolsRes.error);
    }

    // Attempt to load onboarded_by if column exists
    if (schools.length > 0) {
      const onboardedRes = await withTimeout(supabase.from("schools").select("id, onboarded_by"), 5000, null);
      if (onboardedRes?.data) {
        const onboardedMap = new Map(onboardedRes.data.map((s: any) => [s.id, s.onboarded_by]));
        schools = schools.map((s: any) => ({ ...s, onboarded_by: onboardedMap.get(s.id) || null }));
      } else {
        schools = schools.map((s: any) => ({ ...s, onboarded_by: null }));
      }
    }

    // Earnings & payouts — gracefully handle missing tables
    if (profile.role === "marketer") {
      const [er, pr] = await Promise.all([
        withTimeout(
          supabase
            .from("marketer_earnings")
            .select("*, schools(name, school_code)")
            .eq("marketer_id", profile.id)
            .order("created_at", { ascending: false }),
          5000,
          null,
        ),
        withTimeout(
          supabase
            .from("marketer_payouts")
            .select("*")
            .eq("marketer_id", profile.id)
            .order("created_at", { ascending: false }),
          5000,
          null,
        ),
      ]);
      if (er?.data) earnings = er.data;
      else if (er?.error && !isSchemaError(er.error)) logger.error("Earnings fetch error:", er.error);
      if (pr?.data) payouts = pr.data;
      else if (pr?.error && !isSchemaError(pr.error)) logger.error("Payouts fetch error:", pr.error);
    } else {
      const [er, pr] = await Promise.all([
        withTimeout(
          supabase
            .from("marketer_earnings")
            .select("*, schools(name, school_code)")
            .order("created_at", { ascending: false }),
          5000,
          null,
        ),
        withTimeout(
          supabase.from("marketer_payouts").select("*").order("created_at", { ascending: false }),
          5000,
          null,
        ),
      ]);
      if (er?.data) earnings = er.data;
      else if (er?.error && !isSchemaError(er.error)) logger.error("Earnings fetch error:", er.error);
      if (pr?.data) payouts = pr.data;
      else if (pr?.error && !isSchemaError(pr.error)) logger.error("Payouts fetch error:", pr.error);
    }

    const totalEarned = earnings.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const pendingEarnings = earnings
      .filter((e: any) => e.status === "pending" || e.status === "approved")
      .reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const totalPaid = payouts
      .filter((p: any) => p.status === "paid")
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    const mySchools =
      profile.role === "marketer" ? schools.filter((s: any) => s.onboarded_by === profile.id).length : 0;

    return apiSuccess({
      schools,
      earnings,
      payouts,
      summary: {
        totalEarned,
        pendingEarnings,
        totalPaid,
        mySchools,
        balance: totalEarned - totalPaid,
      },
    });
  } catch (error) {
    logger.error("GET /api/marketers/data error:", error);
    return handleApiError(error);
  }
}
