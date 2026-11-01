import { NextRequest, NextResponse } from "next/server";
import { requireCronSecretOrDeny, createServiceRoleClientOrThrow } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { sendSchoolMessage } from "@/lib/messaging";
import { formatDate } from "@/lib/billing/config";

// Local date for SMS display handled via formatDate (timezone-safe).

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/renewal-reminders/
 *
 * Nightly:
 *  1. Applies scheduled downgrades whose effective date has arrived.
 *  2. Marks active schools whose next_payment_date has passed as expired
 *     (the subscription guard's grace period takes over from there).
 *  3. Sends T-7 and T-1 renewal reminder SMS to schools with a phone number.
 */
export async function GET(request: NextRequest) {
  const cron = requireCronSecretOrDeny(request);
  if (!cron.ok) return cron.response;

  const supabase = createServiceRoleClientOrThrow();
  const now = new Date();
  const nowIso = now.toISOString();

  const results = {
    downgradesApplied: 0,
    markedExpired: 0,
    remindersSent: 0,
    errors: [] as string[],
  };

  // ── 1. Scheduled downgrades ──────────────────────────────────────────────
  try {
    const { data: due, error } = await supabase
      .from("schools")
      .select("id, name, scheduled_plan")
      .neq("scheduled_plan", null)
      .lte("scheduled_plan_change_at", nowIso);

    if (error) throw error;

    for (const school of due || []) {
      const { error: applyError } = await supabase
        .from("schools")
        .update({
          subscription_plan: school.scheduled_plan,
          subscription_status: school.scheduled_plan === "free_trial" ? "expired" : "active",
          scheduled_plan: null,
          scheduled_plan_change_at: null,
        })
        .eq("id", school.id);
      if (applyError) {
        results.errors.push(`downgrade ${school.id}: ${applyError.message}`);
      } else {
        results.downgradesApplied += 1;
        logger.info(`[Cron Renewal] Downgrade applied for ${school.name} → ${school.scheduled_plan}`);
      }
    }
  } catch (err) {
    results.errors.push(`downgrades: ${(err as Error).message}`);
  }

  // ── 2. Expire active subscriptions past their payment date ──────────────
  try {
    const { data: ended, error } = await supabase
      .from("schools")
      .select("id, name")
      .eq("subscription_status", "active")
      .neq("subscription_plan", "lifetime")
      .not("next_payment_date", "is", null)
      .lt("next_payment_date", nowIso);

    if (error) throw error;
    if (ended && ended.length > 0) {
      const { error: updateError } = await supabase
        .from("schools")
        .update({ subscription_status: "expired" })
        .in(
          "id",
          ended.map((s) => s.id),
        );
      if (updateError) throw updateError;
      results.markedExpired = ended.length;
    }
  } catch (err) {
    results.errors.push(`expiry: ${(err as Error).message}`);
  }

  // ── 3. Renewal reminders (T-7 and T-1) ───────────────────────────────────
  try {
    const day = 24 * 60 * 60 * 1000;
    const windows: Array<{ days: number; until: string; from: string }> = [7, 1].map((days) => {
      const from = new Date(now.getTime() + days * day).toISOString();
      const until = new Date(now.getTime() + (days + 1) * day).toISOString();
      return { days, from, until };
    });

    for (const window of windows) {
      const { data: due, error } = await supabase
        .from("schools")
        .select("id, name, phone, next_payment_date, subscription_plan")
        .eq("subscription_status", "active")
        .neq("subscription_plan", "lifetime")
        .not("next_payment_date", "is", null)
        .not("phone", "is", null)
        .gte("next_payment_date", window.from)
        .lt("next_payment_date", window.until);

      if (error) throw error;

      for (const school of due || []) {
        const expires = formatDate(school.next_payment_date);
        const message =
          window.days === 1
            ? `SKOOLMATE: Your ${school.subscription_plan} subscription expires tomorrow (${expires}). Renew now to avoid interruption.`
            : `SKOOLMATE: Your ${school.subscription_plan} subscription renews in ${window.days} days (${expires}). Renew early to keep discounts active.`;
        const sms = await sendSchoolMessage(school.phone, message, {
          schoolId: school.id,
          kind: "payment_confirmation",
        });
        if (sms.success) results.remindersSent += 1;
      }
    }
  } catch (err) {
    results.errors.push(`reminders: ${(err as Error).message}`);
  }

  return NextResponse.json({ success: true, timestamp: nowIso, results });
}
