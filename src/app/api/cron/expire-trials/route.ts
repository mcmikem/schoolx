import { NextRequest, NextResponse } from "next/server";
import { requireCronSecretOrDeny, createServiceRoleClientOrThrow } from "@/lib/api-utils";
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
      logger.error("[Cron Expire Trials] Fetch error:", fetchError);
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
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
      logger.error("[Cron Expire Trials] Update error:", updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    logger.info(
      `[Cron Expire Trials] Expired ${ids.length} trials:`,
      expiredTrials.map((s) => s.name),
    );

    return NextResponse.json({
      success: true,
      timestamp: now,
      results: {
        expired: ids.length,
        schools: expiredTrials.map((s) => ({ id: s.id, name: s.name })),
      },
    });
  } catch (error) {
    logger.error("[Cron Expire Trials] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
