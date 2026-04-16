import { NextRequest, NextResponse } from "next/server";
import { verifyMobileMoneyPayment } from "@/lib/payments/mobile-money";
import {
  updatePaymentStatus,
  activateSchoolSubscription,
  getPendingMobilePayment,
  updatePendingMobilePayment,
} from "@/lib/payments/utils";
import { sendPaymentReceipt } from "@/lib/subscription";
import { requireUserWithSchool, assertUserRoleOrDeny } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BILLING_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "bursar",
];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: BILLING_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const body = await request.json();
    const { reference, provider } = body as {
      reference: string;
      provider: "paypal" | "mtn" | "airtel";
    };

    if (!reference || !provider) {
      return NextResponse.json(
        { error: "Missing required fields: reference, provider" },
        { status: 400 },
      );
    }

    if (provider === "mtn" || provider === "airtel") {
      const pendingPayment = await getPendingMobilePayment(reference);

      if (!pendingPayment) {
        return NextResponse.json(
          { error: "Payment not found" },
          { status: 404 },
        );
      }

      if (pendingPayment.school_id !== auth.context.schoolId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const status = await verifyMobileMoneyPayment(reference);

      if (status.status === "completed") {
        await updatePendingMobilePayment(reference, "completed");

        await updatePaymentStatus(reference, "completed", {
          paid_at: new Date().toISOString(),
        });

        await activateSchoolSubscription(
          pendingPayment.school_id,
          pendingPayment.plan as
            | "starter"
            | "growth"
            | "enterprise"
            | "lifetime",
          provider,
          reference,
        );

        await sendPaymentReceipt(pendingPayment.school_id, {
          amount: pendingPayment.amount,
          currency: "UGX",
          date: new Date().toISOString(),
          plan: pendingPayment.plan as
            | "starter"
            | "growth"
            | "enterprise"
            | "lifetime",
          provider,
          transactionId: reference,
        });

        return NextResponse.json({
          success: true,
          status: "completed",
          message: "Payment verified successfully",
        });
      } else if (status.status === "failed") {
        await updatePendingMobilePayment(reference, "failed");
        await updatePaymentStatus(reference, "failed");

        return NextResponse.json({
          success: false,
          status: "failed",
          message: "Payment failed",
        });
      }

      return NextResponse.json({
        success: true,
        status: "pending",
        message: status.message || "Payment is still being processed",
      });
    }

    return NextResponse.json(
      { error: "Verification not supported for this provider" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: BILLING_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const searchParams = request.nextUrl.searchParams;
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        { error: "Missing reference parameter" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: payment, error } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("school_id", auth.context.schoolId)
      .eq("transaction_id", reference)
      .single();

    if (error || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        plan: payment.plan,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        status: payment.payment_status,
        paidAt: payment.paid_at,
        createdAt: payment.created_at,
      },
    });
  } catch (error) {
    console.error("Get payment error:", error);
    return NextResponse.json(
      { error: "Failed to get payment details" },
      { status: 500 },
    );
  }
}
