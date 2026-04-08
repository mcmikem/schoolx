import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SchoolPayService } from "@/lib/payments/schoolpay";
import { requireCronSecretOrDeny } from "@/lib/api-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

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
    console.error("SchoolPay sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "SchoolPay Transaction Sync API",
    usage:
      "POST with { schoolCode, apiPassword, date } or { schoolCode, apiPassword, fromDate, toDate }",
  });
}
