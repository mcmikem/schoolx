import { NextRequest, NextResponse } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  validateRequiredFields,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { buildOutstandingItems, allocatePaymentOldestFirst, totalOutstanding } from "@/lib/server/fee-logic";
import { requireModuleEntitlement } from "@/lib/subscription-guard";

const FEE_MGMT_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "secretary", "bursar"];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = request.nextUrl;
    const schoolId = searchParams.get("school_id") || auth.context.schoolId;
    const studentId = searchParams.get("student_id");
    const paymentMethod = searchParams.get("payment_method");
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    if (auth.context.user.role !== "super_admin") {
      const scope = assertSchoolScopeOrDeny({
        userSchoolId: auth.context.schoolId,
        requestedSchoolId: schoolId,
      });
      if (!scope.ok) return scope.response;
    }

    const supabase = createServiceRoleClientOrThrow();

    const moduleCheck = await requireModuleEntitlement({
      supabase,
      schoolId: schoolId as string,
      moduleKey: "finance",
    });
    if (!moduleCheck.ok) return moduleCheck.response;

    let query = supabase
      .from("fee_payments")
      .select("*, students!inner (id, first_name, last_name, school_id, classes (name))", { count: "exact" })
      .eq("students.school_id", schoolId)
      .is("deleted_at", null)
      .order("payment_date", { ascending: false });

    if (studentId) {
      query = query.eq("student_id", studentId);
    }

    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }

    if (fromDate) {
      query = query.gte("payment_date", fromDate);
    }

    if (toDate) {
      query = query.lte("payment_date", toDate);
    }

    const { data: payments, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error("Failed to fetch fee payments:", error);
      return apiError(error.message, 500);
    }

    return apiSuccess({
      payments: payments || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { schoolId, ...paymentData } = body;

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    });
    if (!scope.ok) return scope.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: FEE_MGMT_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const missing = validateRequiredFields(paymentData, ["student_id", "amount_paid", "payment_method"]);
    if (missing) {
      return apiError(missing, 400);
    }

    const parsedAmount = parseFloat(paymentData.amount_paid);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return apiError("Payment amount must be a positive number", 400);
    }

    if (parsedAmount > 100_000_000) {
      return apiError("Payment amount seems too large", 400);
    }

    const validMethods = ["cash", "mobile_money", "bank", "installment", "in_kind"];
    if (!validMethods.includes(paymentData.payment_method)) {
      return apiError("Invalid payment method", 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    const moduleCheck = await requireModuleEntitlement({
      supabase,
      schoolId,
      moduleKey: "finance",
    });
    if (!moduleCheck.ok) return moduleCheck.response;

    const baseNotes = String(paymentData.notes || "").trim() || null;
    const common = {
      school_id: schoolId,
      student_id: paymentData.student_id,
      payment_method: paymentData.payment_method,
      payment_reference: String(paymentData.payment_reference || "").trim() || null,
      paid_by: String(paymentData.paid_by || "").trim() || null,
      payment_date: paymentData.payment_date || new Date().toISOString().split("T")[0],
      recorded_by: auth.context.user.id,
    };

    async function insertRows(rows: Record<string, unknown>[]) {
      const result = await withTimeout(
        supabase.from("fee_payments").insert(rows).select("id, student_id, amount_paid, payment_date"),
        15000,
        timeoutFallback(),
      );
      if ((result as { status?: number })?.status === 408) {
        return { timeout: true as const };
      }
      return { timeout: false as const, data: result.data, error: result.error };
    }

    // --- Oldest-first allocation + overpayment guard (ROADMAP #35) ---
    // Fetch the student's class + outstanding charges + ledger in parallel.
    const studentResult = await withTimeout(
      supabase
        .from("students")
        .select("id, class_id")
        .eq("id", paymentData.student_id)
        .eq("school_id", schoolId)
        .maybeSingle(),
      15000,
      timeoutFallback(),
    );
    if ((studentResult as { status?: number })?.status === 408) {
      return apiError("Request timed out fetching student. Please try again.", 504);
    }
    const student = studentResult.data as { id: string; class_id: string | null } | null;
    if (!student) {
      return apiError("Student not found in this school", 404);
    }

    const [chargesResult, ledgerResult] = await Promise.all([
      withTimeout(
        supabase
          .from("fee_structure")
          .select("id, name, amount, due_date, academic_year, term, class_id")
          .eq("school_id", schoolId)
          .is("deleted_at", null),
        15000,
        timeoutFallback(),
      ),
      withTimeout(
        supabase
          .from("fee_payments")
          .select("fee_id, amount_paid")
          .eq("student_id", paymentData.student_id)
          .eq("school_id", schoolId)
          .is("deleted_at", null),
        15000,
        timeoutFallback(),
      ),
    ]);
    if (
      (chargesResult as { status?: number })?.status === 408 ||
      (ledgerResult as { status?: number })?.status === 408
    ) {
      return apiError("Request timed out fetching fee balances. Please try again.", 504);
    }

    const charges = ((chargesResult.data as unknown[] | null) || [])
      .filter(
        (c) =>
          c &&
          typeof c === "object" &&
          ((c as { class_id?: string | null }).class_id === null ||
            (c as { class_id?: string | null }).class_id === undefined ||
            (c as { class_id?: string | null }).class_id === student.class_id),
      )
      .map((c) => {
        const row = c as {
          id: string;
          name: string;
          amount: number;
          due_date: string | null;
          academic_year: string;
          term: number;
        };
        return {
          id: row.id,
          name: row.name,
          amount: Number(row.amount) || 0,
          due_date: row.due_date,
          academic_year: row.academic_year,
          term: row.term,
        };
      });
    const ledger = ((ledgerResult.data as unknown[] | null) || []).map((p) => {
      const row = p as { fee_id: string | null; amount_paid: number };
      return { fee_id: row.fee_id, amount_paid: Number(row.amount_paid) || 0 };
    });

    const outstanding = buildOutstandingItems(charges, ledger);
    const outstandingTotal = totalOutstanding(outstanding);
    const allowOverpayment = paymentData.allow_overpayment === true || paymentData.allow_overpayment === "true";

    // Explicit fee target: keep single-row behaviour, but guard the amount.
    if (paymentData.fee_id) {
      const target = outstanding.find((i) => i.feeStructureId === paymentData.fee_id);
      if ((!target || parsedAmount > target.balance) && !allowOverpayment) {
        return NextResponse.json(
          {
            success: false,
            error: target
              ? `Amount exceeds the outstanding UGX ${target.balance.toLocaleString()} for ${target.name}`
              : "Selected fee has no outstanding balance",
            outstanding: target?.balance ?? 0,
            excess: target ? Math.round((parsedAmount - target.balance) * 100) / 100 : parsedAmount,
          },
          { status: 409 },
        );
      }
      const payload = {
        ...common,
        fee_id: paymentData.fee_id,
        amount_paid: parsedAmount,
        notes:
          allowOverpayment && target && parsedAmount > target.balance
            ? [baseNotes, "[overpayment accepted]"].filter(Boolean).join(" ")
            : baseNotes,
      };
      const inserted = await insertRows([payload]);
      if (inserted.timeout) {
        return apiError("Request timed out recording payment. Check the payments list before retrying.", 504);
      }
      if (inserted.error) {
        logger.error("[API FeePayments] Insert failed:", inserted.error);
        return apiError(inserted.error.message, 500);
      }
      const data = (inserted.data as unknown[] | null)?.[0] as { id: string } | undefined;
      logger.info(`Created fee payment ${data?.id} (UGX ${parsedAmount}) in school ${schoolId}`);
      return apiSuccess({ id: data?.id }, "Payment recorded successfully", 201);
    }

    // No explicit target: split oldest-first across outstanding charges.
    if (parsedAmount > outstandingTotal && !allowOverpayment) {
      return NextResponse.json(
        {
          success: false,
          error: `Amount exceeds the student's total outstanding UGX ${outstandingTotal.toLocaleString()}`,
          outstanding: outstandingTotal,
          excess: Math.round((parsedAmount - outstandingTotal) * 100) / 100,
        },
        { status: 409 },
      );
    }

    if (parsedAmount > outstandingTotal && allowOverpayment) {
      const payload = {
        ...common,
        fee_id: null,
        amount_paid: parsedAmount,
        notes: [baseNotes, "[overpayment accepted]"].filter(Boolean).join(" ") || null,
      };
      const inserted = await insertRows([payload]);
      if (inserted.timeout) {
        return apiError("Request timed out recording payment. Check the payments list before retrying.", 504);
      }
      if (inserted.error) {
        logger.error("[API FeePayments] Insert failed:", inserted.error);
        return apiError(inserted.error.message, 500);
      }
      const data = (inserted.data as unknown[] | null)?.[0] as { id: string } | undefined;
      return apiSuccess({ id: data?.id }, "Overpayment recorded", 201);
    }

    const { allocations } = allocatePaymentOldestFirst(outstanding, parsedAmount);
    const rows = allocations.map((a) => ({
      ...common,
      fee_id: a.feeStructureId,
      amount_paid: a.amount,
      notes: [baseNotes, `[auto-allocated to ${a.name}]`].filter(Boolean).join(" ") || null,
    }));
    const inserted = await insertRows(rows);
    if (inserted.timeout) {
      return apiError("Request timed out recording payment. Check the payments list before retrying.", 504);
    }
    if (inserted.error) {
      logger.error("[API FeePayments] Insert failed:", inserted.error);
      return apiError(inserted.error.message, 500);
    }
    const ids = ((inserted.data as unknown[] | null) || []).map((r) => (r as { id: string }).id);
    logger.info(
      `Created ${ids.length} fee payment row(s) (UGX ${parsedAmount} split oldest-first) in school ${schoolId}`,
    );
    return apiSuccess({ ids, allocations }, `Payment split across ${allocations.length} outstanding fee(s)`, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
