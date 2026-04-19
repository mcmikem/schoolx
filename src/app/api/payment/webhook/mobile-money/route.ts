import { NextRequest, NextResponse } from "next/server";
import { FlutterwaveMobileMoney } from "@/lib/payments/mobile-money";
import {
  updatePaymentStatus,
  activateSchoolSubscription,
  getPendingMobilePayment,
  updatePendingMobilePayment,
} from "@/lib/payments/utils";
import { sendPaymentReceipt } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("verif-hash") || "";
    const body = await request.text();

    const flutterwave = new FlutterwaveMobileMoney();

    const isValidSignature = flutterwave.verifyWebhookSignature(
      body,
      signature,
    );

    // Enforce signature verification — no bypass in production
    const allowInsecure = process.env.NODE_ENV === "development" && process.env.ALLOW_INSECURE_WEBHOOKS === "true";
    if (!isValidSignature && !allowInsecure) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const event = flutterwave.parseWebhookEvent(payload);

    if (!event) {
      console.error("Invalid webhook event");
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    console.log(`Mobile money webhook received: ${event.event}`);

    if (
      event.event === "charge.completed" ||
      event.event === "payment.success"
    ) {
      const { txRef, status, amount, customer, meta } = event.data;

      if (status === "successful") {
        const pendingPayment = await getPendingMobilePayment(txRef);

        if (!pendingPayment) {
          console.error(`Pending payment not found for txRef: ${txRef}`);
          return NextResponse.json(
            { error: "Payment not found" },
            { status: 404 },
          );
        }

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
          pendingPayment.provider,
          txRef,
        );

        try {
          await sendPaymentReceipt(pendingPayment.school_id, {
            amount,
            currency: "UGX",
            date: new Date().toISOString(),
            plan: pendingPayment.plan as
              | "starter"
              | "growth"
              | "enterprise"
              | "lifetime",
            provider: pendingPayment.provider as "mtn" | "airtel",
            transactionId: txRef,
          });
        } catch (receiptError) {
          console.error("Error sending receipt:", receiptError);
        }

        console.log(
          `Payment completed for school: ${pendingPayment.school_id}, amount: ${amount}`,
        );
      }
    }

    if (event.event === "charge.failed" || event.event === "payment.failed") {
      const { txRef } = event.data;

      await updatePendingMobilePayment(txRef, "failed");
      await updatePaymentStatus(txRef, "failed");

      console.log(`Payment failed for txRef: ${txRef}`);
    }

    if (event.event === "charge.expired" || event.event === "payment.expired") {
      const { txRef } = event.data;

      await updatePendingMobilePayment(txRef, "expired");
      await updatePaymentStatus(txRef, "failed");

      console.log(`Payment expired for txRef: ${txRef}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Mobile money webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
