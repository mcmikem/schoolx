import { normalizeAuthPhone, sanitizePhone } from "./validation";

export type AuthLoginAttempt = {
  type: "email" | "phone";
  value: string;
};

function addAttempt(
  attempts: AuthLoginAttempt[],
  seen: Set<string>,
  type: AuthLoginAttempt["type"],
  value?: string | null,
) {
  const clean = value?.trim();
  if (!clean) return;
  const key = `${type}:${clean.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  attempts.push({ type, value: clean });
}

export function buildAuthEmailFromPhone(phone: string): string {
  return `${normalizeAuthPhone(phone)}@omuto.org`;
}

/**
 * Build prioritized login attempts.
 *
 * CRITICAL: Supabase signInWithPassword is slow (1-3s per call).
 * Previous code tried 8-12 formats sequentially, taking 10-60+ seconds.
 *
 * New strategy:
 * 1. Try the most likely format FIRST (normalized@omuto.org)
 * 2. If that fails with "Invalid login credentials", the credentials
 *    are wrong — stop immediately. No point trying other formats.
 * 3. If it fails with a transient error (network, lock) or "user not found",
 *    try fallback formats.
 * 4. Max 3 attempts total, with smart ordering.
 */
export function buildAuthLoginAttempts(input: string): AuthLoginAttempt[] {
  const attempts: AuthLoginAttempt[] = [];
  const seen = new Set<string>();
  const trimmed = input.trim();

  if (!trimmed) return attempts;

  // If user typed an email, just use it directly
  if (trimmed.includes("@")) {
    addAttempt(attempts, seen, "email", trimmed.toLowerCase());
    return attempts;
  }

  const normalized = normalizeAuthPhone(trimmed);

  // Primary: normalized@omuto.org (covers 99%+ of accounts)
  addAttempt(attempts, seen, "email", `${normalized}@omuto.org`);

  // Secondary: raw input format (for accounts created before phone normalization)
  const rawDigits = trimmed.replace(/\D/g, "");
  let rawWithCountry = rawDigits;
  if (!rawDigits.startsWith("256") && !rawDigits.startsWith("0")) {
    rawWithCountry = "0" + rawDigits;
  } else if (rawDigits.startsWith("256") && rawDigits.length === 12) {
    rawWithCountry = "0" + rawDigits.slice(3);
  }
  // Keep legacy support for accounts created as 0XXXXXXXXX@omuto.org.
  // `trimmed` can itself be the raw local format (e.g. 0777777777), so
  // comparing against trimmed here incorrectly drops a valid fallback.
  if (rawWithCountry !== normalized) {
    addAttempt(attempts, seen, "email", `${rawWithCountry}@omuto.org`);
  }

  // Tertiary: legacy @omuto.sms domain (for old accounts created before migration)
  addAttempt(attempts, seen, "email", `${normalized}@omuto.sms`);

  // Quaternary: phone format fallback (rare, only for very old accounts)
  addAttempt(attempts, seen, "phone", `+${normalized}`);

  return attempts;
}