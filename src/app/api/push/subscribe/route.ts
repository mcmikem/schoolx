import { NextRequest } from "next/server";
import { apiSuccess, apiError, requireUserWithSchool, rateLimit } from "@/lib/api-utils";
import { createClient } from "@supabase/supabase-js";
import { supabaseClientOptions } from "@/lib/api-utils";
import { isAllowedWebPushEndpoint, isValidWebPushKeys } from "@/lib/push-security";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    if (!rateLimit(request, 30, 60_000).success) return apiError("Too many push subscription requests", 429);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10_000) return apiError("Push subscription payload is too large", 413);

    const body = await request.json().catch(() => null);
    const subscription = body && typeof body === "object" ? body.subscription : null;

    if (!isAllowedWebPushEndpoint(subscription?.endpoint)) {
      return apiError("A supported HTTPS push endpoint is required", 400);
    }
    if (!isValidWebPushKeys(subscription?.keys)) return apiError("Invalid push subscription keys", 400);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, supabaseClientOptions({ auth: { persistSession: false } }));

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: auth.context.user.id,
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      },
      { onConflict: "user_id" },
    );

    if (error) return apiError("Could not save push subscription", 500);

    return apiSuccess({ saved: true }, "Subscription saved");
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Failed", 500);
  }
}
