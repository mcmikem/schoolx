// ============================================================================
// 🔒 LOCKED DOWN — OTP SEND API (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Generates and sends OTP via Africa's Talking SMS for parent login.
//
// Last audited: 2026-05-12 | Known pitfalls:
//   - Stores OTP in "otps" table with phone as unique key (upsert)
//   - 5-minute expiry, 6-digit code
//   - Returns success even if phone not found (security: don't leak user existence)
//   - SMS delivery failures never return the OTP to the caller
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { rateLimitAsync, supabaseClientOptions } from "@/lib/api-utils";
import { sendAfricasTalkingSMSWithRetry, formatUgandaPhone } from "@/lib/africas-talking";
import { normalizeAuthPhone } from "@/lib/validation";
import { buildPhoneLookupCandidates } from "@/lib/auth-phone";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const OTP_EXPIRY_MINUTES = 5;
const OTP_LENGTH = 6;

function generateOtp(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

export async function POST(request: NextRequest) {
  try {
    const rateCheck = await rateLimitAsync(request, 5, 300000);
    if (!rateCheck.success) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const body = await request.json();
    const phone = typeof body?.phone === "string" ? body.phone : "";
    const schoolId = typeof body?.schoolId === "string" ? body.schoolId : undefined;
    if (!phone || phone.length > 32) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      supabaseClientOptions({
        auth: { persistSession: false },
      }),
    );

    // Find parent user by phone in any stored format. Production `users.phone`
    // rows use several spellings (256XXXXXXXXX, +256…, 0XXXXXXXXX, and a few
    // 13-char variants) — a single `.eq("phone", …)` silently missed registered
    // parents and returned the fake success with no SMS. Two-stage lookup:
    //   (a) exact format variants (canonical normalized + 0-led + 256-led)
    //   (b) suffix fallback on the trailing 9-digit local part
    // The route itself normalizes now, so it no longer depends on the client
    // having pre-normalized the number. Normalization is authoritative:
    // canonical key 256XXXXXXXXX, matching 153/158 of parent rows.
    const normalizedPhone = normalizeAuthPhone(String(phone));
    if (normalizedPhone.length < 9 || normalizedPhone.length > 16) {
      return NextResponse.json({ success: true, message: "If this phone is registered, an OTP has been sent." });
    }
    const phoneCandidates = buildPhoneLookupCandidates(String(phone));

    // (a) Exact-format variants
    let parentQuery = supabaseAdmin
      .from("users")
      .select("id, phone, full_name, role, school_id")
      .in("phone", phoneCandidates.length ? phoneCandidates : [String(phone)])
      .ilike("role", "parent")
      .eq("is_active", true);
    if (schoolId) parentQuery = parentQuery.eq("school_id", schoolId);
    let { data: parentMatches, error: userError } = await parentQuery.limit(2);

    // (b) Irregular stored formats (e.g. "+256…", "2560XXXXXXXXX") that none of
    // the exact variants spell — match the trailing 9-digit local part instead.
    if (!userError && parentMatches?.length === 0) {
      const lastNine = normalizedPhone.replace(/\D/g, "").slice(-9);
      if (lastNine.length === 9) {
        let suffixQuery = supabaseAdmin
          .from("users")
          .select("id, phone, full_name, role, school_id")
          .like("phone", `%${lastNine}`)
          .ilike("role", "parent")
          .eq("is_active", true);
        if (schoolId) suffixQuery = suffixQuery.eq("school_id", schoolId);
        ({ data: parentMatches, error: userError } = await suffixQuery.limit(2));
      }
    }

    if (userError || !parentMatches || parentMatches.length !== 1) {
      // Don't reveal whether the phone exists — return success anyway
      logger.info(`[OTP] No unambiguous parent found for phone ${normalizedPhone.slice(-4)}`);
      return NextResponse.json({ success: true, message: "If this phone is registered, an OTP has been sent." });
    }
    const parentUser = parentMatches[0];

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
        // Never return an authentication factor in an API response. A missing
        // SMS configuration must fail closed, including in development.
        logger.warn("[OTP] SMS provider is not configured; refusing to expose a demo code");
        return NextResponse.json(
          { success: false, message: "OTP delivery is temporarily unavailable. Please use password sign-in." },
          { status: 503 },
        );
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
