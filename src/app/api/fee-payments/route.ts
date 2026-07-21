import { NextRequest } from "next/server";
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
      return apiError("Failed to fetch fee payments", 500);
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

    const payload = {
      school_id: schoolId,
      student_id: paymentData.student_id,
      fee_id: paymentData.fee_id || null,
      amount_paid: parsedAmount,
      payment_method: paymentData.payment_method,
      payment_reference: String(paymentData.payment_reference || "").trim() || null,
      paid_by: String(paymentData.paid_by || "").trim() || null,
      notes: String(paymentData.notes || "").trim() || null,
      payment_date: paymentData.payment_date || new Date().toISOString().split("T")[0],
      recorded_by: auth.context.user.id,
    };

    const { data, error } = await supabase
      .from("fee_payments")
      .insert(payload)
      .select("id, student_id, amount_paid, payment_date")
      .single();

    if (error) {
      logger.error("[API FeePayments] Insert failed:", error);
      return apiError("Failed to create fee payment", 500);
    }

    logger.info(`Created fee payment ${data.id} (UGX ${parsedAmount}) in school ${schoolId}`);

    return apiSuccess({ id: data.id }, "Payment recorded successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
