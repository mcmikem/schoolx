import { NextRequest, NextResponse } from "next/server";
import { createMobileMoneyPaymentLink } from "@/lib/payments/mobile-money";
import { PLAN_TYPES, PlanType } from "@/lib/subscription";
import {
  getPlanPrice,
  recordPayment,
  savePendingMobilePayment,
} from "@/lib/payments/utils";
import { requireUserWithSchool, assertUserRoleOrDeny, rateLimit } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { normalizeAuthPhone } from "@/lib/validation";

const BILLING_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "bursar",
];

const VALID_PLAN_TYPES = new Set<string>(PLAN_TYPES);

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

    if (!VALID_PLAN_TYPES.has(plan)) {
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 },
      );
    }

    if (provider !== "mtn" && provider !== "airtel") {
      return NextResponse.json(
        { error: 'Invalid provider. Use "mtn" or "airtel".' },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizeAuthPhone(phoneNumber);
    if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith("256")) {
      return NextResponse.json(
        { error: "Invalid phone number format. Use a valid Ugandan number." },
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

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Selected plan is not billable" },
        { status: 400 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const paymentLink = await createMobileMoneyPaymentLink({
      provider,
      amount,
      phone: normalizedPhone,
      email: school.email || auth.context.user.email || "pay@omuto.org",
      name: school.name,
      schoolId: school.id,
      plan,
      returnUrl: `${baseUrl}/dashboard/settings?tab=subscription&success=true&provider=${provider}&plan=${plan}&reference={reference}`,
    });

    await savePendingMobilePayment({
      schoolId: school.id,
      plan,
      amount,
      provider,
      phone: normalizedPhone,
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
            ? "A payment request has been sent to your phone. Check for the MTN MoMo prompt and enter your PIN to confirm."
            : "A payment request has been sent to your phone. Check for the Airtel Money prompt and enter your PIN to confirm.",
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Mobile money payment error:", error);
    const message = error instanceof Error ? error.message : "";
    const isConfigError = message.includes("not yet configured") || message.includes("environment variables");
    return NextResponse.json(
      { error: isConfigError ? "Mobile money not yet configured. Please contact support." : "Failed to initialize mobile money payment. Please try again or contact support." },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
