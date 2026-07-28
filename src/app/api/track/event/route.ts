import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceKey) return apiError("Server configuration error", 500);

    const body = await request.json();
    const events: any[] = body.events ? body.events : [body];

    for (const ev of events) {
      if (!ev.event_type || !["page_view", "feature_use", "error", "api_call"].includes(ev.event_type)) {
        return apiError(`Invalid event_type in event: ${ev.event_name || "unknown"}`, 400);
      }
      if (!ev.event_name || typeof ev.event_name !== "string") {
        return apiError("event_name is required", 400);
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string | null = null;
    const authHeader = request.headers.get("authorization")?.replace("Bearer ", "");

    if (authHeader) {
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(authHeader);
      if (user) {
        const { data: profile } = await supabaseAdmin.from("users").select("id").eq("auth_id", user.id).maybeSingle();
        if (profile) userId = profile.id;
      }
    }

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const ua = request.headers.get("user-agent") || null;

    const rows = events.map((ev: any) => ({
      user_id: userId || ev.user_id || null,
      school_id: ev.school_id || null,
      event_type: ev.event_type,
      event_name: ev.event_name,
      metadata: ev.metadata || {},
      url: ev.url || null,
      ip_address: ip,
      user_agent: ua,
    }));

    const { error } = await supabaseAdmin.from("app_events").insert(rows);

    if (error) throw error;

    return apiSuccess({ ok: true, count: rows.length });
  } catch (error) {
    logger.error("[Track Event] Error:", error);
    return handleApiError(error);
  }
}
