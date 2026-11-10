import { NextRequest } from "next/server";
import {
  createServiceRoleClientOrThrow,
  apiSuccess,
  apiError,
  handleApiError,
  requireAuthenticatedUser,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const LEAD_STATUSES = new Set(["new", "contacted", "interested", "not_interested", "converted", "lost"]);

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
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("Invalid request body", 400);
    if (body.status !== undefined && (typeof body.status !== "string" || !LEAD_STATUSES.has(body.status))) {
      return apiError("Invalid lead status", 400);
    }

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
        if (["status", "next_follow_up"].includes(field)) continue;
        if (body[field] !== null && typeof body[field] !== "string") return apiError(`Invalid ${field}`, 400);
        const maxLength: Record<string, number> = {
          notes: 2000,
          contact_name: 160,
          contact_phone: 40,
          contact_email: 254,
          school_name: 200,
          district: 120,
        };
        if (typeof body[field] === "string" && body[field].length > maxLength[field]) {
          return apiError(`${field} exceeds ${maxLength[field]} characters`, 400);
        }
        updates[field] = typeof body[field] === "string" ? body[field].trim() || null : null;
      }
    }
    if (body.status !== undefined) updates.status = body.status;
    if (body.next_follow_up !== undefined) {
      if (body.next_follow_up !== null && typeof body.next_follow_up !== "string") {
        return apiError("Invalid next follow-up date", 400);
      }
      const followUp = body.next_follow_up ? new Date(body.next_follow_up) : null;
      if (followUp && Number.isNaN(followUp.getTime())) return apiError("Invalid next follow-up date", 400);
      updates.next_follow_up = followUp?.toISOString() ?? null;
    }
    if (typeof updates.contact_email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.contact_email))
      return apiError("Enter a valid contact email", 400);
    if (typeof updates.school_name === "string" && !updates.school_name) {
      return apiError("School name cannot be empty", 400);
    }
    if (Object.keys(updates).length === 0) return apiError("Provide at least one lead field to update", 400);
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

    if (error) {
      logger.error("Failed to delete lead:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess(null, "Lead deleted");
  } catch (error) {
    logger.error("DELETE /api/marketers/leads/[id] error:", error);
    return handleApiError(error);
  }
}
