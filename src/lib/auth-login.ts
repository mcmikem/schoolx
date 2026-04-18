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

  addAttempt(attempts, seen, "phone", trimmed);
  addAttempt(attempts, seen, "phone", localPhone);
  addAttempt(attempts, seen, "phone", normalized);
  addAttempt(attempts, seen, "phone", normalized ? `+${normalized}` : null);

  addAttempt(attempts, seen, "email", `${localPhone}@omuto.org`);
  addAttempt(attempts, seen, "email", `${digitOnly}@omuto.org`);
  addAttempt(attempts, seen, "email", `${normalized}@omuto.org`);

  return attempts;
}
