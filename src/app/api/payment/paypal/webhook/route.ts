import { NextResponse } from "next/server";
import { verifyPayPalWebhook } from "@/lib/payments/paypal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { updatePaymentStatus } from "@/lib/payments/utils";
import { sendPaymentReceipt } from "@/lib/subscription";

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const headers = request.headers;
    const transmissionId = headers.get("paypal-transmission-id");
    const transmissionTime = headers.get("paypal-transmission-time");
    const certUrl = headers.get("paypal-cert-url");
    const authAlgo = headers.get("paypal-auth-algo");
    const transmissionSig = headers.get("paypal-transmission-sig");
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      return NextResponse.json({ error: "Missing PayPal webhook headers" }, { status: 400 });
    }

    if (!webhookId) {
      return NextResponse.json({ error: "PayPal webhook is not configured" }, { status: 500 });
    }

    let webhookEvent;
    try {
      webhookEvent = JSON.parse(payload);
    } catch (parseError) {
      logger.error("Failed to parse PayPal webhook payload", { error: parseError });
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    const isVerified = await verifyPayPalWebhook(
      authAlgo,
      certUrl,
      transmissionId,
      transmissionSig,
      transmissionTime,
      webhookId,
      webhookEvent,
    );

    if (!isVerified) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    switch (webhookEvent.event_type) {
      case "PAYMENT.SALE.COMPLETED":
        try {
          await handlePayPalPaymentSuccess(webhookEvent.resource, supabase);
        } catch (error) {
          logger.error("Failed to handle PAYMENT.SALE.COMPLETED", { error });
          return NextResponse.json({ error: "Failed to process payment success" }, { status: 500 });
        }
        break;
      case "PAYMENT.SALE.DENIED":
        try {
          await handlePayPalPaymentFailure(webhookEvent.resource, supabase);
        } catch (error) {
          logger.error("Failed to handle PAYMENT.SALE.DENIED", { error });
          return NextResponse.json({ error: "Failed to process payment failure" }, { status: 500 });
        }
        break;
      case "BILLING.SUBSCRIPTION.ACTIVATED":
        try {
          await handlePayPalSubscriptionActivated(webhookEvent.resource, supabase);
        } catch (error) {
          logger.error("Failed to handle BILLING.SUBSCRIPTION.ACTIVATED", { error });
          return NextResponse.json({ error: "Failed to process subscription activation" }, { status: 500 });
        }
        break;
      case "BILLING.SUBSCRIPTION.CANCELLED":
        try {
          await handlePayPalSubscriptionCancelled(webhookEvent.resource, supabase);
        } catch (error) {
          logger.error("Failed to handle BILLING.SUBSCRIPTION.CANCELLED", { error });
          return NextResponse.json({ error: "Failed to process subscription cancellation" }, { status: 500 });
        }
        break;
      case "BILLING.SUBSCRIPTION.SUSPENDED":
        try {
          await handlePayPalSubscriptionSuspended(webhookEvent.resource, supabase);
        } catch (error) {
          logger.error("Failed to handle BILLING.SUBSCRIPTION.SUSPENDED", { error });
          return NextResponse.json({ error: "Failed to process subscription suspension" }, { status: 500 });
        }
        break;
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        try {
          await handlePayPalSubscriptionPaymentFailed(webhookEvent.resource, supabase);
        } catch (error) {
          logger.error("Failed to handle BILLING.SUBSCRIPTION.PAYMENT.FAILED", { error });
          return NextResponse.json({ error: "Failed to process subscription payment failure" }, { status: 500 });
        }
        break;
      default:
        logger.warn("Unhandled PayPal event type", {
          event_type: webhookEvent.event_type,
        });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    logger.error("PayPal webhook error", { error });
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

async function updateSchoolOrThrow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  updates: Record<string, unknown>,
) {
  const { error } = await supabase.from("schools").update(updates).eq("id", schoolId);
  if (error) {
    logger.error(`PayPal webhook: failed to update school ${schoolId}:`, error);
    throw error;
  }
}

async function handlePayPalPaymentSuccess(
  payment: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const schoolId = await resolveSchoolIdFromPayPalResource(payment, supabase);
  if (!schoolId) {
    logger.warn("No school ID found in PayPal payment resource — skipping");
    return;
  }

  const { data: school, error } = await supabase.from("schools").select("id").eq("id", schoolId).single();

  if (error || !school) {
    logger.warn(`School not found for PayPal payment: ${schoolId} — skipping`);
    return;
  }

  await updateSchoolOrThrow(supabase, school.id, {
    subscription_status: "active",
    subscription_plan: determinePlanFromAmount(Number(payment?.amount?.total || 0)),
    last_payment_at: new Date().toISOString(),
  });

  await markMatchingPayments(payment, "completed");
  logger.log(`PayPal payment successful for school ${school.id}`);

  try {
    await sendPaymentReceipt(school.id, {
      amount: Number(payment?.amount?.total || 0),
      currency: payment?.amount?.currency || "USD",
      date: new Date().toISOString(),
      plan: determinePlanFromAmount(Number(payment?.amount?.total || 0)),
      provider: "paypal",
      transactionId: payment?.id || payment?.sale_id || "",
    });
  } catch (receiptError) {
    logger.warn("Failed to send PayPal receipt (non-critical)", {
      schoolId: school.id,
      error: receiptError,
    });
  }
}

async function handlePayPalPaymentFailure(
  payment: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const schoolId = await resolveSchoolIdFromPayPalResource(payment, supabase);
  if (!schoolId) {
    logger.warn("No school ID found in PayPal payment resource — skipping");
    return;
  }

  const { data: school, error } = await supabase.from("schools").select("id").eq("id", schoolId).single();

  if (error || !school) {
    logger.warn(`School not found for PayPal payment: ${schoolId} — skipping`);
    return;
  }

  await updateSchoolOrThrow(supabase, school.id, {
    subscription_status: "past_due",
    last_payment_attempt: new Date().toISOString(),
  });

  await markMatchingPayments(payment, "failed");
  logger.log(`PayPal payment failed for school ${school.id}`);
}

async function handlePayPalSubscriptionActivated(
  subscription: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const schoolId = await resolveSchoolIdFromPayPalResource(subscription, supabase);
  if (!schoolId) {
    logger.warn("No school ID found in PayPal subscription resource — skipping");
    return;
  }

  const { data: school, error } = await supabase.from("schools").select("id").eq("id", schoolId).single();

  if (error || !school) {
    logger.warn(`School not found for PayPal subscription: ${schoolId} — skipping`);
    return;
  }

  await updateSchoolOrThrow(supabase, school.id, {
    paypal_subscription_id: subscription.id,
    subscription_status: "active",
    subscription_plan: determinePlanFromPlanId(subscription.plan_id),
  });

  logger.log(`PayPal subscription activated for school ${school.id}`);
}

async function handlePayPalSubscriptionCancelled(
  subscription: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const schoolId = await resolveSchoolIdFromPayPalResource(subscription, supabase);
  if (!schoolId) {
    logger.warn("No school ID found in PayPal subscription resource — skipping");
    return;
  }

  const { data: school, error } = await supabase.from("schools").select("id").eq("id", schoolId).single();

  if (error || !school) {
    logger.warn(`School not found for PayPal subscription: ${schoolId} — skipping`);
    return;
  }

  await updateSchoolOrThrow(supabase, school.id, {
    subscription_status: "expired",
    subscription_plan: "free_trial",
    paypal_subscription_id: null,
  });

  logger.log(`PayPal subscription cancelled for school ${school.id}`);
}

async function handlePayPalSubscriptionSuspended(
  subscription: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const schoolId = await resolveSchoolIdFromPayPalResource(subscription, supabase);
  if (!schoolId) {
    logger.warn("No school ID found in PayPal subscription resource — skipping");
    return;
  }

  const { data: school, error } = await supabase.from("schools").select("id").eq("id", schoolId).single();

  if (error || !school) {
    logger.warn(`School not found for PayPal subscription: ${schoolId} — skipping`);
    return;
  }

  await updateSchoolOrThrow(supabase, school.id, {
    subscription_status: "past_due",
  });

  logger.log(`PayPal subscription suspended for school ${school.id}`);
}

async function handlePayPalSubscriptionPaymentFailed(
  subscription: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const schoolId = await resolveSchoolIdFromPayPalResource(subscription, supabase);
  if (!schoolId) {
    logger.warn("No school ID found in PayPal subscription resource — skipping");
    return;
  }

  const { data: school, error } = await supabase.from("schools").select("id").eq("id", schoolId).single();

  if (error || !school) {
    logger.warn(`School not found for PayPal subscription: ${schoolId} — skipping`);
    return;
  }

  await updateSchoolOrThrow(supabase, school.id, {
    subscription_status: "past_due",
    last_payment_attempt: new Date().toISOString(),
  });

  logger.log(`PayPal subscription payment failed for school ${school.id}`);
}

function getPayPalResourceCandidates(resource: any): string[] {
  return Array.from(
    new Set(
      [
        resource?.custom,
        resource?.custom_id,
        resource?.id,
        resource?.billing_agreement_id,
        resource?.supplementary_data?.related_ids?.order_id,
        resource?.supplementary_data?.related_ids?.capture_id,
        resource?.supplementary_data?.related_ids?.authorization_id,
        resource?.supplementary_data?.related_ids?.subscription_id,
      ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0),
    ),
  );
}

async function resolveSchoolIdFromPayPalResource(
  resource: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  if (typeof resource?.custom === "string" && resource.custom.length > 0) {
    return resource.custom;
  }

  if (typeof resource?.custom_id === "string" && resource.custom_id.length > 0) {
    return resource.custom_id;
  }

  for (const candidate of getPayPalResourceCandidates(resource)) {
    const { data: transactionMatch } = await supabase
      .from("subscription_payments")
      .select("school_id")
      .eq("transaction_id", candidate)
      .limit(1)
      .maybeSingle();

    if (transactionMatch?.school_id) return transactionMatch.school_id;

    const { data: subscriptionMatch } = await supabase
      .from("subscription_payments")
      .select("school_id")
      .eq("subscription_id", candidate)
      .limit(1)
      .maybeSingle();

    if (subscriptionMatch?.school_id) return subscriptionMatch.school_id;
  }

  return null;
}

async function markMatchingPayments(resource: any, status: "completed" | "failed") {
  const paidAt = status === "completed" ? new Date().toISOString() : undefined;

  for (const candidate of getPayPalResourceCandidates(resource)) {
    try {
      await updatePaymentStatus(candidate, status, { paid_at: paidAt });
      return;
    } catch (error) {
      logger.warn("Failed to update PayPal payment status", {
        candidate,
        status,
        error,
      });
    }
  }
}

function determinePlanFromAmount(amount: number): "starter" | "growth" | "enterprise" | "lifetime" {
  if (amount <= 2000) return "starter";
  if (amount <= 3500) return "growth";
  if (amount <= 5500) return "enterprise";
  return "lifetime";
}

function determinePlanFromPlanId(planId: string): "starter" | "growth" | "enterprise" | "lifetime" {
  const planIdToPlan: Record<string, "starter" | "growth" | "enterprise" | "lifetime"> = {
    plan_starter: "starter",
    plan_growth: "growth",
    plan_enterprise: "enterprise",
    plan_lifetime: "lifetime",
  };

  return planIdToPlan[planId] || "starter";
}
