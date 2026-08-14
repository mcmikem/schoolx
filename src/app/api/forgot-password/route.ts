// ============================================================================
// 🔒 LOCKED DOWN — FORGOT PASSWORD API (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Sends password reset email via Supabase. Rate limited to prevent abuse.
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { supabaseClientOptions } from "@/lib/api-utils";

// In-memory rate limiter — does not persist across serverless instances.
// For production, replace with Redis or Supabase-based rate limiting.
const resetAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();
    const window = 15 * 60 * 1000; // 15 minutes
    const limit = 3;

    const entry = resetAttempts.get(ip);
    if (entry && now < entry.resetAt) {
      if (entry.count >= limit) {
        // Return 200 to avoid enumeration — don't reveal rate limiting to caller
        return NextResponse.json({ ok: true });
      }
      entry.count++;
    } else {
      resetAttempts.set(ip, { count: 1, resetAt: now + window });
    }

    const body = await request.json();
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

    if (!phone) {
      return NextResponse.json({ ok: true }); // silent fail — no enumeration
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      supabaseClientOptions({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );

    // Look up the email derived from the phone number
    const email = `${phone}@omuto.org`;

    // Build redirect URL with fallback
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const redirectUrl = appUrl
      ? `${appUrl}/reset-password`
      : `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""}/reset-password`;

    // Trigger Supabase password reset email (sends to the auth email)
    const resetOpts: { redirectTo?: string } = {};
    if (redirectUrl) {
      resetOpts.redirectTo = redirectUrl;
    }
    await supabase.auth.resetPasswordForEmail(email, resetOpts);

    // Always return success regardless — prevents user enumeration
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[ForgotPassword] Error:", err);
    // Always return 200 — prevents timing/error enumeration
    return NextResponse.json({ ok: true });
  }
}
