import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isAuthenticated = !cronSecret || authHeader === `Bearer ${cronSecret}`;

  // Unauthenticated requests get a basic health check (for Docker/uptime monitoring)
  // Authenticated requests get full diagnostic details
  if (!isAuthenticated) {
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  }

  const checks: Record<string, string> = {};

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes("your-supabase")) {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .limit(1);

      checks.database = error ? "error" : "connected";
    } else {
      checks.database = "not_configured";
    }
  } catch {
    checks.database = "error";
  }

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && !redisUrl.includes("username:password")) {
    checks.redis = "configured";
  } else {
    checks.redis = "not_configured";
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    ...checks,
  });
}
