import { NextRequest, NextResponse } from "next/server";
import { SchoolPayService } from "@/lib/payments/schoolpay";
import { logger } from "@/lib/logger";
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

    const schoolLookup = await supabase
      .from("schools")
      .select("id, school_code")
      .eq("school_code", schoolCode.trim().toUpperCase())
      .maybeSingle();

    if (schoolLookup.error) {
      return NextResponse.json(
        { error: "Failed to resolve school for SchoolPay sync" },
        { status: 500 },
      );
    }

    if (!schoolLookup.data) {
      return NextResponse.json(
        { error: "School not found for provided school code" },
        { status: 404 },
      );
    }

    const schoolId = schoolLookup.data.id;

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
      const { withTimeout } = await import('@/lib/hooks/utils');
      const { data: student } = await withTimeout(
        supabase
          .from("students")
          .select("id, school_id, student_number")
          .eq("school_id", schoolId)
          .eq("student_number", tx.studentPaymentCode)
          .maybeSingle(),
        15000,
        null as any,
      );

      if (!student) {
        logger.warn("Skipping SchoolPay transaction without matching student:", tx.studentPaymentCode);
        continue;
      }

      const regResult = await withTimeout(
        supabase.from("fee_payments").insert({
          student_id: student.id,
          amount_paid: tx.amount,
          payment_date: tx.paymentDate.toISOString().split("T")[0],
          payment_method: "mobile_money",
          payment_reference: tx.receiptNumber,
          notes: `SchoolPay ${tx.channel} ${tx.transactionId}`,
        }),
        15000,
        null as any
      );
      const error = regResult?.error;

      if (!error) insertedRegular++;
    }

    for (const tx of supplementaryPayments) {
      const { withTimeout } = await import('@/lib/hooks/utils');
      const { data: student } = await withTimeout(
        supabase
          .from("students")
          .select("id, school_id, student_number")
          .eq("school_id", schoolId)
          .eq("student_number", tx.studentPaymentCode)
          .maybeSingle(),
        15000,
        null as any,
      );

      if (!student) {
        logger.warn("Skipping SchoolPay supplementary transaction without matching student:", tx.studentPaymentCode);
        continue;
      }

      const suppResult = await withTimeout(
        supabase.from("fee_payments").insert({
          student_id: student.id,
          amount_paid: tx.amount,
          payment_date: tx.paymentDate.toISOString().split("T")[0],
          payment_method: "mobile_money",
          payment_reference: tx.receiptNumber,
          notes: tx.feeDescription,
        }),
        15000,
        null as any
      );
      const error = suppResult?.error;

      if (!error) insertedSupplementary++;
    }

    return NextResponse.json({
      success: true,
      message: response.returnMessage,
      regularTransactions: insertedRegular,
      supplementaryPayments: insertedSupplementary,
    });
  } catch (error) {
    logger.error(
      "SchoolPay sync error:",
      error instanceof Error ? error.message : "unknown error",
    );
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
