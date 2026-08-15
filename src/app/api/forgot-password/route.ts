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
import { rateLimitAsync, supabaseClientOptions } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const rateCheck = await rateLimitAsync(request, 3, 15 * 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json({ ok: true });
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
