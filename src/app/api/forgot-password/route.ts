import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Rate-limit: max 3 reset requests per IP per 15 minutes (in-memory, resets on cold start)
const resetAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look up the email derived from the phone number
    const email = `${phone}@omuto.org`;

    // Trigger Supabase password reset email (sends to the auth email)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset-password`,
    });

    // Always return success regardless — prevents user enumeration
    return NextResponse.json({ ok: true });
  } catch {
    // Always return 200 — prevents timing/error enumeration
    return NextResponse.json({ ok: true });
  }
}
