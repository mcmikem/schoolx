import { NextRequest, NextResponse } from "next/server";
import { createMobileMoneyPaymentLink } from "@/lib/payments/mobile-money";
import { PlanType } from "@/lib/subscription";
import {
  getPlanPrice,
  recordPayment,
  savePendingMobilePayment,
} from "@/lib/payments/utils";
import { requireUserWithSchool, assertUserRoleOrDeny, rateLimit } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BILLING_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "bursar",
];

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

    // Validate phone number format
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 12) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const paymentLink = await createMobileMoneyPaymentLink({
      provider,
      amount,
      phone: phoneNumber,
      email: school.email || auth.context.user.email || "pay@omuto.org",
      name: school.name,
      schoolId: school.id,
      plan,
      returnUrl: `${baseUrl}/dashboard/pricing?success=true&provider=${provider}&reference={reference}`,
    });

    await savePendingMobilePayment({
      schoolId: school.id,
      plan,
      amount,
      provider,
      phone: phoneNumber,
      reference: paymentLink.txRef,
    });

    await recordPayment({
      schoolId: school.id,
      plan,
      amount,
      provider,
      transactionId: paymentLink.txRef,
      paymentStatus: "pending",
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
