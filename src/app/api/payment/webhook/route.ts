import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  sendPaymentReceipt,
  handleSubscriptionChange,
} from "@/lib/subscription";
import { PlanType } from "@/lib/payments/subscription-client";

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
    console.error("Webhook signature verification failed");
    return new NextResponse("Webhook signature verification failed", { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      console.log(`Checkout session completed: ${session.id}`);

      if (session.mode === "subscription" && session.subscription) {
        try {
          const subscription = (await stripe.subscriptions.retrieve(
            session.subscription as string,
            { expand: ["customer", "items.data.price"] },
          )) as unknown as {
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
          console.error("Error handling checkout session completed:", error);
          return new NextResponse(
            JSON.stringify({ error: "Failed to process checkout session" }),
            { status: 500 },
          );
        }
      }

      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;

      console.log(`Invoice payment succeeded: ${invoice.id}`);

      try {
        const subscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : null;

        if (!subscriptionId) {
          throw new Error("Missing subscription id on paid invoice");
        }

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          { expand: ["customer", "items.data.price"] },
        );

        const schoolId =
          invoice.metadata?.school_id ||
          (subscription.customer as Stripe.Customer)?.metadata?.school_id ||
          "";

        await handleSubscriptionChange(schoolId, {
          status: "active",
          plan: determinePlanFromPrice(subscription.items.data[0]?.price),
          provider: "stripe",
          subscriptionId: subscription.id,
        });
      } catch (error) {
        console.error("Error handling invoice.payment_succeeded:", error);
        return new NextResponse(
          JSON.stringify({ error: "Failed to process invoice payment" }),
          { status: 500 },
        );
      }

      try {
        const subscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : null;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId,
            { expand: ["customer", "items.data.price"] },
          );

          const schoolId =
            invoice.metadata?.school_id ||
            (subscription.customer as Stripe.Customer)?.metadata?.school_id ||
            "";

          await sendPaymentReceipt(schoolId, {
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
            date: new Date(invoice.created * 1000).toISOString(),
            plan: determinePlanFromPrice(subscription.items.data[0]?.price),
            provider: "stripe",
            transactionId: (invoice as unknown as { payment_intent: string })
              .payment_intent as string,
          });
        }
      } catch (error) {
        console.error("Error sending payment receipt (non-critical):", error);
      }

      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;

      console.log(`Invoice payment failed: ${invoice.id}`);

      try {
        await handleSubscriptionChange(invoice.metadata?.school_id || "", {
          status: "past_due",
          provider: "stripe",
        });
      } catch (error) {
        console.error("Error handling invoice.payment_failed:", error);
        return new NextResponse(
          JSON.stringify({ error: "Failed to process failed payment" }),
          { status: 500 },
        );
      }

      break;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object;

      console.log(`Subscription created: ${subscription.id}`);

      try {
        await handleSubscriptionChange(subscription.metadata?.school_id || "", {
          status: mapStripeSubscriptionStatus(subscription.status),
          plan: determinePlanFromPrice(subscription.items.data[0]?.price),
          provider: "stripe",
          subscriptionId: subscription.id,
        });
      } catch (error) {
        console.error("Error handling customer.subscription.created:", error);
        return new NextResponse(
          JSON.stringify({ error: "Failed to process subscription creation" }),
          { status: 500 },
        );
      }

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;

      console.log(`Subscription updated: ${subscription.id}`);

      try {
        await handleSubscriptionChange(subscription.metadata?.school_id || "", {
          status: mapStripeSubscriptionStatus(subscription.status),
          plan: determinePlanFromPrice(subscription.items.data[0]?.price),
          provider: "stripe",
          subscriptionId: subscription.id,
        });
      } catch (error) {
        console.error("Error handling customer.subscription.updated:", error);
        return new NextResponse(
          JSON.stringify({ error: "Failed to process subscription update" }),
          { status: 500 },
        );
      }

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;

      console.log(`Subscription deleted: ${subscription.id}`);

      try {
        await handleSubscriptionChange(subscription.metadata?.school_id || "", {
          status: "canceled",
          provider: "stripe",
        });
      } catch (error) {
        console.error("Error handling customer.subscription.deleted:", error);
        return new NextResponse(
          JSON.stringify({ error: "Failed to process subscription deletion" }),
          { status: 500 },
        );
      }

      break;
    }

    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
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

  // Fallback: try to determine from amount (in cents)
  const amount = price?.unit_amount;
  if (amount) {
    // These are approximate USD amounts in cents (converted from UGX pricing)
    if (amount <= 500) return "starter"; // Starter
    if (amount <= 3500) return "growth"; // Growth
    if (amount <= 5500) return "enterprise"; // Enterprise
    return "lifetime"; // Lifetime
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
