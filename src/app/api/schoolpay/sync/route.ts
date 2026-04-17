import { NextRequest, NextResponse } from "next/server";
import { SchoolPayService } from "@/lib/payments/schoolpay";
import {
  createServiceRoleClientOrThrow,
  requireCronSecretOrDeny,
  requireDevelopmentRouteOrDeny,
} from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const devOnly = requireDevelopmentRouteOrDeny();
    if (!devOnly.ok) return devOnly.response;

    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const supabase = createServiceRoleClientOrThrow();

    const body = await request.json();
    const { schoolCode, apiPassword, date, fromDate, toDate } = body;

    if (!schoolCode || !apiPassword) {
      return NextResponse.json(
        { error: "School code and API password required" },
        { status: 400 },
      );
    }

    const schoolPay = new SchoolPayService(schoolCode, apiPassword);

    let response;
    if (date) {
      response = await schoolPay.syncTransactionsByDate(date);
    } else if (fromDate && toDate) {
      response = await schoolPay.syncTransactionsByRange(fromDate, toDate);
    } else {
      return NextResponse.json(
        { error: "Provide either date or fromDate/toDate range" },
        { status: 400 },
      );
    }

    if (response.returnCode !== 0) {
      return NextResponse.json(
        { error: response.returnMessage },
        { status: 400 },
      );
    }

    const regularTransactions = schoolPay.parseRegularTransactions(response);
    const supplementaryPayments =
      schoolPay.parseSupplementaryPayments(response);

    let insertedRegular = 0;
    let insertedSupplementary = 0;

    for (const tx of regularTransactions) {
      const { error } = await supabase.from("fee_payments").insert({
        student_id: tx.studentPaymentCode,
        amount: tx.amount,
        payment_date: tx.paymentDate.toISOString(),
        payment_method: tx.channel,
        reference_number: tx.receiptNumber,
        transaction_id: tx.transactionId,
        status: "completed",
      });

      if (!error) insertedRegular++;
    }

    for (const tx of supplementaryPayments) {
      const { error } = await supabase.from("fee_payments").insert({
        student_id: tx.studentPaymentCode,
        amount: tx.amount,
        payment_date: tx.paymentDate.toISOString(),
        payment_method: tx.channel,
        reference_number: tx.receiptNumber,
        transaction_id: tx.transactionId,
        description: tx.feeDescription,
        status: "completed",
      });

      if (!error) insertedSupplementary++;
    }

    return NextResponse.json({
      success: true,
      message: response.returnMessage,
      regularTransactions: insertedRegular,
      supplementaryPayments: insertedSupplementary,
    });
  } catch (error) {
    console.error("SchoolPay sync error");
    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const devOnly = requireDevelopmentRouteOrDeny();
  if (!devOnly.ok) return devOnly.response;

  const cron = requireCronSecretOrDeny(request);
  if (!cron.ok) return cron.response;

  return NextResponse.json({
    message: "SchoolPay Transaction Sync API",
    usage:
      "POST with { schoolCode, apiPassword, date } or { schoolCode, apiPassword, fromDate, toDate }",
  });
}
