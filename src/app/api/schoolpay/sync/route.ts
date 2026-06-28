import { NextRequest, NextResponse } from "next/server";
import { SchoolPayService } from "@/lib/payments/schoolpay";
import { logger } from "@/lib/logger";
import {
  createServiceRoleClientOrThrow,
  requireUserWithSchool,
  assertUserRoleOrDeny,
  requireCronSecretOrDeny,
} from "@/lib/api-utils";
import { loadSchoolSetting, saveSchoolSetting } from "@/lib/school-settings";

const SYNC_ROLES = ["super_admin", "school_admin", "admin", "bursar"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolCode, apiPassword, date, fromDate, toDate } = body;

    const supabase = createServiceRoleClientOrThrow();

    let schoolId: string;

    if (body._cron) {
      const cron = requireCronSecretOrDeny(request);
      if (!cron.ok) return cron.response;
    }

    const auth = await requireUserWithSchool(request);
    if (auth.ok) {
      const roleCheck = assertUserRoleOrDeny({
        userRole: auth.context.user.role,
        allowedRoles: SYNC_ROLES,
      });
      if (!roleCheck.ok) return roleCheck.response;
      schoolId = auth.context.schoolId!;
    } else {
      const cron = requireCronSecretOrDeny(request);
      if (!cron.ok) return cron.response;

      if (!schoolCode) {
        return NextResponse.json(
          { error: "schoolCode required for cron-authenticated sync" },
          { status: 400 },
        );
      }

      const schoolLookup = await supabase
        .from("schools")
        .select("id")
        .eq("school_code", schoolCode.trim().toUpperCase())
        .maybeSingle();

      if (!schoolLookup.data) {
        return NextResponse.json(
          { error: "School not found for provided school code" },
          { status: 404 },
        );
      }
      schoolId = schoolLookup.data.id;
    }

    const resolvedSchoolCode = schoolCode || (await loadSchoolSetting(schoolId, "schoolpay_school_code", ""));
    const resolvedApiPassword = apiPassword || (await loadSchoolSetting(schoolId, "schoolpay_api_password", ""));

    if (!resolvedSchoolCode || !resolvedApiPassword) {
      return NextResponse.json(
        {
          error: "SchoolPay credentials not configured. Set schoolpay_school_code and schoolpay_api_password in school settings, or provide schoolCode and apiPassword in the request body.",
        },
        { status: 400 },
      );
    }

    if (!schoolCode && resolvedSchoolCode) {
      await saveSchoolSetting(schoolId, "schoolpay_school_code", resolvedSchoolCode);
    }
    if (!apiPassword && resolvedApiPassword) {
      await saveSchoolSetting(schoolId, "schoolpay_api_password", resolvedApiPassword);
    }

    const schoolPay = new SchoolPayService(resolvedSchoolCode, resolvedApiPassword);

    let response;
    if (date) {
      response = await schoolPay.syncTransactionsByDate(date);
    } else if (fromDate && toDate) {
      response = await schoolPay.syncTransactionsByRange(fromDate, toDate);
    } else {
      const today = new Date().toISOString().split("T")[0];
      response = await schoolPay.syncTransactionsByDate(today);
    }

    if (response.returnCode !== 0) {
      return NextResponse.json(
        { error: response.returnMessage },
        { status: 400 },
      );
    }

    const regularTransactions = schoolPay.parseRegularTransactions(response);
    const supplementaryPayments = schoolPay.parseSupplementaryPayments(response);

    let insertedRegular = 0;
    let skippedDuplicates = 0;
    let insertedSupplementary = 0;

    const { withTimeout, timeoutFallback } = await import("@/lib/hooks/utils");

    for (const tx of regularTransactions) {
      const { data: existing } = await withTimeout(
        supabase
          .from("fee_payments")
          .select("id")
          .eq("payment_reference", tx.receiptNumber)
          .maybeSingle(),
        10000,
        timeoutFallback(),
      );

      if (existing) {
        skippedDuplicates++;
        continue;
      }

      const { data: student } = await withTimeout(
        supabase
          .from("students")
          .select("id")
          .eq("school_id", schoolId)
          .eq("student_number", tx.studentPaymentCode)
          .maybeSingle(),
        15000,
        timeoutFallback(),
      );

      if (!student) {
        logger.warn("Skipping SchoolPay transaction without matching student:", tx.studentPaymentCode);
        continue;
      }

      const { error } = await withTimeout(
        supabase.from("fee_payments").insert({
          student_id: student.id,
          amount_paid: tx.amount,
          payment_date: tx.paymentDate.toISOString().split("T")[0],
          payment_method: "mobile_money",
          payment_reference: tx.receiptNumber,
          notes: `SchoolPay ${tx.channel} ${tx.transactionId}`,
        }),
        15000,
        timeoutFallback(),
      );

      if (!error) insertedRegular++;
    }

    for (const tx of supplementaryPayments) {
      const { data: existing } = await withTimeout(
        supabase
          .from("fee_payments")
          .select("id")
          .eq("payment_reference", tx.receiptNumber)
          .maybeSingle(),
        10000,
        timeoutFallback(),
      );

      if (existing) {
        skippedDuplicates++;
        continue;
      }

      const { data: student } = await withTimeout(
        supabase
          .from("students")
          .select("id")
          .eq("school_id", schoolId)
          .eq("student_number", tx.studentPaymentCode)
          .maybeSingle(),
        15000,
        timeoutFallback(),
      );

      if (!student) {
        logger.warn("Skipping SchoolPay supplementary transaction without matching student:", tx.studentPaymentCode);
        continue;
      }

      const { error } = await withTimeout(
        supabase.from("fee_payments").insert({
          student_id: student.id,
          amount_paid: tx.amount,
          payment_date: tx.paymentDate.toISOString().split("T")[0],
          payment_method: "mobile_money",
          payment_reference: tx.receiptNumber,
          notes: tx.feeDescription,
        }),
        15000,
        timeoutFallback(),
      );

      if (!error) insertedSupplementary++;
    }

    return NextResponse.json({
      success: true,
      message: response.returnMessage,
      regularTransactions: insertedRegular,
      supplementaryPayments: insertedSupplementary,
      skippedDuplicates,
    });
  } catch (error) {
    logger.error("SchoolPay sync error:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireUserWithSchool(request);
  if (auth.ok) {
    return NextResponse.json({
      message: "SchoolPay Transaction Sync API",
      usage: "POST with { date } or { fromDate, toDate }. Credentials stored in school settings.",
    });
  }

  const cron = requireCronSecretOrDeny(request);
  if (!cron.ok) return cron.response;

  return NextResponse.json({
    message: "SchoolPay Transaction Sync API",
    usage: "POST with { schoolCode, apiPassword, date } or { schoolCode, apiPassword, fromDate, toDate }",
  });
}
