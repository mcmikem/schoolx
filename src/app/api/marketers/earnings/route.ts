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

    let query = supabase
      .from("marketer_earnings")
      .select("*, schools(name, school_code)")
      .order("created_at", { ascending: false });

    if (isMarketer) {
      query = query.eq("marketer_id", profile.id);
    } else if (isSuperAdmin) {
      const marketerId = request.nextUrl.searchParams.get("marketer_id");
      if (marketerId) query = query.eq("marketer_id", marketerId);
    }

    const { data, error } = await query;
    if (error) {
      logger.error("Failed to fetch earnings:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess(data);
  } catch (error) {
    logger.error("GET /api/marketers/earnings error:", error);
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
    if (!body.marketer_id || !body.amount || !body.earning_type) {
      return apiError("Missing required fields: marketer_id, amount, earning_type", 400);
    }

    const { data, error } = await supabase
      .from("marketer_earnings")
      .insert({
        marketer_id: body.marketer_id,
        school_id: body.school_id || null,
        earning_type: body.earning_type,
        amount: body.amount,
        notes: body.notes || null,
        status: body.status || "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create earning record:", error);
      return apiError(error.message, 500);
    }
    return apiSuccess(data);
  } catch (error) {
    logger.error("POST /api/marketers/earnings error:", error);
    return handleApiError(error);
  }
}
