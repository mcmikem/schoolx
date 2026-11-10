import { NextRequest, NextResponse } from "next/server";
import { handleApiError, requireCronSecretOrDeny, createServiceRoleClientOrThrow } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const cron = requireCronSecretOrDeny(request);
  if (!cron.ok) return cron.response;

  try {
    const supabase = createServiceRoleClientOrThrow();
    const now = new Date().toISOString();

    const { data: expiredTrials, error: fetchError } = await supabase
      .from("schools")
      .select("id, name, trial_ends_at, subscription_plan")
      .eq("subscription_status", "trial")
      .lt("trial_ends_at", now);

    if (fetchError) {
      return handleApiError(fetchError);
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      return NextResponse.json({
        success: true,
        timestamp: now,
        results: { expired: 0, message: "No expired trials found" },
      });
    }

    const ids = expiredTrials.map((s) => s.id);
    const { error: updateError } = await supabase
      .from("schools")
      .update({
        subscription_status: "expired",
        subscription_plan: "free_trial",
      })
      .in("id", ids);

    if (updateError) {
      return handleApiError(updateError);
    }

    logger.info("[Cron Expire Trials] Expired trial subscriptions", { count: ids.length });

    return NextResponse.json({
      success: true,
      timestamp: now,
      results: {
        expired: ids.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
