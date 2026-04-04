import { NextRequest, NextResponse } from "next/server";
import { createMobileMoneyPaymentLink } from "@/lib/payments/mobile-money";
import { PlanType } from "@/lib/subscription";
import {
  getPlanPrice,
  recordPayment,
  savePendingMobilePayment,
} from "@/lib/payments/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, plan, phoneNumber } = body as {
      provider: "mtn" | "airtel";
      plan: PlanType;
      phoneNumber: string;
    };

    if (!provider || !plan || !phoneNumber) {
      return NextResponse.json(
        { error: "Missing required fields: provider, plan, phoneNumber" },
        { status: 400 },
      );
    }

    if (provider !== "mtn" && provider !== "airtel") {
      return NextResponse.json(
        { error: 'Invalid provider. Use "mtn" or "airtel"' },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("school_id, role")
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
      .select("*")
      .eq("id", userData.school_id)
      .single();

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const amount = getPlanPrice(plan);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const paymentLink = await createMobileMoneyPaymentLink({
      provider,
      amount,
      phone: phoneNumber,
      email: school.email || user.email || "payments@omuto.org",
      name: school.name,
      schoolId: school.id,
      plan,
      returnUrl: `${baseUrl}/dashboard/pricing?success=true&provider=${provider}&txRef={txRef}`,
    });

    await savePendingMobilePayment({
      schoolId: school.id,
      plan,
      amount,
      provider,
      phoneNumber,
      txRef: paymentLink.txRef,
    });

    await recordPayment({
      schoolId: school.id,
      plan,
      amount,
      provider,
      transactionId: paymentLink.txRef,
      paymentStatus: "pending",
      phoneNumber,
    });

    return NextResponse.json(
      {
        success: true,
        paymentLink: paymentLink.link,
        txRef: paymentLink.txRef,
        amount,
        provider: provider.toUpperCase(),
        instructions:
          provider === "mtn"
            ? "You will receive an MTN Momo prompt on your phone. Enter your PIN to confirm payment."
            : "You will receive an Airtel Money prompt on your phone. Enter your PIN to confirm payment.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Mobile money payment error:", error);
    return NextResponse.json(
      { error: "Failed to initialize mobile money payment" },
      { status: 500 },
    );
  }
}
