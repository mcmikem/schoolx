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
    if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("Invalid request body", 400);
    const updates: Record<string, unknown> = {};
    const allowedStatuses = ["pending", "approved", "cancelled", "paid"];
    if (body.status !== undefined && !allowedStatuses.includes(body.status)) {
      return apiError("Invalid earning status", 400);
    }
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string") {
      return apiError("Notes must be text", 400);
    }

    if (body.notes !== undefined)
      updates.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null;
    if (Object.keys(updates).length === 0 && body.status === undefined) {
      return apiError("Provide a status or notes update", 400);
    }

    let update = supabase.from("marketer_earnings").update(updates).eq("id", id);
    if (body.status !== undefined) {
      const { data: current, error: currentError } = await supabase
        .from("marketer_earnings")
        .select("id, status")
        .eq("id", id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return apiError("Earning not found", 404);

      const transitions: Record<string, string[]> = {
        pending: ["approved", "cancelled"],
        approved: ["paid", "cancelled"],
        cancelled: [],
        paid: [],
      };
      if (body.status !== current.status && !transitions[current.status]?.includes(body.status)) {
        return apiError(`Cannot change earning from ${current.status} to ${body.status}`, 409);
      }
      updates.status = body.status;
      if (body.status === "paid" && current.status !== "paid") updates.paid_at = new Date().toISOString();
      update = supabase.from("marketer_earnings").update(updates).eq("id", id).eq("status", current.status);
    }

    const { data, error } = await update.select().maybeSingle();

    if (error) {
      logger.error("Failed to update earning:", error);
      return apiError(error.message, 500);
    }
    if (!data) return apiError("Earning changed during this update. Reload and try again.", 409);
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
