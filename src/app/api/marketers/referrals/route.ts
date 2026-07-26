import { NextRequest } from "next/server";
import {
  createServiceRoleClientOrThrow,
  apiSuccess,
  apiError,
  handleApiError,
  requireAuthenticatedUser,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";

function generateReferralCode(name?: string): string {
  const prefix = name
    ? name
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .substring(0, 4)
    : "MKT";
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

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

    let query = supabase.from("marketer_referral_codes").select("*").order("created_at", { ascending: false });

    if (profile.role === "marketer") {
      query = query.eq("marketer_id", profile.id);
    }

    const { data: referrals, error } = await query;
    if (error) return apiError("Failed to fetch referrals", 500);

    return apiSuccess({ referrals: referrals || [] });
  } catch (error) {
    logger.error("GET /api/marketers/referrals error:", error);
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
      .select("id, full_name, role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || profile.role !== "marketer") {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const label = body.label?.trim() || null;

    // Generate unique code
    let code = generateReferralCode(profile.full_name);
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from("marketer_referral_codes")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (!existing) break;
      code = generateReferralCode(profile.full_name);
      attempts++;
    }

    const { data: referral, error } = await supabase
      .from("marketer_referral_codes")
      .insert({
        marketer_id: profile.id,
        code,
        label,
        clicks: 0,
        conversions: 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) return apiError("Failed to create referral code", 500);

    return apiSuccess({ referral }, "Referral code created", 201);
  } catch (error) {
    logger.error("POST /api/marketers/referrals error:", error);
    return handleApiError(error);
  }
}
