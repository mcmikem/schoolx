import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  apiSuccess,
  apiError,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  supabaseClientOptions,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { passwordMeetsPolicy, PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

// The staff directory lets a headmaster (isHM) reset passwords, so the API
// must accept the same roles the UI shows the action for — otherwise the
// request dies with 403 after the prompt was answered.
const PASSWORD_RESET_ALLOWED_ROLES = ["super_admin", "school_admin", "headmaster", "admin"];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: PASSWORD_RESET_ALLOWED_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return apiError("Server configuration error", 500);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiError("Invalid request body", 400);
    }
    const { userId, password } = body;

    if (typeof userId !== "string" || !userId.trim() || typeof password !== "string") {
      return apiError("User ID and password are required", 400);
    }

    if (!passwordMeetsPolicy(password)) {
      return apiError(PASSWORD_POLICY_MESSAGE, 400);
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      supabaseClientOptions({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );

    // Get user data to find auth_id
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("auth_id, school_id")
      .eq("id", userId.trim())
      .maybeSingle();

    if (userError || !userData?.auth_id || !userData?.school_id) {
      return apiError("User not found", 404);
    }

    if (auth.context.user.role !== "super_admin") {
      const scope = assertSchoolScopeOrDeny({
        userSchoolId: auth.context.schoolId,
        requestedSchoolId: userData.school_id,
      });
      if (!scope.ok) return scope.response;
    }

    // Update password via admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(userData.auth_id, { password: password });

    if (updateError) {
      logger.error("Failed to update password", { code: updateError.code, status: updateError.status });
      return apiError("Could not reset the password. Please try again.", 500);
    }

    // The password above was chosen by an admin; force the recipient to pick
    // their own on next load (ForcePasswordChangeGate reads this flag).
    const { error: flagError } = await supabase
      .from("users")
      .update({ password_reset_required: true })
      .eq("id", userId.trim());
    if (flagError) {
      logger.error("Failed to flag password_reset_required:", flagError);
    }

    return apiSuccess({ success: true }, "Password reset successful");
  } catch (error) {
    logger.error("[Admin Reset Password Error]", { errorType: error instanceof Error ? error.name : "unknown" });
    return apiError("Could not reset the password. Please try again.", 500);
  }
}
