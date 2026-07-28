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
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let query = supabase.from("marketer_leads").select("*").order("created_at", { ascending: false });

    if (profile.role === "marketer") {
      query = query.eq("marketer_id", profile.id);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (search) {
      query = query.or(
        `school_name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_phone.ilike.%${search}%,district.ilike.%${search}%`,
      );
    }

    const { data: leads, error } = await query;
    if (error) {
      logger.error("Failed to fetch leads:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess({ leads: leads || [] });
  } catch (error) {
    logger.error("GET /api/marketers/leads error:", error);
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
    const { school_name, contact_name, contact_phone, contact_email, district, notes, school_id } = body;

    if (!school_name?.trim()) {
      return apiError("School name is required", 400);
    }

    const { data: lead, error } = await supabase
      .from("marketer_leads")
      .insert({
        marketer_id: profile.id,
        school_id: school_id || null,
        school_name: school_name.trim(),
        contact_name: contact_name?.trim() || null,
        contact_phone: contact_phone?.trim() || null,
        contact_email: contact_email?.trim() || null,
        district: district?.trim() || null,
        notes: notes?.trim() || null,
        status: "new",
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create lead:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess({ lead }, "Lead created", 201);
  } catch (error) {
    logger.error("POST /api/marketers/leads error:", error);
    return handleApiError(error);
  }
}
