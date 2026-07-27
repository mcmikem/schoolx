import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError, requireAuthenticatedUser } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    if (!supabaseServiceKey) return apiError("Server configuration error", 500);

    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || profile.role !== "super_admin") {
      return apiError("Forbidden", 403);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const offset = Number(searchParams.get("offset")) || 0;
    const module = searchParams.get("module");

    let query = supabaseAdmin
      .from("audit_log")
      .select("*, schools(name), users(full_name)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (module) {
      query = query.eq("module", module);
    }

    const { data, error, count } = await query;

    if (error) {
      if ((error as any).code === "42P01") {
        return apiSuccess({ logs: [], total: 0 }, "Audit log table not available");
      }
      throw error;
    }

    return apiSuccess({ logs: data || [], total: count || 0 });
  } catch (error) {
    logger.error("[Audit API] Error:", error);
    return handleApiError(error);
  }
}
