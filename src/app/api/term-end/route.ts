import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      { auth: { persistSession: false } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role, school_id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile || !["school_admin", "headmaster", "admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Enforce school-scope: non-super_admins can only trigger term-end for their own school
    if (profile.role !== "super_admin" && profile.school_id && body.schoolId !== profile.school_id) {
      return NextResponse.json({ error: "Forbidden: school scope mismatch" }, { status: 403 });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const origin = request.nextUrl.origin;
    const upstream = await fetch(`${origin}/api/automation/term-end/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    logger.error("[term-end-proxy] Error:", error);
    return NextResponse.json({ error: "Failed to process term end" }, { status: 500 });
  }
}
