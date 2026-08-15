import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { success: rlOk } = rateLimit(request, 30, 60000);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "20");

    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let query = supabase
      .from("parent_notifications")
      .select("*")
      .eq("parent_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ success: true, notifications: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    logger.error("[Parent Notifications GET] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notification_id, mark_all_read } = body;

    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (mark_all_read) {
      const { error } = await supabase
        .from("parent_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("parent_id", profile.id)
        .eq("is_read", false);

      if (error) {
        if (error.code === "42P01") {
          return NextResponse.json({ success: true, message: "Notifications table not ready yet" });
        }
        throw error;
      }
      return NextResponse.json({ success: true, message: "All marked as read" });
    }

    if (notification_id) {
      const { error } = await supabase
        .from("parent_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notification_id)
        .eq("parent_id", profile.id);

      if (error) {
        if (error.code === "42P01") {
          return NextResponse.json({ success: true, message: "Notifications table not ready yet" });
        }
        throw error;
      }
      return NextResponse.json({ success: true, message: "Marked as read" });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    logger.error("[Parent Notifications PATCH] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
