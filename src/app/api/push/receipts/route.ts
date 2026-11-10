import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  requireUserWithSchool,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
  rateLimit,
} from "@/lib/api-utils";

const ALLOWED = ["super_admin", "school_admin", "admin", "headmaster", "bursar"];

export async function GET(request: NextRequest) {
  const auth = await requireUserWithSchool(request);
  if (!auth.ok) return auth.response;
  const roleCheck = assertUserRoleOrDeny({ userRole: auth.context.user.role, allowedRoles: ALLOWED });
  if (!roleCheck.ok) return roleCheck.response;
  if (!auth.context.schoolId) return apiError("School context is required", 403);
  if (!rateLimit(request, 60, 60_000).success) return apiError("Too many receipt requests", 429);

  const requested = Number(new URL(request.url).searchParams.get("limit") || 30);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, Math.floor(requested))) : 30;
  const admin = createServiceRoleClientOrThrow();
  const { data, error } = await admin
    .from("push_delivery_receipts")
    .select("id, recipient_user_id, status, provider_status, created_at")
    .eq("school_id", auth.context.schoolId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return apiError("Could not load push delivery history", 503);
  return apiSuccess({ receipts: data || [] });
}
