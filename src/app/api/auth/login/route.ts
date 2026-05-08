import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/api-utils";
import { buildAuthLoginAttempts } from "@/lib/auth-login";
import { normalizeAuthPhone, isValidEmail } from "@/lib/validation";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { success: rlOk, resetTime } = rateLimit(request, 10, 60000);
    if (!rlOk) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const body = await request.json();
    const { identifier, password } = body as {
      identifier: string;
      password: string;
    };

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Phone/email and password are required" },
        { status: 400 },
      );
    }

    const trimmed = identifier.trim();
    const isEmailLogin = trimmed.includes("@");

    if (isEmailLogin && !isValidEmail(trimmed.toLowerCase())) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    if (!isEmailLogin) {
      const clean = normalizeAuthPhone(trimmed);
      if (clean.length < 10 || clean.length > 12) {
        return NextResponse.json(
          { error: "Invalid phone number format" },
          { status: 400 },
        );
      }
    }

    const normalizedIdentifier = isEmailLogin
      ? trimmed.toLowerCase()
      : normalizeAuthPhone(trimmed);

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const attempts = buildAuthLoginAttempts(normalizedIdentifier);

    let lastError: unknown = null;

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const { data, error } = await supabase.auth.signInWithPassword(
        attempt.type === "email"
          ? { email: attempt.value, password }
          : { phone: attempt.value, password },
      );

      if (!error) {
        if (!data.user) {
          continue;
        }
        return NextResponse.json({
          success: true,
          user: data.user,
          session: data.session,
        });
      }

      lastError = error;
      const errMsg = (error.message || "").toLowerCase();

      if (
        errMsg.includes("wrong password") ||
        errMsg.includes("incorrect password")
      ) {
        break;
      }
    }

    const msg = lastError instanceof Error ? lastError.message : "Login failed";
    return NextResponse.json({ error: msg }, { status: 401 });
  } catch (error) {
    logger.error("[Login API] Error:", error);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}