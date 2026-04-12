import { NextRequest, NextResponse } from "next/server";
import { verifyMobileMoneyPayment } from "@/lib/payments/mobile-money";
import {
  updatePaymentStatus,
  activateSchoolSubscription,
  getPendingMobilePayment,
  updatePendingMobilePayment,
} from "@/lib/payments/utils";
import { sendPaymentReceipt } from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Auth check before body parse
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { txRef, provider } = body as {
      txRef: string;
      provider: "paypal" | "mtn" | "airtel";
    };

    if (!txRef || !provider) {
      return NextResponse.json(
        { error: "Missing required fields: txRef, provider" },
        { status: 400 },
      );
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

    if (provider === "mtn" || provider === "airtel") {
      const pendingPayment = await getPendingMobilePayment(txRef);

      if (!pendingPayment) {
        return NextResponse.json(
          { error: "Payment not found" },
          { status: 404 },
        );
      }

      const status = await verifyMobileMoneyPayment(txRef);

      if (status.status === "completed") {
        await updatePendingMobilePayment(txRef, "completed");

        await updatePaymentStatus(txRef, "completed", {
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
          txRef,
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
          transactionId: txRef,
        });

        return NextResponse.json({
          success: true,
          status: "completed",
          message: "Payment verified successfully",
        });
      } else if (status.status === "failed") {
        await updatePendingMobilePayment(txRef, "failed");
        await updatePaymentStatus(txRef, "failed");

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
    const searchParams = request.nextUrl.searchParams;
    const txRef = searchParams.get("txRef");
    const provider = searchParams.get("provider") as
      | "stripe"
      | "paypal"
      | "mtn"
      | "airtel"
      | null;

    if (!txRef) {
      return NextResponse.json(
        { error: "Missing txRef parameter" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: payment, error } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("transaction_id", txRef)
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
