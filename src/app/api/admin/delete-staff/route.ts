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

const DELETE_ALLOWED_ROLES = ["super_admin", "school_admin", "headmaster", "admin"];

// Every FK to users(id) declared without ON DELETE in schema.sql/migrations.
// They abort the row delete with 23503 the moment the account touched real
// data (attendance.recorded_by for a teacher who took the register, grades
// for one who marked, …), which is why deleting staff "did nothing" in prod.
const USER_REFERENCE_COLUMNS: Array<[table: string, column: string]> = [
  ["activity_comments", "author_id"],
  ["attendance", "recorded_by"],
  ["audit_log", "user_id"],
  ["classes", "class_teacher_id"],
  ["co_curricular_activities", "created_by"],
  ["course_classes", "teacher_id"],
  ["events", "created_by"],
  ["fee_adjustments", "recorded_by"],
  ["fee_payments", "deleted_by"],
  ["fee_payments", "recorded_by"],
  ["fee_structure", "deleted_by"],
  ["grades", "exam_supervisor_id"],
  ["grades", "locked_by"],
  ["grades", "recorded_by"],
  ["messages", "sent_by"],
  ["momo_disbursements", "created_by"],
  ["password_reset_tokens", "created_by"],
  ["payroll_history", "processed_by"],
  ["period_attendance", "recorded_by"],
  ["salary_payments", "processed_by"],
  ["security_events", "user_id"],
  ["student_comments", "created_by"],
  ["student_enrollments", "created_by"],
  ["students", "user_id"],
  ["suggestions", "created_by"],
];

function isMissingRelationOrColumn(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST204" || code === "PGRST301" || code === "42703";
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: DELETE_ALLOWED_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const body = await request.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId : null;
    if (!userId) return apiError("User ID is required", 400);

    if (userId === auth.context.user.id) {
      return apiError("You cannot delete your own account", 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    const { data: target, error: targetError } = await supabase
      .from("users")
      .select("id, auth_id, full_name, role, school_id")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) {
      logger.error("[delete-staff] lookup failed", targetError);
      return apiError(targetError.message, 500);
    }
    if (!target) return apiError("Staff member not found", 404);

    if (auth.context.user.role !== "super_admin") {
      const scope = assertSchoolScopeOrDeny({
        userSchoolId: auth.context.schoolId,
        requestedSchoolId: target.school_id,
      });
      if (!scope.ok) return scope.response;

      if (target.role === "super_admin") {
        return apiError("Only a super admin can delete a super admin", 403);
      }
    }

    // Fast path first: most accounts have nothing pointing at them.
    let { error: deleteError } = await supabase.from("users").delete().eq("id", userId);

    if (deleteError?.code === "23503") {
      // A foreign key still points at this account (attendance.recorded_by for
      // a teacher who took the register, grades.recorded_by, …). Clear every
      // FK to users and retry. Best effort: a missing table or column (schema
      // drift) must not block the deletion.
      const detachResults = await Promise.all(
        USER_REFERENCE_COLUMNS.map(async ([table, column]) => {
          const { error } = await supabase
            .from(table)
            .update({ [column]: null })
            .eq(column, userId);
          if (error && !isMissingRelationOrColumn(error)) {
            logger.warn(`[delete-staff] could not clear ${table}.${column}`, error);
          }
          return error;
        }),
      );

      // Join tables are cleared explicitly too — the cascade is missing on
      // some deployments.
      await supabase.from("teacher_subjects").delete().eq("teacher_id", userId);
      await supabase.from("parent_students").delete().eq("parent_id", userId);

      const retry = await supabase.from("users").delete().eq("id", userId);
      deleteError = retry.error;

      if (!deleteError) {
        const detachFailures = detachResults.filter((error) => error && !isMissingRelationOrColumn(error)).length;
        if (detachFailures > 0) {
          logger.warn(`[delete-staff] ${detachFailures} reference columns could not be cleared`, {
            userId,
          });
        }
      }
    }

    if (deleteError) {
      logger.error("[delete-staff] users delete failed", deleteError);
      if (deleteError.code === "23503") {
        return apiError(
          "This account is still referenced by other records, so it cannot be deleted. Deactivate it instead.",
          409,
        );
      }
      return apiError(deleteError.message, 500);
    }

    // The profile row is gone; without this the person could still sign in
    // and would fail later with "User profile not found".
    let authDeleted = true;
    if (target.auth_id) {
      const { error: authError } = await supabase.auth.admin.deleteUser(target.auth_id);
      if (authError) {
        authDeleted = false;
        logger.error("[delete-staff] auth user delete failed", authError);
      }
    }

    logger.info("[delete-staff] removed staff member", {
      userId,
      role: target.role,
      name: target.full_name,
      authDeleted,
    });

    if (!authDeleted) {
      return apiSuccess(
        { deleted: true, authDeleted: false },
        "Staff member removed, but their sign-in could not be revoked. Change their password to lock them out.",
      );
    }

    return apiSuccess({ deleted: true }, "Staff member deleted");
  } catch (error) {
    return handleApiError(error);
  }
}
