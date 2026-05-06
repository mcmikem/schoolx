import { NextRequest, NextResponse } from "next/server";
import { MtnMomoClient, MoneyUnifyClient } from "@/lib/payments/mobile-money";
import {
  updatePaymentStatus,
  activateSchoolSubscription,
  getPendingMobilePayment,
  updatePendingMobilePayment,
} from "@/lib/payments/utils";
import { sendPaymentReceipt } from "@/lib/subscription";
import { logger } from "@/lib/logger";

// Mobile money webhook handler — handles both MTN MoMo and MoneyUnify callbacks.
// Security: Neither provider uses HMAC signatures on callbacks, so we always re-verify
// payment status via the respective API before processing.

export async function POST(request: NextRequest) {
  try {
    const allowInsecure =
      process.env.NODE_ENV === "development" &&
      process.env.ALLOW_INSECURE_WEBHOOKS === "true";

    const body = await request.text();
    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      if (allowInsecure) {
        logger.warn("Mobile money webhook: invalid JSON allowed in development mode");
        return NextResponse.json({ received: true });
      }
      logger.error("Mobile money webhook: invalid JSON body");
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // MTN MoMo sends X-Reference-Id header or puts referenceId in body.
    // MoneyUnify sends transaction_id in the body.
    const mtnReferenceId =
      (payload.referenceId as string) ||
      (payload.financialTransactionId as string) ||
      (request.headers.get("x-reference-id") ?? "");
    const moneyUnifyTxId = (payload.transaction_id as string) || "";

    const referenceId = mtnReferenceId || moneyUnifyTxId;

    if (!referenceId) {
      if (allowInsecure) {
        logger.warn("Mobile money webhook: missing referenceId allowed in development mode");
        return NextResponse.json({ received: true });
      }
      logger.error("Mobile money webhook: missing referenceId");
      return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    }

    logger.debug(`Mobile money webhook received for referenceId: ${referenceId}`);

    // Look up the pending payment to know which provider to re-verify with
    const pendingPayment = await getPendingMobilePayment(referenceId);

    if (!pendingPayment) {
      // Unknown payment — acknowledge and ignore to avoid retry loops
      logger.debug(`No pending payment found for referenceId: ${referenceId} — ignoring`);
      return NextResponse.json({ received: true });
    }

    // Re-verify status via the appropriate API to prevent spoofed callbacks
    let verifiedStatus: "SUCCESSFUL" | "PENDING" | "FAILED" = "PENDING";
    let verifiedAmount = 0;

    if (pendingPayment.provider === "airtel") {
      const mu = new MoneyUnifyClient();
      const result = await mu.verifyPayment(referenceId);
      verifiedStatus =
        result.status === "completed" ? "SUCCESSFUL" :
        result.status === "failed" ? "FAILED" : "PENDING";
      verifiedAmount = result.amount ?? 0;
    } else {
      const mtn = new MtnMomoClient();
      const result = await mtn.getPaymentStatus(referenceId);
      verifiedStatus = result.status;
      verifiedAmount = parseFloat(result.amount);
    }

    if (verifiedStatus === "SUCCESSFUL") {
      const txRef = referenceId;
      const amount = verifiedAmount;

      if (!pendingPayment) {
        logger.error(`Pending payment not found for txRef: ${txRef}`);
        return NextResponse.json(
          { error: "Payment not found" },
          { status: 404 },
        );
      }

      if (pendingPayment.status === "completed") {
        logger.debug(`Payment ${txRef} already processed, skipping`);
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      const markResult = await updatePendingMobilePayment(txRef, "completed", pendingPayment.status);

      if (!markResult) {
        logger.debug(`Payment ${txRef} was already marked completed by another request, skipping`);
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      await updatePaymentStatus(txRef, "completed", {
        paid_at: new Date().toISOString(),
      });

      await activateSchoolSubscription(
        pendingPayment.school_id,
        pendingPayment.plan as "starter" | "growth" | "enterprise" | "lifetime",
        pendingPayment.provider,
        txRef,
      );

      try {
        await sendPaymentReceipt(pendingPayment.school_id, {
          amount,
          currency: "UGX",
          date: new Date().toISOString(),
          plan: pendingPayment.plan as "starter" | "growth" | "enterprise" | "lifetime",
          provider: pendingPayment.provider as "mtn" | "airtel",
          transactionId: txRef,
        });
      } catch (receiptError) {
        logger.error("Error sending receipt (non-critical):", receiptError);
      }

      logger.debug(`Mobile money payment completed for school: ${pendingPayment.school_id}, amount: ${amount}`);
    } else if (verifiedStatus === "FAILED") {
      await updatePendingMobilePayment(referenceId, "failed");
      await updatePaymentStatus(referenceId, "failed");
      logger.debug(`Mobile money payment failed for referenceId: ${referenceId}`);
    } else {
      logger.debug(`Mobile money payment still pending for referenceId: ${referenceId}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Mobile money webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
