import { createSupabaseServerClient } from "../supabase/server";
import { logger } from "../logger";

export async function checkAndRecordIdempotency(
  eventId: string,
  provider: string,
  eventType: string,
  rawBody?: unknown,
): Promise<{ alreadyProcessed: boolean; shouldProcess: boolean }> {
  try {
    const supabase = await createSupabaseServerClient();

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
      // "received" or "failed": a previous attempt did not complete (crash or 500).
      // Allow reprocessing so provider retries actually take effect.
      logger.warn(`Re-processing webhook event ${eventId} (${eventType}), previous status=${existing.status}`);
      return { alreadyProcessed: false, shouldProcess: true };
    }

    const { error: insertError } = await supabase.from("webhook_events").insert({
      provider,
      event_type: eventType,
      event_id: eventId,
      raw_body: rawBody,
      status: "received",
    });

    if (insertError) {
      if (insertError.code === "23505") {
        logger.warn(`Race condition: duplicate webhook event ${eventId} already inserted`);
        return { alreadyProcessed: true, shouldProcess: false };
      }
      logger.error("Failed to record webhook event for idempotency:", insertError);
    }

    return { alreadyProcessed: false, shouldProcess: true };
  } catch (error) {
    logger.error("Idempotency check failed, allowing processing:", error);
    return { alreadyProcessed: false, shouldProcess: true };
  }
}

export async function markWebhookProcessed(eventId: string, provider: string, errorMessage?: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
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
