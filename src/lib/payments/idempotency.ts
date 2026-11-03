import { createServiceRoleClientOrThrow } from "@/lib/api-utils";
import { logger } from "../logger";

export async function checkAndRecordIdempotency(
  eventId: string,
  provider: string,
  eventType: string,
  rawBody?: unknown,
): Promise<{ alreadyProcessed: boolean; shouldProcess: boolean }> {
  try {
    // Webhook callbacks carry no user session, so the cookie-based server
    // client is denied by RLS on every row: the duplicate check always missed
    // and the insert always failed (silently), letting provider retries
    // double-credit payments. This ledger is service-role only.
    const supabase = createServiceRoleClientOrThrow();

    const { data: existing } = await supabase
      .from("webhook_events")
      .select("status")
      .eq("event_id", eventId)
      .eq("provider", provider)
      .single();

    if (existing) {
      if (existing.status === "processed") {
        logger.warn(`Duplicate webhook event detected: ${eventId} (${eventType}), already processed`);
        return { alreadyProcessed: true, shouldProcess: false };
      }
      if (existing.status === "processing") {
        logger.warn(`Concurrent webhook event ignored: ${eventId} (${eventType}) is already processing`);
        return { alreadyProcessed: true, shouldProcess: false };
      }
    }

    const { error: insertError } = await supabase.from("webhook_events").insert({
      provider,
      event_type: eventType,
      event_id: eventId,
      raw_body: rawBody,
      status: "received",
    });

    if (insertError && insertError.code !== "23505") {
      logger.error("Failed to record webhook event for idempotency:", insertError);
      return { alreadyProcessed: false, shouldProcess: false };
    }

    // Claim the row atomically. Only one webhook worker may transition a
    // received/failed event into processing; concurrent deliveries must wait
    // for the provider retry after the first worker marks it failed.
    const { data: claimed, error: claimError } = await supabase
      .from("webhook_events")
      .update({ status: "processing", error_message: null })
      .eq("event_id", eventId)
      .eq("provider", provider)
      .in("status", ["received", "failed"])
      .select("id")
      .maybeSingle();

    if (claimError) {
      logger.error("Failed to claim webhook event:", claimError);
      return { alreadyProcessed: false, shouldProcess: false };
    }
    if (!claimed) {
      return { alreadyProcessed: true, shouldProcess: false };
    }

    return { alreadyProcessed: false, shouldProcess: true };
  } catch (error) {
    logger.error("Idempotency check failed; refusing untracked webhook processing:", error);
    return { alreadyProcessed: false, shouldProcess: false };
  }
}

export async function markWebhookProcessed(eventId: string, provider: string, errorMessage?: string): Promise<void> {
  try {
    const supabase = createServiceRoleClientOrThrow();
    await supabase
      .from("webhook_events")
      .update({
        status: errorMessage ? "failed" : "processed",
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId)
      .eq("provider", provider);
  } catch (error) {
    logger.error("Failed to update webhook event status:", error);
  }
}
