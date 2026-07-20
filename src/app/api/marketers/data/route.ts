import { NextRequest } from "next/server";
import {
  createServiceRoleClientOrThrow,
  apiSuccess,
  apiError,
  handleApiError,
  requireAuthenticatedUser,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabase = createServiceRoleClientOrThrow();

    const { data: profile } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || (profile.role !== "marketer" && profile.role !== "super_admin")) {
      return apiError("Forbidden", 403);
    }

    const schoolsQuery = supabase
      .from("schools")
      .select(
        "id, name, school_code, district, school_type, subscription_plan, subscription_status, student_count, created_at, trial_ends_at, onboarded_by",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    const [schoolsRes] = await Promise.all([schoolsQuery]);

    if (schoolsRes.error) return apiError("Failed to fetch data", 500);

    let earnings: any[] = [];
    let payouts: any[] = [];

    if (profile.role === "marketer") {
      const [er, pr] = await Promise.all([
        supabase
          .from("marketer_earnings")
          .select("*, schools(name, school_code)")
          .eq("marketer_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("marketer_payouts")
          .select("*")
          .eq("marketer_id", profile.id)
          .order("created_at", { ascending: false }),
      ]);
      earnings = er.data || [];
      payouts = pr.data || [];
    } else {
      const [er, pr] = await Promise.all([
        supabase
          .from("marketer_earnings")
          .select("*, schools(name, school_code)")
          .order("created_at", { ascending: false }),
        supabase.from("marketer_payouts").select("*").order("created_at", { ascending: false }),
      ]);
      earnings = er.data || [];
      payouts = pr.data || [];
    }

    const totalEarned = earnings.reduce((sum, e) => sum + Number(e.amount), 0);
    const pendingEarnings = earnings
      .filter((e) => e.status === "pending" || e.status === "approved")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPaid = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);

    const mySchools =
      profile.role === "marketer" ? (schoolsRes.data || []).filter((s) => s.onboarded_by === profile.id).length : 0;

    return apiSuccess({
      schools: schoolsRes.data || [],
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
