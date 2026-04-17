import { NextResponse } from "next/server";
import { verifyPayPalWebhook } from "@/lib/payments/paypal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSchoolIdFromPaymentResource(payment: any): string | null {
  return (
    payment?.custom ||
    payment?.purchase_units?.[0]?.custom_id ||
    payment?.purchase_units?.[0]?.reference_id ||
    null
  );
}

function getSchoolIdFromSubscriptionResource(subscription: any): string | null {
  return subscription?.custom_id || subscription?.custom || null;
}

// Handle PayPal webhook events
export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const headers = request.headers;

    // Extract PayPal webhook headers
    const transmissionId = headers.get("paypal-transmission-id");
    const transmissionTime = headers.get("paypal-transmission-time");
    const certUrl = headers.get("paypal-cert-url");
    const authAlgo = headers.get("paypal-auth-algo");
    const transmissionSig = headers.get("paypal-transmission-sig");
    const webhookId = process.env.PAYPAL_WEBHOOK_ID!;

    // Verify webhook signature
    const isVerified = await verifyPayPalWebhook(
      authAlgo!,
      certUrl!,
      transmissionId!,
      transmissionSig!,
      transmissionTime!,
      webhookId,
      JSON.parse(payload),
    );

    if (!isVerified) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 },
      );
    }

    const webhookEvent = JSON.parse(payload);
    const supabase = await createSupabaseServerClient();

    // Handle the event
    switch (webhookEvent.event_type) {
      case "PAYMENT.SALE.COMPLETED":
        const paymentCompleted = webhookEvent.resource;
        await handlePayPalPaymentSuccess(paymentCompleted, supabase);
        break;

      case "PAYMENT.SALE.DENIED":
        const paymentDenied = webhookEvent.resource;
        await handlePayPalPaymentFailure(paymentDenied, supabase);
        break;

      case "BILLING.SUBSCRIPTION.ACTIVATED":
        const subscriptionActivated = webhookEvent.resource;
        await handlePayPalSubscriptionActivated(
          subscriptionActivated,
          supabase,
        );
        break;

      case "BILLING.SUBSCRIPTION.CANCELLED":
        const subscriptionCancelled = webhookEvent.resource;
        await handlePayPalSubscriptionCancelled(
          subscriptionCancelled,
          supabase,
        );
        break;

      case "BILLING.SUBSCRIPTION.SUSPENDED":
        const subscriptionSuspended = webhookEvent.resource;
        await handlePayPalSubscriptionSuspended(
          subscriptionSuspended,
          supabase,
        );
        break;

      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        const subscriptionPaymentFailed = webhookEvent.resource;
        await handlePayPalSubscriptionPaymentFailed(
          subscriptionPaymentFailed,
          supabase,
        );
        break;

      default:
        if (process.env.NODE_ENV === "development") {
          console.log(`Unhandled PayPal event type ${webhookEvent.event_type}`);
        }
    }

    // Return a 200 response to acknowledge receipt of the event
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
}

async function handlePayPalPaymentSuccess(
  payment: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  try {
    // Extract custom ID from payment (we would have stored school ID in custom field)
    const customId = getSchoolIdFromPaymentResource(payment);
    if (!customId) {
      console.error("No custom ID found in PayPal payment");
      return;
    }

    // Find the school by custom ID (we would store school ID in custom field when creating payment)
    const { data: school, error } = await supabase
      .from("schools")
      .select("id")
      .eq("id", customId)
      .single();

    if (error) {
      console.error("Error finding school for PayPal payment:", error);
      return;
    }

    // Update subscription status to active
    await supabase
      .from("schools")
      .update({
        subscription_status: "active",
        subscription_plan: determinePlanFromAmount(
          parseFloat(payment.amount.total),
        ),
        last_payment_at: new Date().toISOString(),
        // For PayPal, we might not have a next payment date immediately available
      })
      .eq("id", school.id);

    // Send receipt email/SMS (implementation would go here)
    console.log(`PayPal payment successful for school ${school.id}`);
  } catch (error) {
    console.error("Error handling PayPal payment success:", error);
  }
}

async function handlePayPalPaymentFailure(
  payment: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  try {
    // Extract custom ID from payment
    const customId = getSchoolIdFromPaymentResource(payment);
    if (!customId) {
      console.error("No custom ID found in PayPal payment");
      return;
    }

    // Find the school by custom ID
    const { data: school, error } = await supabase
      .from("schools")
      .select("id")
      .eq("id", customId)
      .single();

    if (error) {
      console.error("Error finding school for PayPal payment:", error);
      return;
    }

    // Update subscription status to past_due
    await supabase
      .from("schools")
      .update({
        subscription_status: "past_due",
        last_payment_attempt: new Date().toISOString(),
      })
      .eq("id", school.id);

    // Send failure notification email/SMS (implementation would go here)
    console.log(`PayPal payment failed for school ${school.id}`);
  } catch (error) {
    console.error("Error handling PayPal payment failure:", error);
  }
}

