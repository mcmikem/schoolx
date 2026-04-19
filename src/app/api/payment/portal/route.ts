import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requireUserWithSchool,
  assertUserRoleOrDeny,
  rateLimit,
} from "@/lib/api-utils";

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

export async function POST(request: NextRequest) {
  try {
    const { success: rlOk } = rateLimit(request, 10, 600_000);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: BILLING_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const body = await request.json();
    const { returnUrl } = body as { returnUrl?: string };
    const schoolId = auth.context.schoolId;

    const supabase = await createSupabaseServerClient();
    const { data: school } = await supabase
      .from("schools")
      .select("stripe_customer_id")
      .eq("id", schoolId)
      .single();

    if (!school?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found. Subscribe first." },
        { status: 400 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const portalReturnUrl = validateReturnUrl(returnUrl, baseUrl);

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Payment processing not configured. Please contact support." },
        { status: 503 },
      );
    }

    const Stripe = require("stripe");
    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.billingPortal.sessions.create({
      customer: school.stripe_customer_id,
      return_url: portalReturnUrl,
    });

    return NextResponse.json(
      {
        success: true,
        url: session.url,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Portal session error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}
