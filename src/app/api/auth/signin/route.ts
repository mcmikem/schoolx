// ============================================================================
// 🔒 AUTH SIGN-IN API — resolves the account, then signs in (ONE round trip)
// ============================================================================
// The user types a phone number. The number IS the identity. This route
// works out which Supabase account that number belongs to and signs in,
// so the phone travels once over a slow link instead of once per format the
// client guessed wrong.
//
// Why it exists:
//   - Accounts were created as `256XXXXXXXXX@omuto.org`, a few legacy ones
//     as `0777777777@omuto.org` or `@omuto.sms`, and 162 of them also carry a
//     phone identity. The client cannot know which, so it guessed -- one
//     round trip per guess, and on a slow phone the guesses timed out one
//     after another until the sign-in failed after half a minute.
//   - The server can look the number up (public.users) and read the real
//     auth identity, so one request is enough.
//
// Security:
//   - The password is used to sign in and is NEVER logged or stored.
//   - A wrong password and an unknown number return the same 401 and the
//     same message, so this route cannot be used to find out who is
//     registered.
//   - Rate limited per IP.
//   - The service role key is only used to READ the account; the sign-in
//     itself is done with the publishable key, exactly as the client would.
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiError, apiSuccess, rateLimit, supabaseClientOptions } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { normalizeAuthPhone } from "@/lib/validation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isUsableServiceKey = (key?: string): key is string => Boolean(key && key.length > 20 && !key.startsWith("your-"));

/** Sign-in attempts allowed per IP per five minutes. A school shares one
 *  address behind mobile data, so this is a brake on guessing, not a quota
 *  on staff. */
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 300000;

/**
 * Every identity a typed number could belong to, most likely first.
 *
 * The profile lookup finds the account for almost everyone. These are the
 * fallbacks for accounts that have no profile row yet, and they are tried
 * in the background rather than one at a time.
 */
function candidateEmails(identifier: string): string[] {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) return [trimmed.toLowerCase()];

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return [];

  const normalized = normalizeAuthPhone(trimmed);
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  const out = new Set<string>();
  // The way almost every account was created.
  if (normalized) out.add(`${normalized}@omuto.org`);
  // The way the account was created when the number was typed with its
  // leading zero.
  if (digits) out.add(`${digits}@omuto.org`);
  if (local && local !== digits) out.add(`${local}@omuto.org`);
  // The legacy domain for accounts created before the @omuto.org migration.
  if (normalized) out.add(`${normalized}@omuto.sms`);
  return [...out];
}

/**
 * Sign in against Supabase Auth over plain HTTP.
 *
 * The SDK is not used here on purpose: `signInWithPassword` sets up a realtime
 * connection, and the realtime package is aliased to a stub that throws. The
 * stub's error killed the response mid-flight, so the sign-in "succeeded" and
 * returned nothing. This is the same request the SDK makes.
 */
async function signInWithEmail(email: string, password: string) {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user?: { user_metadata?: { role?: string } };
      msg?: string;
      error_description?: string;
    };
    if (!res.ok || !body.access_token) {
      return {
        session: null,
        error: { message: body.msg || body.error_description || "Sign-in failed" },
      };
    }
    return {
      session: {
        access_token: body.access_token,
        refresh_token: body.refresh_token ?? "",
        expires_in: body.expires_in ?? 3600,
        role: body.user?.user_metadata?.role ?? "admin",
      },
      error: null,
    };
  } catch (e) {
    return { session: null, error: { message: e instanceof Error ? e.message : "Sign-in failed" } };
  }
}

/**
 * The identity the school's own records say this number belongs to.
 *
 * The profile keeps the auth user's real email, which is the only place the
 * truth lives: a legacy account created as `0777777777@omuto.org` has a
 * normalised phone and a raw-local email, and no amount of guessing from the
 * number alone gets that right.
 */
async function lookupProfileEmail(identifier: string): Promise<string | null> {
  if (!isUsableServiceKey(supabaseServiceKey)) return null;
  try {
    const admin = createClient(
      supabaseUrl!,
      supabaseServiceKey,
      supabaseClientOptions({ auth: { persistSession: false, autoRefreshToken: false } }),
    );
    const digits = identifier.replace(/\D/g, "");
    const normalized = normalizeAuthPhone(identifier);
    const phoneCandidates = [normalized, digits, digits.startsWith("0") ? digits.slice(1) : `0${digits}`].filter(
      (v): v is string => Boolean(v),
    );
    if (phoneCandidates.length === 0) return null;

    const { data: profiles } = await admin.from("users").select("email, auth_id").in("phone", phoneCandidates).limit(1);
    const profile = profiles?.[0];
    if (profile?.email) return String(profile.email).toLowerCase();

    // No email on the profile: ask the auth user directly.
    if (profile?.auth_id) {
      const { data: authUser } = await admin.auth.admin.getUserById(profile.auth_id);
      const authEmail = authUser?.user?.email;
      if (authEmail) return authEmail.toLowerCase();
    }
    return null;
  } catch (e) {
    // A lookup failure must not stop the sign-in: the candidate list covers
    // every account we know how to address.
    logger.warn("[Auth sign-in] Account lookup failed, falling back to candidate identities", e);
    return null;
  }
}

function sessionResponse(session: { access_token: string; refresh_token: string; expires_in: number; role: string }) {
  return apiSuccess({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    role: session.role,
  });
}

export async function POST(request: NextRequest) {
  const { success: rlOk } = rateLimit(request, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rlOk) {
    return apiError("Too many sign-in attempts. Please wait a few minutes and try again.", 429);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return apiError("Server configuration error", 500);
  }

  let identifier = "";
  let password = "";
  try {
    const body = (await request.json()) as { identifier?: unknown; password?: unknown };
    identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return apiError("Invalid request", 400);
  }

  if (!identifier || !password) {
    return apiError("Enter your phone number and password", 400);
  }
  if (password.length < 6) {
    return apiError("Enter your phone number and password", 400);
  }

  const candidates = candidateEmails(identifier);
  if (candidates.length === 0) {
    return apiError("Invalid phone number or password", 401);
  }

  // Every shape this number could have been registered under is tried AT THE
  // SAME TIME, so the sign-in costs the phone one round trip instead of one
  // per guess. These are server-to-server calls over a fast link.
  const firstPass = await Promise.all(candidates.map((email) => signInWithEmail(email, password)));
  const hit = firstPass.find((r) => r.session);
  if (hit?.session) {
    return sessionResponse(hit.session);
  }

  // None of the obvious shapes worked. The school's own records know the
  // account -- the profile keeps the auth user's real email, which is the
  // only place the truth lives for an account created in an unusual way.
  const profileEmail = await lookupProfileEmail(identifier);
  if (profileEmail && !candidates.includes(profileEmail)) {
    const viaProfile = await signInWithEmail(profileEmail, password);
    if (viaProfile.session) {
      return sessionResponse(viaProfile.session);
    }
  }

  // A rate limit from Supabase is worth saying out loud: it is not a wrong
  // password, and telling the user otherwise sends them into a loop.
  const messages = firstPass.map((r) => r.error?.message ?? "");
  if (messages.some((m) => /rate limit|too many|security purposes/i.test(m))) {
    return apiError("Too many sign-in attempts. Please wait a minute and try again.", 429);
  }
  if (messages.some((m) => /timeout|timed out|fetch failed|network/i.test(m))) {
    return apiError("Could not reach the server. Check your connection and try again.", 503);
  }

  // Wrong password and unknown number look the same from outside, on purpose.
  return apiError("Invalid phone number or password", 401);
}
