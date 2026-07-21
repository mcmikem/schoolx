import { NextRequest } from "next/server";
import {
  createServiceRoleClientOrThrow,
  apiSuccess,
  apiError,
  handleApiError,
  requireAuthenticatedUser,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";

async function requireSuperAdmin(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  const supabase = createServiceRoleClientOrThrow();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", auth.context.authUserId)
    .maybeSingle();

  if (!profile || profile.role !== "super_admin") {
    return { ok: false as const, response: apiError("Forbidden", 403) };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    return apiSuccess({
      emailConfigured: !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
    });
  } catch (error) {
    logger.error("GET /api/marketers/config error:", error);
    return handleApiError(error);
  }
}
