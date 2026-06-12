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

    if (updates.amount) {
      const parsedAmount = parseFloat(updates.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return apiError("Amount must be a positive number", 400);
      }
      updates.amount = parsedAmount;
    }

    if (updates.term) {
      const termNum = parseInt(updates.term);
      if (![1, 2, 3].includes(termNum)) {
        return apiError("Term must be 1, 2, or 3", 400);
      }
      updates.term = termNum;
    }

    const supabase = createServiceRoleClientOrThrow();

    const allowedFields = [
      "name", "class_id", "amount", "term", "academic_year", "due_date",
    ];

    const sanitized: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key];
      }
    }

    const { data, error } = await supabase
      .from("fee_structure")
      .update(sanitized)
      .eq("id", id)
      .eq("school_id", schoolId)
      .select("id")
      .single();

    if (error) {
      logger.error("[API Fees] Update failed:", error);
      return apiError("Failed to update fee structure", 500);
    }

    logger.info(`Updated fee structure ${id} in school ${schoolId}`);

    return apiSuccess({ id: data.id }, "Fee structure updated successfully");
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

    const supabase = createServiceRoleClientOrThrow();

    const { error } = await supabase
      .from("fee_structure")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: auth.context.user.id,
      })
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) {
      logger.error("[API Fees] Soft-delete failed:", error);
      return apiError("Failed to delete fee structure", 500);
    }

    logger.info(`Soft-deleted fee structure ${id} in school ${schoolId}`);

    return apiSuccess({ id }, "Fee structure deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
