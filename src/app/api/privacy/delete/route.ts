import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const token = authHeader.slice(7);
  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authUser) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = authUser.id;

  try {
    const { success: rlOk } = rateLimit(request, 1, 3_600_000); // 1 per hour
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests. Account deletion can only be requested once per hour." }, { status: 429 });
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("id, role, school_id")
      .eq("auth_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Anonymize the user profile (keep record for audit trail but remove PII)
    await supabaseAdmin
      .from("users")
      .update({
        full_name: "[Deleted]",
        phone: "[Deleted]",
        email: null,
        is_active: false,
      })
      .eq("id", profile.id);

    // If parent: remove parent_students links
    if (profile.role === "parent") {
      await supabaseAdmin
        .from("parent_students")
        .delete()
        .eq("parent_id", profile.id);
    }

    // Delete the auth user (cascades to Supabase auth)
    await supabaseAdmin.auth.admin.deleteUser(userId);

    logger.info(`[privacy/delete] Account deleted for user ${userId}, role: ${profile.role}`);

    return NextResponse.json({
      success: true,
      message: "Your account and personal data have been scheduled for deletion.",
    });
  } catch (error) {
    logger.error("[privacy/delete] Error:", error);
    return NextResponse.json({ error: "Deletion request failed" }, { status: 500 });
  }
}