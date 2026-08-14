// ============================================================================
// 🔒 LOCKED DOWN — AUTH ME API (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Returns user profile + school data for authenticated requests.
// Bypasses RLS via supabaseAdmin (service role).
//
// Last audited: 2026-05-12 | Known pitfalls:
//   - Uses supabaseAdmin — bypasses RLS, must validate auth token manually
//   - Returns 404 if profile not found (triggers sign-out in client)
//   - Response shape: { user: {...}, school: {...} }
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { rateLimit, supabaseClientOptions } from "@/lib/api-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isUsableServiceKey = (key?: string): key is string => Boolean(key && key.length > 20 && !key.startsWith("your-"));

function makeUserScopedClient(authHeader: string): SupabaseClient {
  return createClient(
    supabaseUrl!,
    supabaseAnonKey!,
    supabaseClientOptions({
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${authHeader}` } },
    }),
  );
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success: rlOk } = rateLimit(request, 120, 60_000);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!supabaseUrl || (!isUsableServiceKey(supabaseServiceKey) && !supabaseAnonKey)) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let authUser = null;
  let client: SupabaseClient;
  if (isUsableServiceKey(supabaseServiceKey)) {
    const supabaseAdmin = createClient(
      supabaseUrl!,
      supabaseServiceKey,
      supabaseClientOptions({
        auth: { persistSession: false },
      }),
    );
    const { data, error } = await supabaseAdmin.auth.getUser(authHeader);
    if (!error && data.user) {
      authUser = data.user;
      client = supabaseAdmin;
    } else {
      logger.warn("[API auth/me] Service key token verify failed — retrying with user-scoped RLS client");
      client = makeUserScopedClient(authHeader);
      const retried = await client.auth.getUser(authHeader);
      if (!retried.error && retried.data.user) authUser = retried.data.user;
    }
  } else {
    client = makeUserScopedClient(authHeader);
    const { data, error } = await client.auth.getUser(authHeader);
    if (!error && data.user) authUser = data.user;
  }

  if (!authUser) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Fetch profile from users table using service role (bypasses RLS entirely)
  // Return a limited set of safe fields to avoid leaking sensitive columns.
  // NOTE: the users table (schema.sql) has no updated_at column — referencing it
  // makes PostgREST return 42703 and 500 every account into degraded mode.
  const { data: userData, error: userError } = await client
    .from("users")
    .select(["id", "auth_id", "full_name", "role", "email", "phone", "school_id", "is_active", "created_at"].join(", "))
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (userError) {
    logger.error("[API auth/me] Error fetching user:", userError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!userData) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Fetch school data
  let schoolData = null;
  const user = userData as any;
  if (user && user.school_id) {
    const { data: sd } = await client.from("schools").select("*").eq("id", user.school_id).maybeSingle();
    if (sd) schoolData = sd;
  }

  return NextResponse.json({ user: userData, school: schoolData });
}
