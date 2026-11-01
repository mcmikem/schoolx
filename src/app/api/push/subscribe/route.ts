import { NextRequest } from "next/server";
import { apiSuccess, apiError, requireUserWithSchool } from "@/lib/api-utils";
import { createClient } from "@supabase/supabase-js";
import { supabaseClientOptions } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { userId, subscription } = body;

    if (!subscription?.endpoint) {
      return apiError("subscription.endpoint required", 400);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, supabaseClientOptions({ auth: { persistSession: false } }));

    await supabase
      .from("push_subscriptions")
      .upsert({ user_id: userId, endpoint: subscription.endpoint, keys: subscription.keys }, { onConflict: "user_id" });

    return apiSuccess({ saved: true }, "Subscription saved");
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Failed", 500);
  }
}
