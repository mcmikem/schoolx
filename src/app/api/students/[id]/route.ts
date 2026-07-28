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

const STUDENT_MGMT_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "secretary"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const schoolId = searchParams.get("school_id") || auth.context.schoolId;

    if (auth.context.user.role !== "super_admin") {
      const scope = assertSchoolScopeOrDeny({
        userSchoolId: auth.context.schoolId,
        requestedSchoolId: schoolId,
      });
      if (!scope.ok) return scope.response;
    }

    const supabase = createServiceRoleClientOrThrow();
    const { data: student, error } = await supabase
      .from("students")
      .select("*, classes(id, name, level, stream)")
      .eq("id", id)
      .eq("school_id", schoolId)
      .single();

    if (error) {
      logger.error("[API Students] Failed to fetch student:", error);
      return apiError(error.message, 500);
    }
    if (!student) {
      return apiError("Student not found", 404);
    }

    return apiSuccess({ student });
  } catch (error) {
    return handleApiError(error);
  }
}

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
      allowedRoles: STUDENT_MGMT_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    if (updates.gender && !["M", "F"].includes(updates.gender)) {
      return apiError("Gender must be 'M' or 'F'", 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    const allowedFields = [
      "first_name",
      "last_name",
      "gender",
      "date_of_birth",
      "parent_name",
      "parent_phone",
      "parent_phone2",
      "parent_email",
      "address",
      "class_id",
      "student_number",
      "ple_index_number",
      "opening_balance",
      "boarding_status",
      "house_id",
      "previous_school",
      "district_origin",
      "sub_county",
      "parish",
      "village",
      "photo_url",
      "blood_type",
      "religion",
      "nationality",
      "prefect_role",
      "student_council_role",
      "games_house",
      "is_class_monitor",
      "nin",
      "status",
      "transfer_from",
      "transfer_to",
      "transfer_reason",
      "dropout_reason",
      "dropout_date",
    ];

    const sanitized: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key];
      }
    }

    const { data, error } = await supabase
      .from("students")
      .update(sanitized)
      .eq("id", id)
      .eq("school_id", schoolId)
      .select("id, student_number")
      .single();

    if (error) {
      logger.error("[API Students] Update failed:", error);
      return apiError(error.message, 500);
    }

    logger.info(`Updated student ${id} in school ${schoolId}`);

    return apiSuccess({ id: data.id }, "Student updated successfully");
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
      allowedRoles: STUDENT_MGMT_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const supabase = createServiceRoleClientOrThrow();

    // Soft-delete: mark as dropped rather than hard delete
    const { error } = await supabase
      .from("students")
      .update({
        status: "dropped",
        dropout_reason: "Deleted via API",
        dropout_date: new Date().toISOString().split("T")[0],
      })
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) {
      logger.error("[API Students] Soft-delete failed:", error);
      return apiError(error.message, 500);
    }

    logger.info(`Soft-deleted student ${id} in school ${schoolId}`);

    return apiSuccess({ id }, "Student soft-deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
