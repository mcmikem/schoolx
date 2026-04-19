import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder } from "@/lib/payments/paypal";
import { createMobileMoneyPaymentLink } from "@/lib/payments/mobile-money";
import { PlanType } from "@/lib/subscription";
import {
  getPlanPrice,
  recordPayment,
} from "@/lib/payments/utils";
import {
  requireUserWithSchool,
  assertUserRoleOrDeny,
  rateLimit,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BILLING_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "bursar",
];

function validateReturnUrl(url: string | undefined, baseUrl: string): string {
  if (!url) return `${baseUrl}/dashboard/pricing`;
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    if (parsed.origin !== base.origin) return `${baseUrl}/dashboard/pricing`;
    return url;
  } catch {
    return `${baseUrl}/dashboard/pricing`;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan") as PlanType;

  if (!plan) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?tab=subscription&error=no_plan",
        request.url,
      ),
    );
  }

  return NextResponse.redirect(
    new URL(`/dashboard/settings?tab=subscription&plan=${plan}`, request.url),
  );
}

export async function POST(request: NextRequest) {
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
    const { provider, plan, returnUrl, cancelUrl } = body as {
      provider: "paypal";
      plan: PlanType;
      returnUrl?: string;
      cancelUrl?: string;
    };

    if (!provider || !plan) {
      return NextResponse.json(
        { error: "Missing required fields: provider, plan" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: school } = await supabase
      .from("schools")
      .select("*")
      .eq("id", auth.context.schoolId)
      .single();

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const amount = getPlanPrice(plan);

    if (provider === "paypal") {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const ppReturnUrl = validateReturnUrl(returnUrl, baseUrl) + (returnUrl ? "" : "?success=true&provider=paypal");
      const ppCancelUrl = validateReturnUrl(cancelUrl, baseUrl) + (cancelUrl ? "" : "?canceled=true&provider=paypal");

      const orderAmount = Math.round((amount / 4100) * 100) / 100;

      const order = await createPayPalOrder(
        orderAmount * 100,
        "USD",
        school.id,
        ppReturnUrl,
        ppCancelUrl,
      );

      const approvalUrl = order.result.links?.find(
        (link: { rel: string; href: string }) => link.rel === "approve",
      )?.href;

      await recordPayment({
        schoolId: school.id,
        plan,
        amount,
        provider: "paypal",
        transactionId: order.result.id,
        paymentStatus: "pending",
      });

      return NextResponse.json(
        {
          success: true,
          url: approvalUrl,
          orderId: order.result.id,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { error: "Invalid payment provider. Use PayPal." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
