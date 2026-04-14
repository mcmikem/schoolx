import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requireUserWithSchool,
  assertUserRoleOrDeny,
} from "@/lib/api-utils";

const BILLING_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "bursar",
];

// Create Stripe customer portal session
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: BILLING_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const { customerId, returnUrl } = await request.json();

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();

    // Verify the customer belongs to the current user's school
    const { data: school, error } = await supabase
      .from("schools")
      .select("id, stripe_customer_id")
      .eq("id", auth.context.schoolId)
      .eq("stripe_customer_id", customerId)
      .single();

    if (error || !school) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 403 },
      );
    }

    // Create the portal session
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Payment processing not configured" },
        { status: 503 },
      );
    }

    const Stripe = require("stripe");
    const stripe = new Stripe(stripeSecretKey);

    const portalUrl = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url:
        returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: portalUrl.url });
  } catch (error) {
    console.error("Error creating customer portal session:", error);
    return NextResponse.json(
      { error: "Failed to create customer portal session" },
      { status: 500 },
    );
  }
}
