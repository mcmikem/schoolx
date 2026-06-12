import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const FEE_MGMT_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "secretary",
  "bursar",
];

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { schoolId, ...updates } = body;

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

    if (updates.amount_paid) {
      const parsedAmount = parseFloat(updates.amount_paid);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return apiError("Payment amount must be a positive number", 400);
      }
      updates.amount_paid = parsedAmount;
    }

    const supabase = createServiceRoleClientOrThrow();

    const allowedFields = [
      "amount_paid", "payment_method", "payment_reference",
      "paid_by", "notes", "payment_date", "fee_id",
    ];

    const sanitized: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key];
      }
    }

    const { data, error } = await supabase
      .from("fee_payments")
      .update(sanitized)
      .eq("id", id)
      .eq("school_id", schoolId)
      .select("id")
      .single();

    if (error) {
      logger.error("[API FeePayments] Update failed:", error);
      return apiError("Failed to update fee payment", 500);
    }

    logger.info(`Updated fee payment ${id} in school ${schoolId}`);

    return apiSuccess({ id: data.id }, "Payment updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const schoolId = searchParams.get("school_id") || auth.context.schoolId;

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

    if (auth.context.user.role === "bursar") {
      return apiError("Bursars cannot delete payments", 403);
    }

    const supabase = createServiceRoleClientOrThrow();

    const { error } = await supabase
      .from("fee_payments")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: auth.context.user.id,
      })
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) {
      logger.error("[API FeePayments] Soft-delete failed:", error);
      return apiError("Failed to delete fee payment", 500);
    }

    logger.info(`Soft-deleted fee payment ${id} in school ${schoolId}`);

    return apiSuccess({ id }, "Payment deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
