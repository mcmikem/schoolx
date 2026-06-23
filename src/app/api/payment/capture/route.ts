import { NextRequest, NextResponse } from "next/server";
import { capturePayPalOrder, getPayPalOrder } from "@/lib/payments/paypal";
import { normalizePlanType } from "@/lib/payments/subscription-client";
import { PLAN_TYPES, type PlanType } from "@/lib/subscription";
import { updatePaymentStatus } from "@/lib/payments/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = searchParams.get("token");
  const planParam = searchParams.get("plan") || searchParams.get("custom");

  if (!token) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=subscription&error=missing_order", baseUrl),
    );
  }

  try {
    const capture = await capturePayPalOrder(token);
    const status = capture?.result?.status;

    if (status !== "COMPLETED") {
      logger.error("PayPal capture did not complete", { status, token });
      return NextResponse.redirect(
        new URL("/dashboard/settings?tab=subscription&error=capture_failed", baseUrl),
      );
    }

    const purchaseUnit = capture?.result?.purchase_units?.[0];
    const schoolId = purchaseUnit?.custom_id || purchaseUnit?.reference_id;
    const paypalAmount = parseFloat(purchaseUnit?.amount?.value || "0");

    if (!schoolId) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?tab=subscription&error=no_school", baseUrl),
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: school } = await supabase
      .from("schools")
      .select("id, subscription_plan")
      .eq("id", schoolId)
      .single();

    if (!school) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?tab=subscription&error=school_not_found", baseUrl),
      );
    }

    const plan = normalizePlanType(planParam || "starter");

    await supabase
      .from("schools")
      .update({
        subscription_plan: plan,
        subscription_status: "active",
        last_payment_at: new Date().toISOString(),
      })
      .eq("id", school.id);

    await updatePaymentStatus(token, "completed", {
      paid_at: new Date().toISOString(),
    });

    logger.log(`PayPal order ${token} captured successfully for school ${school.id}`);

    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?tab=subscription&success=true&provider=paypal&plan=${plan}`,
        baseUrl,
      ),
    );
  } catch (error) {
    logger.error("PayPal capture error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=subscription&error=capture_error", baseUrl),
    );
  }
}
