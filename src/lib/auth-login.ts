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

export function buildAuthLoginAttempts(input: string): AuthLoginAttempt[] {
  const attempts: AuthLoginAttempt[] = [];
  const seen = new Set<string>();
  const trimmed = input.trim();

  if (!trimmed) return attempts;

  if (trimmed.includes("@")) {
    addAttempt(attempts, seen, "email", trimmed.toLowerCase());
    return attempts;
  }

  const digitOnly = sanitizePhone(trimmed).replace(/[^0-9]/g, "");
  const normalized = normalizeAuthPhone(trimmed);
  const localPhone = normalized.startsWith("256") && normalized.length === 12
    ? `0${normalized.slice(3)}`
    : digitOnly.startsWith("0")
      ? digitOnly
      : digitOnly.length === 9
        ? `0${digitOnly}`
        : digitOnly;

  // Accounts are stored as phone@omuto.org emails — try email format first
  // to avoid wasting round-trips on phone attempts that always fail.
  addAttempt(attempts, seen, "email", `${localPhone}@omuto.org`);
  addAttempt(attempts, seen, "email", `${normalized}@omuto.org`);
  addAttempt(attempts, seen, "email", `${digitOnly}@omuto.org`);

  // Phone fallbacks (for legacy accounts stored with phone format)
  addAttempt(attempts, seen, "phone", trimmed);
  addAttempt(attempts, seen, "phone", localPhone);
  addAttempt(attempts, seen, "phone", normalized);
  addAttempt(attempts, seen, "phone", normalized ? `+${normalized}` : null);

  return attempts;
}
