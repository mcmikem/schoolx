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

    if (!profile) return apiError("Forbidden", 403);

    const isSuperAdmin = profile.role === "super_admin";
    const isMarketer = profile.role === "marketer";
    if (!isSuperAdmin && !isMarketer) return apiError("Forbidden", 403);

    let query = supabase.from("marketer_payouts").select("*").order("created_at", { ascending: false });

    if (isMarketer) {
      query = query.eq("marketer_id", profile.id);
    }

    const { data, error } = await query;
    if (error) {
      logger.error("Failed to fetch payouts:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess(data);
  } catch (error) {
    logger.error("GET /api/marketers/payouts error:", error);
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
      .select("role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || profile.role !== "super_admin") return apiError("Forbidden", 403);

    const body = await request.json();
    const amount = Number(body?.amount);
    if (
      typeof body?.marketer_id !== "string" ||
      !body.marketer_id ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 9_999_999_999.99
    ) {
      return apiError("Missing required fields: marketer_id, amount", 400);
    }

    const { data: marketer } = await supabase.from("users").select("id, role").eq("id", body.marketer_id).maybeSingle();
    if (!marketer || marketer.role !== "marketer") return apiError("Marketer not found", 404);

    const { data, error } = await supabase
      .from("marketer_payouts")
      .insert({
        marketer_id: marketer.id,
        amount,
        notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create payout:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess(data);
  } catch (error) {
    logger.error("POST /api/marketers/payouts error:", error);
    return handleApiError(error);
  }
}
