import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError, requireAuthenticatedUser, supabaseClientOptions } from "@/lib/api-utils";
import { normalizePlanType } from "@/lib/payments/subscription-client";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceKey) return apiError("Server configuration error", 500);

    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      supabaseClientOptions({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("id, role, school_id")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || !profile.school_id) {
      return apiError("No school associated with this account", 403);
    }

    if (!["school_admin", "admin", "headmaster", "super_admin"].includes(profile.role)) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const newPlan = normalizePlanType(body.plan);

    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("subscription_plan, subscription_status")
      .eq("id", profile.school_id)
      .maybeSingle();

    if (!school) return apiError("School not found", 404);

    const currentPlan = school.subscription_plan;
    const VALID_PLANS = ["free_trial", "starter", "growth", "enterprise"];
    const currentIdx = VALID_PLANS.indexOf(currentPlan);
    const newIdx = VALID_PLANS.indexOf(newPlan);

    if (newIdx < 0) return apiError("Invalid plan", 400);
    if (newIdx <= currentIdx && profile.role !== "super_admin") {
      return apiError("Can only upgrade to a higher plan", 400);
    }

    const { error: updateError } = await supabaseAdmin
      .from("schools")
      .update({
        subscription_plan: newPlan,
        subscription_status: school.subscription_status === "expired" ? "trial" : school.subscription_status,
      })
      .eq("id", profile.school_id);

    if (updateError) throw updateError;

    // Log the upgrade
    await supabaseAdmin
      .from("audit_log")
      .insert({
        school_id: profile.school_id,
        user_id: auth.context.authUserId,
        action: "update",
        module: "subscription",
        details: `Plan upgraded from ${currentPlan} to ${newPlan}`,
      })
      .maybeSingle();

    logger.info(`[Upgrade] School ${profile.school_id} upgraded from ${currentPlan} to ${newPlan}`);

    return apiSuccess({ plan: newPlan }, `Upgraded to ${newPlan} successfully`);
  } catch (error) {
    logger.error("[Upgrade] Error:", error);
    return handleApiError(error);
  }
}
