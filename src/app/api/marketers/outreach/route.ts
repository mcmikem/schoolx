import { NextRequest } from "next/server";
import {
  createServiceRoleClientOrThrow,
  apiSuccess,
  apiError,
  handleApiError,
  requireAuthenticatedUser,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("lead_id");

    let query = supabase.from("marketer_outreach").select("*").order("sent_at", { ascending: false }).limit(50);

    if (profile.role === "marketer") {
      query = query.eq("marketer_id", profile.id);
    }
    if (leadId) {
      query = query.eq("lead_id", leadId);
    }

    const { data: messages, error } = await query;
    if (error) {
      logger.error("Failed to fetch outreach:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess({ messages: messages || [] });
  } catch (error) {
    logger.error("GET /api/marketers/outreach error:", error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { lead_id, school_id, type, recipient_name, recipient_contact, subject, content } = body;

    if (!type || !["email", "sms", "call", "whatsapp", "meeting"].includes(type)) {
      return apiError("Valid outreach type is required (email, sms, call, whatsapp, meeting)", 400);
    }

    const { data: message, error } = await supabase
      .from("marketer_outreach")
      .insert({
        marketer_id: profile.id,
        lead_id: lead_id || null,
        school_id: school_id || null,
        type,
        recipient_name: recipient_name?.trim() || null,
        recipient_contact: recipient_contact?.trim() || null,
        subject: subject?.trim() || null,
        content: content?.trim() || null,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to log outreach:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess({ message }, "Outreach logged", 201);
  } catch (error) {
    logger.error("POST /api/marketers/outreach error:", error);
    return handleApiError(error);
  }
}
