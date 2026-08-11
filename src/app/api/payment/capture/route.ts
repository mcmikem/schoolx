import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { capturePayPalOrder } from "@/lib/payments/paypal";
import { normalizePlanType } from "@/lib/payments/subscription-client";
import { PLAN_TYPES, type PlanType } from "@/lib/subscription";
import { updatePaymentStatus } from "@/lib/payments/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const provider = searchParams.get("provider") || "paypal";
  const planParam = searchParams.get("plan") || searchParams.get("custom");

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

      const supabase = await createSupabaseServerClient();
      const plan = normalizePlanType(planParam || session.metadata?.plan || "starter");

      const { error: updateError } = await supabase
        .from("schools")
        .update({
          subscription_plan: plan,
          subscription_status: "active",
          last_payment_at: new Date().toISOString(),
        })
        .eq("id", schoolId);

      if (updateError) {
        logger.error("Stripe capture: failed to activate school subscription:", updateError);
        return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=capture_error", baseUrl));
      }

      await updatePaymentStatus(sessionId, "completed", {
        paid_at: new Date().toISOString(),
      });

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

    const supabase = await createSupabaseServerClient();
    const { data: school } = await supabase
      .from("schools")
      .select("id, subscription_plan")
      .eq("id", schoolId)
      .maybeSingle();

    if (!school) {
      return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=school_not_found", baseUrl));
    }

    const plan = normalizePlanType(planParam || "starter");

    const { error: updateError } = await supabase
      .from("schools")
      .update({
        subscription_plan: plan,
        subscription_status: "active",
        last_payment_at: new Date().toISOString(),
      })
      .eq("id", school.id);

    if (updateError) {
      logger.error("PayPal capture: failed to activate school subscription:", updateError);
      return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=capture_error", baseUrl));
    }

    await updatePaymentStatus(token, "completed", {
      paid_at: new Date().toISOString(),
    });

    logger.log(`PayPal order ${token} captured successfully for school ${school.id}`);

    return NextResponse.redirect(
      new URL(`/dashboard/settings?tab=subscription&success=true&provider=paypal&plan=${plan}`, baseUrl),
    );
  } catch (error) {
    logger.error("PayPal capture error:", error);
    return NextResponse.redirect(new URL("/dashboard/settings?tab=subscription&error=capture_error", baseUrl));
  }
}
