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

const FEE_MGMT_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "secretary", "bursar"];

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { schoolId, ...updates } = body as Record<string, unknown>;

    const resolvedSchoolId = (schoolId as string) || auth.context.schoolId;

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: resolvedSchoolId,
    });
    if (!scope.ok) return scope.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: FEE_MGMT_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    if (updates.amount_paid !== undefined && updates.amount_paid !== null) {
      const parsedAmount = parseFloat(String(updates.amount_paid));
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return apiError("Payment amount must be a positive number", 400);
      }
      updates.amount_paid = parsedAmount;
    }

    const supabase = createServiceRoleClientOrThrow();

    const allowedFields = [
      "amount_paid",
      "payment_method",
      "payment_reference",
      "paid_by",
      "notes",
      "payment_date",
      "fee_id",
    ];

    const sanitized: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key];
      }
    }
    sanitized.updated_at = new Date().toISOString();
    sanitized.updated_by = auth.context.user.id;

    const { data, error } = await supabase
      .from("fee_payments")
      .update(sanitized)
      .eq("id", id)
      .eq("school_id", resolvedSchoolId)
      .select("id")
      .maybeSingle();
    if (!data && !error) {
      const { data: existing } = await supabase.from("fee_payments").select("id").eq("id", id).maybeSingle();
      if (!existing) return apiError("Payment not found", 404);
    }

    if (error) {
      logger.error("[API FeePayments] Update failed:", error);
      return apiError(error.message, 500);
    }

    logger.info(`Updated fee payment ${id} in school ${resolvedSchoolId}`);

    return apiSuccess({ id: data?.id || id }, "Payment updated successfully");
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

    // There was a hard 403 for bursars here, immediately after a role check
    // whose allowedRoles (FEE_MGMT_ROLES) already includes "bursar". The second
    // check made the first one decorative for exactly the role the money
    // actually matters for. Voiding is a soft delete, audited, and behind a
    // confirm in the UI -- a bursar mistyping an amount is who it serves.

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
      return apiError(error.message, 500);
    }

    logger.info(`Soft-deleted fee payment ${id} in school ${schoolId}`);

    return apiSuccess({ id }, "Payment deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
