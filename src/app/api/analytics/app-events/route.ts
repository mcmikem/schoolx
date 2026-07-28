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
    const view = searchParams.get("view") || "summary";

    if (view === "errors") {
      const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
      const { data, error } = await supabaseAdmin
        .from("app_events")
        .select("*, users(full_name, phone)")
        .eq("event_type", "error")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return apiSuccess({ events: data || [] });
    }

    if (view === "usage") {
      const range = searchParams.get("range") || "24h";
      const since =
        range === "7d"
          ? new Date(Date.now() - 7 * 86400000).toISOString()
          : range === "30d"
            ? new Date(Date.now() - 30 * 86400000).toISOString()
            : new Date(Date.now() - 86400000).toISOString();

      const { data, error } = await supabaseAdmin
        .from("app_events")
        .select("event_type, event_name, created_at, school_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return apiSuccess({ events: data || [], range });
    }

    const { data, error } = await supabaseAdmin
      .from("app_events")
      .select("event_type, event_name, school_id, created_at");

    if (error && (error as any).code !== "42P01") throw error;

    const summary = {
      totalEvents: data?.length || 0,
      pageViews: data?.filter((e: any) => e.event_type === "page_view").length || 0,
      errors: data?.filter((e: any) => e.event_type === "error").length || 0,
      featureUses: data?.filter((e: any) => e.event_type === "feature_use").length || 0,
      uniqueSchools: new Set(data?.map((e: any) => e.school_id).filter(Boolean)).size || 0,
      topPages: [] as { name: string; count: number }[],
      topFeatures: [] as { name: string; count: number }[],
      recentErrors: [] as any[],
    };

    const pageCounts: Record<string, number> = {};
    const featureCounts: Record<string, number> = {};
    const recentErrors: any[] = [];

    for (const e of data || []) {
      if (e.event_type === "page_view") {
        pageCounts[e.event_name] = (pageCounts[e.event_name] || 0) + 1;
      }
      if (e.event_type === "feature_use") {
        featureCounts[e.event_name] = (featureCounts[e.event_name] || 0) + 1;
      }
      if (e.event_type === "error" && recentErrors.length < 20) {
        recentErrors.push(e);
      }
    }

    summary.topPages = Object.entries(pageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    summary.topFeatures = Object.entries(featureCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    summary.recentErrors = recentErrors;

    return apiSuccess(summary);
  } catch (error) {
    logger.error("[App Events API] Error:", error);
    return handleApiError(error);
  }
}
