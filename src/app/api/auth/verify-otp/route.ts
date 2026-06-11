// ============================================================================
// 🔒 LOCKED DOWN — OTP VERIFY API (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Verifies OTP code and generates magic link token for session establishment.
//
// Last audited: 2026-05-12 | Known pitfalls:
//   - Returns { token, email } — client must use verifyOtp({ email, token, type: "magiclink" })
//   - Uses generateLink (NOT signInWithOtp) to create session without password
//   - Token extracted from action_link URL via regex
//   - Marks OTP as used after verification
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const { phone, otp } = await request.json();
    if (!phone || !otp) {
      return NextResponse.json({ error: "Phone and OTP required" }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const normalizedPhone = phone.replace(/[^0-9+]/g, "");

    // Look up OTP
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from("otps")
      .select("id, code, expires_at, used")
      .eq("phone", normalizedPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 401 });
    }

    if (otpRecord.used) {
      return NextResponse.json({ error: "OTP already used. Please request a new one." }, { status: 401 });
    }

    if (otpRecord.code !== otp) {
      return NextResponse.json({ error: "Incorrect OTP. Please try again." }, { status: 401 });
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: "OTP expired. Please request a new one." }, { status: 401 });
    }

    // Mark OTP as used
    await supabaseAdmin
      .from("otps")
      .update({ used: true })
      .eq("id", otpRecord.id);

    // Find the parent user (include email for magic link generation)
    const { data: parentUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("auth_id, id, phone, email, full_name, role, school_id")
      .eq("phone", normalizedPhone)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (userError || !parentUser?.auth_id) {
      return NextResponse.json({ error: "Parent account not found" }, { status: 404 });
    }

    // Generate a magic link so the client can establish a session without
    // knowing the user's password. The magic link token is single-use and
    // time-limited, making this secure.
    const authEmail = parentUser.email || `${normalizedPhone}@omuto.org`;
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
      options: { redirectTo: `${request.nextUrl.origin}/parent-portal` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      logger.error("[verify-otp] Failed to generate magic link:", linkError);
      return NextResponse.json({ error: "Unable to create login session. Please try password login." }, { status: 500 });
    }

    // Extract the token from the action link URL
    const actionLink = linkData.properties.action_link;
    const tokenMatch = actionLink.match(/[?&]token=([^&]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
      return NextResponse.json({ error: "Unable to create login session. Please try password login." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      token,
      tokenType: "magiclink",
      email: authEmail,
      user: {
        id: parentUser.id,
        auth_id: parentUser.auth_id,
        full_name: parentUser.full_name,
        phone: parentUser.phone,
        role: parentUser.role,
        school_id: parentUser.school_id,
      },
    });
  } catch (error) {
    logger.error("[verify-otp] Error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}