import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder } from "@/lib/payments/paypal";
import { createMobileMoneyPaymentLink } from "@/lib/payments/mobile-money";
import { getExchangeRate } from "@/lib/payments/exchange-rate";
import { requireUserWithSchool, assertUserRoleOrDeny, rateLimit } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  BillingError,
  buildQuote,
  generateTransactionRef,
  createPendingSubscriptionPayment,
} from "@/lib/billing/service";

const BILLING_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "bursar"];

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let planInfo: { schoolName?: string } = {};
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
    const provider = body.provider as "mtn" | "airtel" | "paypal" | "manual";
    const moduleKeys = Array.isArray(body.moduleKeys) ? (body.moduleKeys as string[]) : [];
    const promoCode = body.promoCode || null;
    const phoneNumber = body.phoneNumber as string | undefined;

    if (!provider || moduleKeys.length === 0) {
      return NextResponse.json({ error: "Missing provider or moduleKeys" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: school } = await supabase.from("schools").select("*").eq("id", auth.context.schoolId).maybeSingle();
    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }
    planInfo.schoolName = school.name;

    // Quote-first
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let built;
    try {
      built = await buildQuote(admin, {
        schoolId: school.id,
        action: "module",
        moduleKeys,
        promoCode,
      });
    } catch (err) {
      if (err instanceof BillingError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    const amount = built.quote.totalDue;
    if (amount <= 0) {
      return NextResponse.json({ error: "Nothing to pay for the selected modules" }, { status: 400 });
    }

    const transactionId = generateTransactionRef("MOD");

    // ── Manual (cash/bank) ───────────────────────────────────────────────
    if (provider === "manual") {
      const reference = String(body.reference || "").trim();
      if (reference.length < 3) {
        return NextResponse.json({ error: "Enter the payment reference" }, { status: 400 });
      }
      const method = body.method === "bank" ? "bank" : "cash";
      const payment = await createPendingSubscriptionPayment(admin, {
        schoolId: school.id,
        provider: method,
        quote: built.quote,
        intent: built.intent,
        transactionId,
        createdById: auth.context.user.id,
      });
      await admin
        .from("subscription_payments")
        .update({ payment_method_detail: `${method === "bank" ? "Bank deposit" : "Cash"} · Ref: ${reference}` })
        .eq("transaction_id", transactionId);

      return NextResponse.json({
        success: true,
        paymentId: (payment as any).id,
        reference: transactionId,
        amount,
        instructions: "Submitted for confirmation. A super admin will activate the modules after verifying payment.",
      });
    }

    // ── Mobile money ─────────────────────────────────────────────────────
    if (provider === "mtn" || provider === "airtel") {
      if (!phoneNumber) {
        return NextResponse.json({ error: "phoneNumber required for mobile money" }, { status: 400 });
      }
      const { normalizeAuthPhone } = await import("@/lib/validation");
      const normalizedPhone = normalizeAuthPhone(phoneNumber);
      if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith("256")) {
        return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
      }

      const paymentLink = await createMobileMoneyPaymentLink({
        provider,
        amount,
        phone: normalizedPhone,
        email: school.email || auth.context.user.email || "pay@omuto.org",
        name: school.name,
        schoolId: school.id,
        plan: "module",
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings?tab=subscription&success=true&provider=${provider}&reference={reference}`,
      });

      await createPendingSubscriptionPayment(admin, {
        schoolId: school.id,
        provider,
        quote: built.quote,
        intent: built.intent,
        transactionId: paymentLink.txRef,
        createdById: auth.context.user.id,
      });

      return NextResponse.json({
        success: true,
        paymentLink: paymentLink.link,
        txRef: paymentLink.txRef,
        amount,
        provider: provider.toUpperCase(),
        instructions:
          provider === "mtn"
            ? "Check your phone for the MTN MoMo prompt and enter your PIN."
            : "Check your phone for the Airtel Money prompt and enter your PIN.",
      });
    }

    // ── PayPal ───────────────────────────────────────────────────────────
    if (provider === "paypal") {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const rate = await getExchangeRate("USD", "UGX");
      const orderAmount = Math.round((amount / rate) * 100) / 100;

      const order = await createPayPalOrder(
        orderAmount * 100,
        "USD",
        school.id,
        `${baseUrl}/api/payment/capture/?provider=paypal`,
        `${baseUrl}/dashboard/settings?tab=subscription&canceled=true&provider=paypal`,
        transactionId,
      );

      const approvalUrl = order.result.links?.find((l: { rel: string; href: string }) => l.rel === "approve")?.href;

      await createPendingSubscriptionPayment(admin, {
        schoolId: school.id,
        provider: "paypal",
        quote: built.quote,
        intent: built.intent,
        transactionId,
        createdById: auth.context.user.id,
      });

      // Re-key the ledger row to the PayPal order id so capture applies it.
      await admin
        .from("subscription_payments")
        .update({ transaction_id: order.result.id })
        .eq("transaction_id", transactionId);

      return NextResponse.json({
        success: true,
        url: approvalUrl,
        orderId: order.result.id,
        amount,
      });
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  } catch (error) {
    logger.error("Module checkout error:", error);
    const message = error instanceof Error ? error.message : "Module checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
