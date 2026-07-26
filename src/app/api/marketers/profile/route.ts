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
      .select("id, full_name, phone, email, role, avatar_url, is_active, created_at")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || profile.role !== "marketer") {
      return apiError("Forbidden", 403);
    }

    // Get referral stats
    const { count: referralCount } = await supabase
      .from("marketer_referral_codes")
      .select("id", { count: "exact", head: true })
      .eq("marketer_id", profile.id);

    const { count: leadCount } = await supabase
      .from("marketer_leads")
      .select("id", { count: "exact", head: true })
      .eq("marketer_id", profile.id);

    const { count: schoolCount } = await supabase
      .from("schools")
      .select("id", { count: "exact", head: true })
      .eq("onboarded_by", profile.id);

    return apiSuccess({
      profile,
      stats: { referrals: referralCount || 0, leads: leadCount || 0, schools: schoolCount || 0 },
    });
  } catch (error) {
    logger.error("GET /api/marketers/profile error:", error);
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
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
    const updates: Record<string, unknown> = {};

    if (body.full_name?.trim()) updates.full_name = body.full_name.trim();
    if (body.phone?.trim()) updates.phone = body.phone.trim();
    if (body.email?.trim()) updates.email = body.email.trim();

    if (Object.keys(updates).length === 0) {
      return apiError("No fields to update", 400);
    }

    const { data: updated, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", profile.id)
      .select("id, full_name, phone, email, role")
      .single();

    if (error) return apiError("Failed to update profile", 500);

    return apiSuccess({ profile: updated }, "Profile updated");
  } catch (error) {
    logger.error("PATCH /api/marketers/profile error:", error);
    return handleApiError(error);
  }
}
