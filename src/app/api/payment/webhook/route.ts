import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sendPaymentReceipt, handleSubscriptionChange, PLAN_PRICES } from "@/lib/subscription";
import { PlanType } from "@/lib/payments/subscription-client";
import { logger } from "@/lib/logger";
import { checkAndRecordIdempotency, markWebhookProcessed } from "@/lib/payments/idempotency";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!sig) {
    return new NextResponse("Missing stripe signature", { status: 400 });
  }

  if (!webhookSecret) {
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  if (!stripeSecretKey) {
    return new NextResponse("Stripe secret key not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    logger.error("Webhook signature verification failed");
    return new NextResponse("Webhook signature verification failed", { status: 400 });
  }

  let hadError = false;

  // Idempotency check: skip duplicate webhook deliveries
  const { shouldProcess } = await checkAndRecordIdempotency(event.id, "stripe", event.type, {
    id: event.id,
    type: event.type,
  });
  if (!shouldProcess) {
    return new NextResponse(JSON.stringify({ received: true, skipped: "duplicate" }), { status: 200 });
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      logger.debug(`Checkout session completed: ${session.id}`);

      if (session.mode === "subscription" && session.subscription) {
        try {
          const subscription = (await stripe.subscriptions.retrieve(session.subscription as string, {
            expand: ["customer", "items.data.price"],
          })) as unknown as {
            status: string;
            items: { data: { price: any }[] };
            id: string;
          };

          await handleSubscriptionChange(session.metadata?.school_id || "", {
            status: mapStripeSubscriptionStatus(subscription.status),
            plan: determinePlanFromPrice(subscription.items.data[0]?.price),
            provider: "stripe",
            subscriptionId: subscription.id,
          });
        } catch (error) {
          logger.error("Error handling checkout session completed:", error);
          hadError = true;
        }
      }

      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;

      logger.debug(`Invoice payment succeeded: ${invoice.id}`);

      try {
        const subscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : null;

        if (!subscriptionId) {
          throw new Error("Missing subscription id on paid invoice");
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["customer", "items.data.price"],
        });

        const schoolId =
          invoice.metadata?.school_id || (subscription.customer as Stripe.Customer)?.metadata?.school_id || "";

        await handleSubscriptionChange(schoolId, {
          status: "active",
          plan: determinePlanFromPrice(subscription.items.data[0]?.price),
          provider: "stripe",
          subscriptionId: subscription.id,
        });
      } catch (error) {
        logger.error("Error handling invoice.payment_succeeded:", error);
        hadError = true;
      }

      try {
        const subscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : null;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["customer", "items.data.price"],
          });

          const schoolId =
            invoice.metadata?.school_id || (subscription.customer as Stripe.Customer)?.metadata?.school_id || "";

          await sendPaymentReceipt(schoolId, {
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
            date: new Date(invoice.created * 1000).toISOString(),
            plan: determinePlanFromPrice(subscription.items.data[0]?.price),
            provider: "stripe",
            transactionId: (invoice as unknown as { payment_intent: string }).payment_intent as string,
          });
        }
      } catch (error) {
        logger.error("Error sending payment receipt (non-critical):", error);
        hadError = true;
      }

      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;

      logger.debug(`Invoice payment failed: ${invoice.id}`);

      try {
        await handleSubscriptionChange(invoice.metadata?.school_id || "", {
          status: "past_due",
          provider: "stripe",
        });
      } catch (error) {
        logger.error("Error handling invoice.payment_failed:", error);
        hadError = true;
      }

      break;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object;

      logger.debug(`Subscription created: ${subscription.id}`);

      try {
        await handleSubscriptionChange(subscription.metadata?.school_id || "", {
          status: mapStripeSubscriptionStatus(subscription.status),
          plan: determinePlanFromPrice(subscription.items.data[0]?.price),
          provider: "stripe",
          subscriptionId: subscription.id,
        });
      } catch (error) {
        logger.error("Error handling customer.subscription.created:", error);
        hadError = true;
      }

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;

      logger.debug(`Subscription updated: ${subscription.id}`);

      try {
        await handleSubscriptionChange(subscription.metadata?.school_id || "", {
          status: mapStripeSubscriptionStatus(subscription.status),
          plan: determinePlanFromPrice(subscription.items.data[0]?.price),
          provider: "stripe",
          subscriptionId: subscription.id,
        });
      } catch (error) {
        logger.error("Error handling customer.subscription.updated:", error);
        hadError = true;
      }

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;

      logger.debug(`Subscription deleted: ${subscription.id}`);

      try {
        await handleSubscriptionChange(subscription.metadata?.school_id || "", {
          status: "canceled",
          provider: "stripe",
        });
      } catch (error) {
        logger.error("Error handling customer.subscription.deleted:", error);
        hadError = true;
      }

      break;
    }

    case "charge.refunded": {
      const charge = event.data.object;

      logger.debug(`Charge refunded: ${charge.id}`);

      try {
        const schoolId = (charge.metadata?.school_id as string) || "";
        if (schoolId) {
          await handleSubscriptionChange(schoolId, {
            status: "past_due",
            provider: "stripe",
          });
        }
      } catch (error) {
        logger.error("Error handling charge.refunded:", error);
        hadError = true;
      }

      break;
    }

    default:
      logger.debug(`Unhandled Stripe event type: ${event.type}`);
  }

  await markWebhookProcessed(event.id, "stripe", hadError ? "Some events failed processing" : undefined);
  if (hadError) {
    // Signal failure so Stripe retries delivery; idempotency allows reprocessing.
    return new NextResponse(JSON.stringify({ received: false, error: "Some events failed processing" }), {
      status: 500,
    });
  }
  return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
}

// Map Stripe price IDs to our plan types
const PRICE_TO_PLAN_MAP: Record<string, PlanType> = {
  price_starter: "starter",
  price_growth: "growth",
  price_enterprise: "enterprise",
  price_lifetime: "lifetime",
};

// Helper function to determine plan from Stripe price
function determinePlanFromPrice(price: any): PlanType {
  if (!price) return "free_trial";
  // If we have a price ID, try to map it
  if (price?.id) {
    const plan = PRICE_TO_PLAN_MAP[price.id];
    if (plan) return plan;
  }

  // Fallback: try to determine from amount (in cents) converted to UGX via dynamic rate
  const amount = price?.unit_amount;
  if (amount) {
    // Use inline rate since this runs synchronously in the webhook handler
    const rate = Number(process.env.FX_RATE_FALLBACK) || 3700;
    const ugxAmount = Math.round((amount / 100) * rate);
    const ugxPrice = PLAN_PRICES;

    if (ugxAmount >= (ugxPrice.lifetime.oneTime || 12000000)) return "lifetime";
    if (ugxAmount >= (ugxPrice.enterprise.term || 5500) * 50) return "enterprise";
    if (ugxAmount >= (ugxPrice.growth.term || 3500) * 50) return "growth";
    if (ugxAmount >= (ugxPrice.starter.term || 2000) * 50) return "starter";
    return "free_trial";
  }

  // Default to growth if we can't determine
  return "growth";
}
function mapStripeSubscriptionStatus(
  status: any,
): "active" | "trial" | "canceled" | "past_due" | "unpaid" | "suspended" {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trial";
    case "canceled":
      return "canceled";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "paused":
      return "suspended";
    case "incomplete":
    case "incomplete_expired":
    default:
      return "active";
  }
}
