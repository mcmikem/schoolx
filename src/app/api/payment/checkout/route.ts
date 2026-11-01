import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder } from "@/lib/payments/paypal";
import { createMobileMoneyPaymentLink } from "@/lib/payments/mobile-money";
import { PLAN_TYPES, PlanType } from "@/lib/subscription";
import { normalizePlanType } from "@/lib/payments/subscription-client";
import {
  getPlanPrice,
  calculateTotalPrice,
  recordPayment,
  STRIPE_PRICE_IDS,
  createSupabaseAdminClient,
} from "@/lib/payments/utils";
import { createCheckoutSession, createCheckoutSessionInline } from "@/lib/payments/stripe";
import { getExchangeRate } from "@/lib/payments/exchange-rate";
import { requireUserWithSchool, assertUserRoleOrDeny, rateLimit } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { errorWithWhatsApp } from "@/lib/support-contact";
import { BillingError, buildQuote, generateTransactionRef } from "@/lib/billing/service";
import { planName } from "@/lib/billing/config";

const BILLING_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "bursar"];

const VALID_PLAN_TYPES = new Set<string>(PLAN_TYPES);

function validateReturnUrl(url: string | undefined, baseUrl: string): string {
  if (!url) return `${baseUrl}/dashboard/billing`;
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    if (parsed.origin !== base.origin) return `${baseUrl}/dashboard/billing`;
    return url;
  } catch {
    return `${baseUrl}/dashboard/billing`;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan") as PlanType;

  if (!plan) {
    return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=no_plan", request.url));
  }

  return NextResponse.redirect(new URL(`/dashboard/settings?tab=subscription&plan=${plan}`, request.url));
}

