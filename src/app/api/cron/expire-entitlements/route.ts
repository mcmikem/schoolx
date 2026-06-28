import { NextRequest, NextResponse } from "next/server";
import { requireCronSecretOrDeny, createServiceRoleClientOrThrow } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const cron = requireCronSecretOrDeny(request);
  if (!cron.ok) return cron.response;

  try {
    const supabase = createServiceRoleClientOrThrow();
    const now = new Date().toISOString();

    const { data: expired, error: fetchError } = await supabase
      .from("school_module_entitlements")
      .select("id, school_id, module_key, status")
      .in("status", ["active", "trial"])
      .lt("ends_at", now);

    if (fetchError) {
      logger.error("Expire-entitlements cron: fetch error:", fetchError);
      return NextResponse.json({ success: false, error: "Failed to fetch entitlements" }, { status: 500 });
    }

    if (!expired || expired.length === 0) {
      // Side-effect: clean up old rate_limit_log rows
      await supabase
        .from("rate_limit_log")
        .delete()
        .lt("created_at", new Date(Date.now() - 3600000).toISOString());

      return NextResponse.json({
        success: true,
        timestamp: now,
        expired: 0,
        message: "No entitlements to expire",
      });
    }

    const ids = expired.map((e) => e.id);
    const { error: updateError } = await supabase
      .from("school_module_entitlements")
      .update({ status: "expired" })
      .in("id", ids);

    if (updateError) {
      logger.error("Expire-entitlements cron: update error:", updateError);
      return NextResponse.json({ success: false, error: "Failed to expire entitlements" }, { status: 500 });
    }

    // Log to webhook_events for audit trail
    const logEntries = expired.map((e) => ({
      provider: "system",
      event_type: "entitlement_expired",
      event_id: `expire-${e.id}`,
      raw_body: { school_id: e.school_id, module_key: e.module_key, previous_status: e.status },
      status: "processed" as const,
      processed_at: now,
    }));

    const { error: logError } = await supabase.from("webhook_events").insert(logEntries);
    if (logError) {
      logger.warn("Expire-entitlements cron: audit log insert failed (non-critical):", logError);
    }

    logger.info(`Expired ${expired.length} school module entitlements`);

    return NextResponse.json({
      success: true,
      timestamp: now,
      expired: expired.length,
    });
  } catch (error: any) {
    logger.error("Expire-entitlements cron: unexpected error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
