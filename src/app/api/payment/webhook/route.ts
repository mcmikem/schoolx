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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  if (!webhookSecret) {
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      // Handle successful checkout
      // This would be used for one-time payments or subscription payments via checkout
      console.log(`Checkout session completed: ${session.id}`);

      // If this is a subscription checkout, we'll handle it via invoice.payment_succeeded
      // but we can still get the customer and subscription info here
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

          // Update school subscription
          await handleSubscriptionChange(session.metadata?.school_id || "", {
            status: mapStripeSubscriptionStatus(subscription.status),
            plan: determinePlanFromPrice(subscription.items.data[0]?.price),
            provider: "stripe",
            subscriptionId: subscription.id,
          });
        } catch (error) {
          console.error("Error handling checkout session completed:", error);
        }
      }

      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;

      // Handle successful recurring subscription payment
      console.log(`Invoice payment succeeded: ${invoice.id}`);

      try {
        const subscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : null;

        if (!subscriptionId) {
          throw new Error("Missing subscription id on paid invoice");
        }

        // Get the subscription to determine the plan
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          { expand: ["customer", "items.data.price"] },
        );

        // Update school subscription status to active
        await handleSubscriptionChange(
          // Get school ID from customer metadata
          invoice.metadata?.school_id ||
            (subscription.customer as Stripe.Customer)?.metadata?.school_id ||
            "",
          {
            status: "active",
            plan: determinePlanFromPrice(subscription.items.data[0]?.price),
            provider: "stripe",
            subscriptionId: subscription.id,
          },
        );

        // Send payment receipt
        await sendPaymentReceipt(
          invoice.metadata?.school_id ||
            (subscription.customer as Stripe.Customer)?.metadata?.school_id ||
            "",
          {
            amount: invoice.amount_paid / 100, // Convert from cents
            currency: invoice.currency,
            date: new Date(invoice.created * 1000).toISOString(),
            plan: determinePlanFromPrice(subscription.items.data[0]?.price),
            provider: "stripe",
            transactionId: (invoice as unknown as { payment_intent: string })
              .payment_intent as string,
          },
        );
      } catch (error) {
        console.error("Error handling invoice.payment_succeeded:", error);
      }

      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;

      // Handle failed recurring subscription payment
      console.log(`Invoice payment failed: ${invoice.id}`);

      try {
        // Update school subscription status to past_due
        await handleSubscriptionChange(invoice.metadata?.school_id || "", {
          status: "past_due",
          provider: "stripe",
        });

        // Notify administrator (we'll implement this later)
        console.log(`Payment failed for school ${invoice.metadata?.school_id}`);
      } catch (error) {
        console.error("Error handling invoice.payment_failed:", error);
      }

      break;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object;

      // Handle new subscription creation
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
      }

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;

      // Handle subscription updates (e.g., plan change)
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
      }

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;

      // Handle subscription cancellation or ending
      console.log(`Subscription deleted: ${subscription.id}`);

      try {
        await handleSubscriptionChange(subscription.metadata?.school_id || "", {
          status: "canceled",
          provider: "stripe",
        });
      } catch (error) {
        console.error("Error handling customer.subscription.deleted:", error);
      }

      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to Stripe to acknowledge receipt of the webhook
  return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
}

// Map Stripe price IDs to our plan types
const PRICE_TO_PLAN_MAP: Record<string, PlanType> = {
  price_basic: "basic",
  price_premium: "premium",
  price_max: "max",
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
    // These are approximate USD amounts in cents
    if (amount <= 500) return "free_trial"; // Free trial
    if (amount <= 2500) return "basic"; // ~$25/month
    if (amount <= 5000) return "premium"; // ~$50/month
    return "max"; // ~$75+/month
  }

  // Default to premium if we can't determine
  return "premium";
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
