// ============================================================================
// 🔒 LOCKED DOWN — FORGOT PASSWORD API (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Sends password reset email via Supabase. Rate limited to prevent abuse.
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { rateLimitAsync, supabaseClientOptions } from "@/lib/api-utils";
import { buildPhoneLookupCandidates } from "@/lib/auth-phone";
import { logger } from "@/lib/logger";
import { normalizeAuthPhone } from "@/lib/validation";

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

    // Resolve the account's REAL auth email. Hardcoding `${phone}@omuto.org`
    // only matched accounts created from the 256… format; legacy 0…@omuto.org
    // and @omuto.sms accounts silently never received the mail. The profile
    // holds the auth_id, and the admin API maps that to the login identity.
    const candidates = buildPhoneLookupCandidates(phone);
    const lookup = candidates.length > 0 ? candidates : [phone];
    let email = "";
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("auth_id, email")
        .in("phone", lookup)
        .limit(1)
        .maybeSingle();

      // The auth identity is authoritative: users.email holds whatever the
      // person typed at registration, which is not always the login identity.
      if (profile?.auth_id) {
        const { data } = await supabase.auth.admin.getUserById(profile.auth_id);
        email = data?.user?.email ?? "";
      }
      if (!email && profile?.email) {
        email = profile.email;
      }
    } catch (err) {
      logger.warn("[ForgotPassword] profile lookup failed, falling back to derived email:", err);
    }

    // Fallback for an account with no profile row yet: the canonical
    // registration identity is the 12-digit number.
    if (!email) email = `${normalizeAuthPhone(phone) || phone}@omuto.org`;

    // Build redirect URL with fallback. trailingSlash is on, so the canonical
    // path is /reset-password/ and the query Supabase appends survives.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const redirectUrl = appUrl
      ? `${appUrl.replace(/\/$/, "")}/reset-password/`
      : `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""}/reset-password/`;

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
