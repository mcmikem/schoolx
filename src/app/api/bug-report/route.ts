import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/user-provisioning";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }

    const { title, description, page_url, browser_info } = body;

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ success: false, error: "Title and description are required" }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(request.headers.get("Authorization")?.replace("Bearer ", "") || "");

    if (authError || !authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: userProfile } = await supabaseAdmin
      .from("users")
      .select("id, school_id, full_name, role")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (!userProfile) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const { error: insertError } = await supabaseAdmin.from("bug_reports").insert({
      school_id: userProfile.school_id,
      user_id: userProfile.id,
      title: title.trim(),
      description: description.trim(),
      page_url: page_url || null,
      browser_info: browser_info || null,
    });

    if (insertError) {
      logger.error("[bug-report] insert error:", insertError);
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("[bug-report] unexpected error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
