import { NextRequest } from "next/server";
import { createServiceRoleClientOrThrow, apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

// Track a referral click (public — no auth required)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const supabase = createServiceRoleClientOrThrow();
    const { code } = await params;

    const { data: referral, error } = await supabase
      .from("marketer_referral_codes")
      .select("id, code, clicks, is_active")
      .eq("code", code.toUpperCase())
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
    return Response.redirect(new URL(`/register?ref=${code}`, _request.url), 307);
  } catch (error) {
    logger.error("GET /api/marketers/referrals/[code] error:", error);
    return handleApiError(error);
  }
}
