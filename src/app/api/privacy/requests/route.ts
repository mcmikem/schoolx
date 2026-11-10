import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { rateLimitAsync, supabaseClientOptions } from "@/lib/api-utils";

const REQUEST_TYPES = new Set(["access", "correction", "objection", "deletion", "other"]);

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Privacy request storage is not configured");
  return createClient(url, serviceKey, supabaseClientOptions({ auth: { persistSession: false } }));
}

async function getProfile(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 as const };

  const admin = createAdminClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await admin.auth.getUser(authorization.slice(7));
  if (authError || !authUser) return { error: "Invalid session", status: 401 as const };

  const { data: profile, error } = await admin
    .from("users")
    .select("id, school_id, full_name, role")
    .eq("auth_id", authUser.id)
    .maybeSingle();
  if (error || !profile) return { error: "Account profile not found", status: 403 as const };
  return { admin, profile };
}

export async function GET(request: NextRequest) {
  try {
    const result = await getProfile(request);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { data, error } = await result.admin
      .from("privacy_requests")
      .select("reference_code, request_type, status, created_at, updated_at")
      .eq("requester_user_id", result.profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    logger.error("[privacy/requests] Failed to load request status", error);
    return NextResponse.json({ error: "Could not load privacy requests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 12_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const rateLimit = await rateLimitAsync(request, 10, 60 * 60 * 1000);
    if (!rateLimit.success)
      return NextResponse.json({ error: "Please wait before submitting another request." }, { status: 429 });

    const result = await getProfile(request);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const body = (await request.json().catch(() => null)) as { requestType?: unknown; details?: unknown } | null;
    const requestType = typeof body?.requestType === "string" ? body.requestType : "";
    const details = typeof body?.details === "string" ? body.details.trim() : "";
    if (!REQUEST_TYPES.has(requestType))
      return NextResponse.json({ error: "Choose a valid request type." }, { status: 400 });
    if (details.length > 2000)
      return NextResponse.json({ error: "Details must be 2,000 characters or fewer." }, { status: 400 });

    const { data, error } = await result.admin
      .from("privacy_requests")
      .insert({
        requester_user_id: result.profile.id,
        school_id: result.profile.school_id,
        request_type: requestType,
        details,
      })
      .select("reference_code, request_type, status, created_at, updated_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ request: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    logger.error("[privacy/requests] Failed to submit request", error);
    return NextResponse.json({ error: "Could not submit privacy request" }, { status: 500 });
  }
}
