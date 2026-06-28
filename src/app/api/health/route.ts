import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isAuthenticated = !cronSecret || authHeader === `Bearer ${cronSecret}`;

  if (!isAuthenticated) {
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  }

  const checks: Record<string, string | { read: string; write: string }> = {};
  const details: Record<string, unknown> = {};

  // --- Database health (read & write) ---
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes("your-supabase")) {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error: readError, count } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .limit(1);

      const readOk = !readError;

      const { error: writeError } = await supabase
        .from("rate_limit_log")
        .insert({ key: "__health_check__", created_at: new Date().toISOString() });

      if (!writeError) {
        await supabase
          .from("rate_limit_log")
          .delete()
          .eq("key", "__health_check__");
      }

      checks.database = {
        read: readOk ? "ok" : "error",
        write: writeError ? "error" : "ok",
      };
      if (count !== null) details.totalUsers = count;
    } else {
      checks.database = "not_configured";
    }
  } catch (e) {
    checks.database = { read: "error", write: "error" };
    details.dbError = e instanceof Error ? e.message : String(e);
  }

  // --- Redis (env check only — full check requires ioredis) ---
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && !redisUrl.includes("username:password")) {
    checks.redis = "configured";
  } else {
    checks.redis = "not_configured";
  }

  // --- Memory ---
  if (typeof process.memoryUsage === "function") {
    const mem = process.memoryUsage();
    details.memory = {
      rss: `${Math.round(mem.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
    };
  }

  // --- Env integrity ---
  const envChecks: Record<string, boolean> = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
  };
  details.env = envChecks;

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    ...checks,
    ...details,
  });
}
