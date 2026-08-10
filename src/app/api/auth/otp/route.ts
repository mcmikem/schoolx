// ============================================================================
// 🔒 LOCKED DOWN — OTP SEND API (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Generates and sends OTP via Africa's Talking SMS for parent login.
//
// Last audited: 2026-05-12 | Known pitfalls:
//   - Stores OTP in "otps" table with phone as unique key (upsert)
//   - 5-minute expiry, 6-digit code
//   - Returns success even if phone not found (security: don't leak user existence)
//   - Demo mode: returns OTP in response if AFRICAS_TALKING_API_KEY not set
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { rateLimitAsync } from "@/lib/api-utils";
import { sendAfricasTalkingSMSWithRetry, formatUgandaPhone } from "@/lib/africas-talking";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const OTP_EXPIRY_MINUTES = 5;
const OTP_LENGTH = 6;

function generateOtp(): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

export async function POST(request: NextRequest) {
  try {
    const rateCheck = await rateLimitAsync(request, 5, 300000);
    if (!rateCheck.success) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const { phone, schoolId } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Find parent user by phone
    const normalizedPhone = phone.replace(/[^0-9+]/g, "");
    const { data: parentUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, phone, full_name, role, school_id")
      .eq("phone", normalizedPhone)
      .ilike("role", "parent")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (userError || !parentUser) {
      // Don't reveal whether the phone exists — return success anyway
      logger.info(`[OTP] No parent found for phone ${normalizedPhone.slice(-4)}`);
      return NextResponse.json({ success: true, message: "If this phone is registered, an OTP has been sent." });
    }

    // If schoolId provided, verify match
    if (schoolId && parentUser.school_id !== schoolId) {
      logger.info(`[OTP] Phone ${normalizedPhone.slice(-4)} belongs to different school`);
      return NextResponse.json({ success: true, message: "If this phone is registered, an OTP has been sent." });
    }

    // Generate OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Store OTP in the parent's user metadata via auth
    // We use a simple approach: store in a "otps" table
    const { error: upsertError } = await supabaseAdmin.from("otps").upsert(
      {
        phone: normalizedPhone,
        code: otp,
        expires_at: expiresAt,
        used: false,
        created_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    );

    if (upsertError) {
      logger.error("[OTP] Failed to store OTP:", upsertError);
      return NextResponse.json(
        { success: false, message: "Unable to send OTP right now. Please try again later." },
        { status: 500 },
      );
    }

    // Send OTP via SMS
    const schoolName = "SkoolMate";
    try {
      const formattedPhone = formatUgandaPhone(normalizedPhone);
      const smsMessage = `Your SkoolMate verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;
      const smsResult = await sendAfricasTalkingSMSWithRetry(formattedPhone, smsMessage, { formatUgandaNumber: true });

      if (smsResult.demo) {
        // Dev-only demo gateway (no API key): return the OTP so testing can proceed.
        logger.info(`[OTP] Demo SMS (no gateway) — OTP for ${normalizedPhone.slice(-4)}`);
        return NextResponse.json({
          success: true,
          message: "OTP generated (demo mode — check console)",
          demoOtp: otp,
        });
      }

      if (!smsResult.success) {
        logger.error(`[OTP] SMS send failed: ${smsResult.error}`);
        // Don't reveal whether the phone exists — but do surface a generic failure.
        return NextResponse.json(
          { success: false, message: "Unable to send OTP right now. Please try again later." },
          { status: 500 },
        );
      }

      logger.info(`[OTP] Sent OTP to ${normalizedPhone.slice(-4)}`);
    } catch (smsError) {
      logger.error("[OTP] SMS send failed:", smsError);
      // In demo mode (no SMS config), return OTP directly for testing
      if (process.env.NODE_ENV === "development" && !process.env.AFRICAS_TALKING_API_KEY) {
        return NextResponse.json({
          success: true,
          message: "OTP generated (demo mode — check console)",
          demoOtp: otp,
        });
      }
      return NextResponse.json(
        { success: false, message: "Unable to send OTP right now. Please try again later." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: "If this phone is registered, an OTP has been sent." });
  } catch (error) {
    logger.error("[OTP] Error:", error);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
