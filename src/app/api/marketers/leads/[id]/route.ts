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
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabase = createServiceRoleClientOrThrow();
    const { data: profile } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || (profile.role !== "marketer" && profile.role !== "super_admin")) {
      return apiError("Forbidden", 403);
    }

    const { id } = await params;
    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields = [
      "status",
      "notes",
      "next_follow_up",
      "contact_name",
      "contact_phone",
      "contact_email",
      "school_name",
      "district",
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field] === "" ? null : body[field];
      }
    }
    updates.updated_at = new Date().toISOString();

    let query = supabase.from("marketer_leads").update(updates).eq("id", id);

    // Marketers can only update their own leads
    if (profile.role === "marketer") {
      query = query.eq("marketer_id", profile.id);
    }

    const { data: lead, error } = await query.select().single();
    if (error) {
      if (error.code === "PGRST116") return apiError("Lead not found", 404);
      return apiError("Failed to update lead", 500);
    }

    return apiSuccess({ lead }, "Lead updated");
  } catch (error) {
    logger.error("PATCH /api/marketers/leads/[id] error:", error);
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabase = createServiceRoleClientOrThrow();
    const { data: profile } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || profile.role !== "marketer") {
      return apiError("Forbidden", 403);
    }

    const { id } = await params;

    const { error } = await supabase.from("marketer_leads").delete().eq("id", id).eq("marketer_id", profile.id);

    if (error) return apiError("Failed to delete lead", 500);

    return apiSuccess(null, "Lead deleted");
  } catch (error) {
    logger.error("DELETE /api/marketers/leads/[id] error:", error);
    return handleApiError(error);
  }
}