async function handlePayPalSubscriptionActivated(
  subscription: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  try {
    // Extract custom ID from subscription
    const customId = getSchoolIdFromSubscriptionResource(subscription);
    if (!customId) {
      console.error("No custom ID found in PayPal subscription");
      return;
    }

    // Find the school by custom ID
    const { data: school, error } = await supabase
      .from("schools")
      .select("id")
      .eq("id", customId)
      .single();

    if (error) {
      console.error("Error finding school for PayPal subscription:", error);
      return;
    }

    // Update school with subscription info
    await supabase
      .from("schools")
      .update({
        paypal_subscription_id: subscription.id,
        subscription_status: "active",
        subscription_plan: determinePlanFromPlanId(subscription.plan_id),
      })
      .eq("id", school.id);

    console.log(`PayPal subscription activated for school ${school.id}`);
  } catch (error) {
    console.error("Error handling PayPal subscription activated:", error);
  }
}

async function handlePayPalSubscriptionCancelled(
  subscription: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  try {
    // Extract custom ID from subscription
    const customId = getSchoolIdFromSubscriptionResource(subscription);
    if (!customId) {
      console.error("No custom ID found in PayPal subscription");
      return;
    }

    // Find the school by custom ID
    const { data: school, error } = await supabase
      .from("schools")
      .select("id")
      .eq("id", customId)
      .single();

    if (error) {
      console.error("Error finding school for PayPal subscription:", error);
      return;
    }

    // Update school to free_trial status
    await supabase
      .from("schools")
      .update({
        subscription_status: "expired",
        subscription_plan: "free_trial",
        paypal_subscription_id: null,
      })
      .eq("id", school.id);

    console.log(`PayPal subscription cancelled for school ${school.id}`);
  } catch (error) {
    console.error("Error handling PayPal subscription cancelled:", error);
  }
}

async function handlePayPalSubscriptionSuspended(
  subscription: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  try {
    // Extract custom ID from subscription
    const customId = getSchoolIdFromSubscriptionResource(subscription);
    if (!customId) {
      console.error("No custom ID found in PayPal subscription");
      return;
    }

    // Find the school by custom ID
    const { data: school, error } = await supabase
      .from("schools")
      .select("id")
      .eq("id", customId)
      .single();

    if (error) {
      console.error("Error finding school for PayPal subscription:", error);
      return;
    }

    // Update subscription status to past_due
    await supabase
      .from("schools")
      .update({
        subscription_status: "past_due",
      })
      .eq("id", school.id);

    console.log(`PayPal subscription suspended for school ${school.id}`);
  } catch (error) {
    console.error("Error handling PayPal subscription suspended:", error);
  }
}

async function handlePayPalSubscriptionPaymentFailed(
  subscription: any,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  try {
    // Extract custom ID from subscription
    const customId = getSchoolIdFromSubscriptionResource(subscription);
    if (!customId) {
      console.error("No custom ID found in PayPal subscription");
      return;
    }

    // Find the school by custom ID
    const { data: school, error } = await supabase
      .from("schools")
      .select("id")
      .eq("id", customId)
      .single();

    if (error) {
      console.error("Error finding school for PayPal subscription:", error);
      return;
    }

    // Update subscription status to past_due
    await supabase
      .from("schools")
      .update({
        subscription_status: "past_due",
        last_payment_attempt: new Date().toISOString(),
      })
      .eq("id", school.id);

    console.log(`PayPal subscription payment failed for school ${school.id}`);
  } catch (error) {
    console.error("Error handling PayPal subscription payment failed:", error);
  }
}

// Helper function to determine plan from amount
function determinePlanFromAmount(
  amount: number,
): "starter" | "growth" | "enterprise" | "lifetime" {
  // Map amounts to new pricing (per student/term)
  // Starter: 2000, Growth: 3500, Enterprise: 5500
  if (amount <= 2000) return "starter";
  if (amount <= 3500) return "growth";
  if (amount <= 5500) return "enterprise";
  return "lifetime";
}

// Helper function to determine plan from PayPal plan ID
function determinePlanFromPlanId(
  planId: string,
): "starter" | "growth" | "enterprise" | "lifetime" {
  // Map PayPal plan IDs to plans
  const planIdToPlan: Record<
    string,
    "starter" | "growth" | "enterprise" | "lifetime"
  > = {
    plan_starter: "starter",
    plan_growth: "growth",
    plan_enterprise: "enterprise",
    plan_lifetime: "lifetime",
  };

  return planIdToPlan[planId] || "starter";
}
