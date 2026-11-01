import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { capturePayPalOrder } from "@/lib/payments/paypal";
import { normalizePlanType } from "@/lib/payments/subscription-client";
import { activateSchoolSubscription } from "@/lib/payments/utils";
import { BillingError, applyCompletedPayment } from "@/lib/billing/service";
import { sendPaymentReceipt } from "@/lib/subscription";
import { logger } from "@/lib/logger";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function resolveLedgerAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return createClient(url, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const provider = searchParams.get("provider") || "paypal";
  const planParam = searchParams.get("plan") || searchParams.get("custom");

  /**
   * Activates the school from the pending ledger row that carries the intent.
   * Legacy rows (pre-intent) fall back to the old plan-based activation so
   * historical in-flight payments never dead-end.
   */
  async function activateFromLedger(
    ledgerRef: string,
    fallbackSchoolId: string,
    fallbackPlan: string,
  ): Promise<boolean> {
    if (!SERVICE_KEY) return false;
    const admin = resolveLedgerAdmin();

    try {
      const applied = await applyCompletedPayment(admin, ledgerRef, {
        provider: (provider as "stripe" | "paypal") || "paypal",
      });
      if (applied.applied && applied.result?.school) {
        const amount = Number((applied.result.payment as { amount?: number } | null)?.amount) || 0;
        await sendPaymentReceiptFor(applied.result.school.id, fallbackPlan, amount, ledgerRef);
        return true;
      }
      return false;
    } catch (err) {
      if (err instanceof BillingError && err.status === 404) {
        logger.warn("[capture] no intent row for", ledgerRef, "— using legacy activation");
      } else {
        throw err;
      }
    }

    // Legacy path: no ledger row at all — activate directly from provider data.
    if (!fallbackSchoolId) return false;
    const plan = normalizePlanType(fallbackPlan || "starter");
    await activateSchoolSubscription(fallbackSchoolId, plan, provider === "stripe" ? "stripe" : "paypal", ledgerRef);
    await sendPaymentReceiptFor(fallbackSchoolId, plan, 0, ledgerRef);
    return true;
  }

  async function sendPaymentReceiptFor(schoolId: string, plan: string, amount: number, transactionId: string) {
    try {
      await sendPaymentReceipt(schoolId, {
        amount,
        currency: "UGX",
        date: new Date().toISOString(),
        plan: normalizePlanType(plan),
        provider: provider === "stripe" ? "stripe" : "paypal",
        transactionId,
      });
    } catch (err) {
      logger.warn("[capture] receipt send failed (non-fatal):", err);
    }
  }

  if (provider === "stripe") {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=missing_session", baseUrl));
    }

    try {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return NextResponse.redirect(
          new URL("/dashboard/settings?tab=subscription&error=stripe_not_configured", baseUrl),
        );
      }

      const stripe = new Stripe(stripeSecretKey);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return NextResponse.redirect(
          new URL("/dashboard/settings?tab=subscription&error=payment_not_completed", baseUrl),
        );
      }

      const schoolId = session.metadata?.school_id;
      if (!schoolId) {
        return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=no_school", baseUrl));
      }

      const plan = normalizePlanType(planParam || session.metadata?.plan || "starter");

      // New sessions bind to their ledger row via metadata.intent_transaction_id;
      // legacy sessions used the session id as the ledger transaction id.
      const ledgerRef = session.metadata?.intent_transaction_id || sessionId;

      let finalized = await activateFromLedger(ledgerRef, schoolId, plan);
      if (!finalized && ledgerRef !== sessionId) {
        finalized = await activateFromLedger(sessionId, schoolId, plan);
      }
      if (!finalized) {
        return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=capture_error", baseUrl));
      }

      logger.log(`Stripe session ${sessionId} captured successfully for school ${schoolId}`);

      return NextResponse.redirect(
        new URL(`/dashboard/settings?tab=subscription&success=true&provider=stripe&plan=${plan}`, baseUrl),
      );
    } catch (error) {
      logger.error("Stripe capture error:", error);
      return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=capture_error", baseUrl));
    }
  }

  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=missing_order", baseUrl));
  }

  try {
    const capture = await capturePayPalOrder(token);
    const status = capture?.result?.status;

    if (status !== "COMPLETED") {
      logger.error("PayPal capture did not complete", { status, token });
      return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=capture_failed", baseUrl));
    }

    const purchaseUnit = capture?.result?.purchase_units?.[0];
    const schoolId = purchaseUnit?.custom_id || purchaseUnit?.reference_id;

    if (!schoolId) {
      return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=no_school", baseUrl));
    }

    const plan = normalizePlanType(planParam || "starter");

    // invoice_id carries our subscription_payments transaction ref (written
    // when the order was created); legacy orders used the order id.
    const ledgerRef = purchaseUnit?.invoice_id || token;

    let finalized = await activateFromLedger(ledgerRef, schoolId, plan);
    if (!finalized && ledgerRef !== token) {
      finalized = await activateFromLedger(token, schoolId, plan);
    }
    if (!finalized) {
      return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=capture_error", baseUrl));
    }

    logger.log(`PayPal order ${token} captured successfully for school ${schoolId}`);

    return NextResponse.redirect(
      new URL(`/dashboard/settings?tab=subscription&success=true&provider=paypal&plan=${plan}`, baseUrl),
    );
  } catch (error) {
    logger.error("PayPal capture error:", error);
    return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=capture_error", baseUrl));
  }
}
