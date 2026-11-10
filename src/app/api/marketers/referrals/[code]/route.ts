import { NextRequest } from "next/server";
import { createServiceRoleClientOrThrow, apiError, handleApiError, rateLimit } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

// Track a referral click (public — no auth required)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    if (!rateLimit(_request, 60, 60_000).success) return apiError("Too many referral requests", 429);
    const { code } = await params;
    const normalizedCode = typeof code === "string" ? code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9_-]{2,40}$/.test(normalizedCode)) return apiError("Referral code not found", 404);

    const supabase = createServiceRoleClientOrThrow();

    const { data: referral, error } = await supabase
      .from("marketer_referral_codes")
      .select("id, code, clicks, is_active")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (error || !referral) {
      return apiError("Referral code not found", 404);
    }

    if (!referral.is_active) {
      return apiError("Referral code is inactive", 410);
    }

    // Increment click count
    await supabase
      .from("marketer_referral_codes")
      .update({ clicks: (referral.clicks || 0) + 1 })
      .eq("id", referral.id);

    // Redirect to registration page with referral code
    const redirect = new URL("/register", _request.url);
    redirect.searchParams.set("ref", normalizedCode);
    return Response.redirect(redirect, 307);
  } catch (error) {
    logger.error("GET /api/marketers/referrals/[code] error:", error);
    return handleApiError(error);
  }
}
