import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  handleApiError,
  requireUserWithSchool,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";

const MODE_ADMIN_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "bursar",
];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: MODE_ADMIN_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    if (!auth.context.schoolId) {
      return apiError("School context required", 403);
    }

    const { billingMode } = (await request.json()) as {
      billingMode?: "full_suite" | "modular";
    };

    if (billingMode !== "full_suite" && billingMode !== "modular") {
      return apiError("Invalid billing mode", 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    const { error } = await supabase
      .from("schools")
      .update({ billing_mode: billingMode })
      .eq("id", auth.context.schoolId);

    if (error) {
      return apiError("Failed to update billing mode", 500);
    }

    return apiSuccess({ billing_mode: billingMode }, "Billing mode updated");
  } catch (error) {
    return handleApiError(error);
  }
}
