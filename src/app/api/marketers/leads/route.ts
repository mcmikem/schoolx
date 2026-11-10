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
    const rawSearch = searchParams.get("search") || "";
    // PostgREST's .or() accepts a filter expression, so strip grammar
    // separators/operators before interpolating user text into that syntax.
    const search = rawSearch
      .replace(/[(),.%*_\\"]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
    if (status && !LEAD_STATUSES.has(status)) return apiError("Invalid lead status filter", 400);

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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("Invalid request body", 400);
    const { school_name, contact_name, contact_phone, contact_email, district, notes, school_id } = body;

    if (typeof school_name !== "string" || !school_name.trim() || school_name.trim().length > 200) {
      return apiError("School name is required and must be 200 characters or fewer", 400);
    }
    if (school_id !== undefined && school_id !== null && typeof school_id !== "string") {
      return apiError("Invalid school reference", 400);
    }
    if (school_id) {
      const { data: ownedSchool } = await supabase
        .from("schools")
        .select("id")
        .eq("id", school_id)
        .eq("onboarded_by", profile.id)
        .maybeSingle();
      if (!ownedSchool) return apiError("School not found", 404);
    }
    const optionalText = [contact_name, contact_phone, contact_email, district, notes];
    if (optionalText.some((value) => value != null && typeof value !== "string")) {
      return apiError("Lead contact fields must be text", 400);
    }
    if (
      String(contact_name || "").length > 160 ||
      String(contact_phone || "").length > 40 ||
      String(contact_email || "").length > 254 ||
      String(district || "").length > 120 ||
      String(notes || "").length > 2000
    )
      return apiError("One or more lead fields exceed the allowed length", 400);
    if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email.trim())) {
      return apiError("Enter a valid contact email", 400);
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
