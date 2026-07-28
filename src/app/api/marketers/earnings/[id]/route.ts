import { NextRequest } from "next/server";
import {
  createServiceRoleClientOrThrow,
  apiSuccess,
  apiError,
  handleApiError,
  requireAuthenticatedUser,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabase = createServiceRoleClientOrThrow();
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || profile.role !== "super_admin") return apiError("Forbidden", 403);

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.status) updates.status = body.status;
    if (body.status === "paid") updates.paid_at = new Date().toISOString();
    if (body.notes !== undefined) updates.notes = body.notes;

    const { data, error } = await supabase.from("marketer_earnings").update(updates).eq("id", id).select().single();

    if (error) {
      logger.error("Failed to update earning:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess(data);
  } catch (error) {
    logger.error("PATCH /api/marketers/earnings/[id] error:", error);
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabase = createServiceRoleClientOrThrow();
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || profile.role !== "super_admin") return apiError("Forbidden", 403);

    const { error } = await supabase.from("marketer_earnings").delete().eq("id", id);
    if (error) {
      logger.error("Failed to delete earning:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("DELETE /api/marketers/earnings/[id] error:", error);
    return handleApiError(error);
  }
}