export async function POST(request: NextRequest) {
  let planInfo: { planName?: string; schoolName?: string } = {};
  try {
    const { success: rlOk } = rateLimit(request, 10, 600_000);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many payment requests. Try again later." }, { status: 429 });
    }

    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: BILLING_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const body = await request.json();
    const { provider, returnUrl, cancelUrl } = body as {
      provider: "paypal" | "stripe";
      plan: PlanType;
      returnUrl?: string;
      cancelUrl?: string;
    };
    let plan = normalizePlanType(body.plan as string);
    planInfo.planName = plan;

    if (!provider || !plan) {
      return NextResponse.json({ error: "Missing required fields: provider, plan" }, { status: 400 });
    }

    if (!VALID_PLAN_TYPES.has(plan)) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: school } = await supabase.from("schools").select("*").eq("id", auth.context.schoolId).maybeSingle();

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    planInfo.schoolName = school.name;

    const { count: studentCount } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", school.id);

    // Quote-first: all rails charge what /api/billing/quote says, never a
    // locally-recomputed guess. The cycle/promo come from the billing panel.
    const cycle = (body as { cycle?: string }).cycle === "annual" ? "annual" : "term";
    const promoCode = (body as { promoCode?: string | null }).promoCode || null;

    const admin = createSupabaseAdminClient();
    let quoteTotal: number;
    let quoteDescription: string;
    try {
      const built = await buildQuote(admin, {
        schoolId: school.id,
        action: "renew",
        plan,
        cycle,
        promoCode,
      });
      quoteTotal = built.quote.totalDue;
      quoteDescription = `${planName(plan)} plan · ${cycle === "annual" ? "annual" : "term"} · ${built.context.student_count} students`;
    } catch (err) {
      if (err instanceof BillingError) {
        return errorWithWhatsApp(err.message, err.status, {
          schoolName: planInfo.schoolName,
          plan: planInfo.planName,
        });
      }
      // Quote engine unavailable (e.g. DB drift) → legacy per-student math.
      quoteTotal = await calculateTotalPrice(plan, studentCount || 0);
      quoteDescription = `${planName(plan)} plan`;
    }

    const amount = quoteTotal;

    if (amount <= 0) {
      return NextResponse.json({ error: "Selected plan is not billable" }, { status: 400 });
    }

    // Our pending-ledger ref binds the provider session to the intent row.
    const transactionId = generateTransactionRef();

    if (provider === "stripe") {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const stripeSuccessUrl = `${baseUrl}/api/payment/capture/?plan=${plan}&provider=stripe`;
      const stripeCancelUrl = `${baseUrl}/dashboard/settings?tab=subscription&canceled=true&provider=stripe`;

      await recordPayment({
        schoolId: school.id,
        plan,
        amount,
        provider: "stripe",
        transactionId,
        paymentStatus: "pending",
        customerId: auth.context.user.id,
        description: quoteDescription,
        intent: {
          type: "renew",
          plan,
          cycle,
          months: cycle === "annual" ? 12 : 4,
          studentCount: studentCount || 0,
        },
      });

      try {
        let session;
        const priceId = STRIPE_PRICE_IDS[plan];
        if (priceId) {
          // Legacy configured price-id path (e.g. pre-created products).
          session = await createCheckoutSession({
            priceId,
            quantity: studentCount || 50,
            schoolId: school.id,
            plan,
            successUrl: stripeSuccessUrl,
            cancelUrl: stripeCancelUrl,
            customerEmail: auth.context.user.email,
            metadata: { intent_transaction_id: transactionId },
          });
        } else {
          // Quote-driven one-time charge in USD (Stripe does not settle UGX).
          const rate = await getExchangeRate("USD", "UGX");
          session = await createCheckoutSessionInline({
            amountUsdCents: Math.min(Math.max(Math.round((amount / rate) * 100), 50), 99999999),
            description: quoteDescription,
            schoolId: school.id,
            plan,
            successUrl: stripeSuccessUrl,
            cancelUrl: stripeCancelUrl,
            customerEmail: auth.context.user.email,
            metadata: { intent_transaction_id: transactionId },
          });
        }

        // Keep the provider ref on the ledger row (Stripe capture reads it
        // from session metadata; nothing extra needed here).

        return NextResponse.json(
          {
            success: true,
            url: session.url,
            sessionId: session.id,
          },
          { status: 200 },
        );
      } catch (err) {
        // Mark the pending row failed so it doesn't dangle as confirmable.
        await admin
          .from("subscription_payments")
          .update({ payment_status: "failed" })
          .eq("transaction_id", transactionId);
        throw err;
      }
    }

    if (provider === "paypal") {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const ppReturnUrl =
        validateReturnUrl(returnUrl, baseUrl) + (returnUrl ? "" : `/api/payment/capture/?plan=${plan}`);
      const ppCancelUrl = validateReturnUrl(cancelUrl, baseUrl) + (cancelUrl ? "" : "?canceled=true&provider=paypal");

      const rate = await getExchangeRate("USD", "UGX");
      const orderAmount = Math.round((amount / rate) * 100) / 100;

      await recordPayment({
        schoolId: school.id,
        plan,
        amount,
        provider: "paypal",
        transactionId,
        paymentStatus: "pending",
        customerId: auth.context.user.id,
        description: quoteDescription,
        intent: {
          type: "renew",
          plan,
          cycle,
          months: cycle === "annual" ? 12 : 4,
          studentCount: studentCount || 0,
        },
      });

      try {
        const order = await createPayPalOrder(
          orderAmount * 100,
          "USD",
          school.id,
          ppReturnUrl,
          ppCancelUrl,
          transactionId,
        );

        const approvalUrl = order.result.links?.find(
          (link: { rel: string; href: string }) => link.rel === "approve",
        )?.href;

        // Payment capture reads purchase_units[0].invoice_id → transaction id.

        return NextResponse.json(
          {
            success: true,
            url: approvalUrl,
            orderId: order.result.id,
            reference: transactionId,
          },
          { status: 200 },
        );
      } catch (err) {
        await admin
          .from("subscription_payments")
          .update({ payment_status: "failed" })
          .eq("transaction_id", transactionId);
        throw err;
      }
    }

    return errorWithWhatsApp(
      "Online payment is currently unavailable. Please contact us to complete your subscription.",
      503,
      { schoolName: planInfo.schoolName, plan: planInfo.planName },
    );
  } catch (error) {
    logger.error("Checkout error:", error);
    return errorWithWhatsApp("Payment processing encountered an error. Please try again or contact support.", 500, {
      plan: planInfo.planName,
    });
  }
}
