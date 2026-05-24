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

    // Give newly switched modular schools a short reports trial so they are never blocked immediately.
    if (billingMode === "modular") {
      const startsAt = new Date();
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + 30);

      await supabase.from("school_module_entitlements").upsert(
        {
          school_id: auth.context.schoolId,
          module_key: "reports",
          status: "trial",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          auto_renew: false,
          source: "trial",
          created_by: auth.context.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "school_id,module_key" },
      );
    }

    return apiSuccess({ billing_mode: billingMode }, "Billing mode updated");
  } catch (error) {
    return handleApiError(error);
  }
}
