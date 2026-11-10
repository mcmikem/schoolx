import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError, rateLimitAsync, supabaseClientOptions } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { sanitizeTelemetryEvents } from "@/lib/telemetry-sanitizer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceKey) return apiError("Server configuration error", 500);
    const { success: withinLimit } = await rateLimitAsync(request, 30, 60_000);
    if (!withinLimit) return apiError("Too many telemetry requests", 429);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 50_000) return apiError("Telemetry payload is too large", 413);
    const rawText = await request.text();
    if (new TextEncoder().encode(rawText).byteLength > 50_000) return apiError("Telemetry payload is too large", 413);
    const rawBody = JSON.parse(rawText);
    const events = sanitizeTelemetryEvents(rawBody);
    if (!events) return apiError("Invalid telemetry payload", 400);

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      supabaseClientOptions({ auth: { autoRefreshToken: false, persistSession: false } }),
    );

    let userId: string | null = null;
    let schoolId: string | null = null;
    const authorization = request.headers.get("authorization") || "";
    if (authorization.startsWith("Bearer ")) {
      const {
        data: { user },
        error: authError,
      } = await supabaseAdmin.auth.getUser(authorization.slice(7));
      if (!authError && user) {
        const { data: profile } = await supabaseAdmin
          .from("users")
          .select("id, school_id")
          .eq("auth_id", user.id)
          .maybeSingle();
        if (profile) {
          userId = profile.id;
          schoolId = profile.school_id || null;
        }
      }
    }

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const ua = (request.headers.get("user-agent") || "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 500) || null;
    const rows = events.map((event) => ({
      user_id: userId,
      school_id: schoolId,
      event_type: event.event_type,
      event_name: event.event_name,
      metadata: {},
      url: event.url,
      ip_address: ip?.slice(0, 100) || null,
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
