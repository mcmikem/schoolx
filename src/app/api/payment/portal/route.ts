import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { returnUrl } = body as { returnUrl?: string };

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("school_id")
      .eq("auth_id", user.id)
      .single();

    if (!userData?.school_id) {
      return NextResponse.json(
        { error: "School not found for user" },
        { status: 404 },
      );
    }

    const { data: school } = await supabase
      .from("schools")
      .select("stripe_customer_id")
      .eq("id", userData.school_id)
      .single();

    if (!school?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found. Subscribe first." },
        { status: 400 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const portalReturnUrl = returnUrl || `${baseUrl}/dashboard/pricing`;

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
