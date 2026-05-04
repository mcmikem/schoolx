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

    // Find the parent user
    const { data: parentUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("auth_id, id, phone, full_name, role, school_id")
      .eq("phone", normalizedPhone)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (userError || !parentUser?.auth_id) {
      return NextResponse.json({ error: "Parent account not found" }, { status: 404 });
    }

    // Return success — the parent can now use the regular login flow
    // with their phone number (the OTP verified their identity).
    // For now, we return user info and the client will handle session
    // creation via the normal signIn flow.
    return NextResponse.json({
      success: true,
      verified: true,
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