import { normalizeAuthPhone } from "./validation";

export function buildPhoneLookupCandidates(rawPhone: unknown): string[] {
  if (typeof rawPhone !== "string" || !rawPhone.trim()) return [];

  const normalized = normalizeAuthPhone(rawPhone);
  const digits = normalized.replace(/\D/g, "");
  const candidates = new Set<string>();

  if (normalized) candidates.add(normalized);
  if (digits.length === 9) {
    candidates.add(`0${digits}`);
    candidates.add(`256${digits}`);
  }
  if (digits.startsWith("0") && digits.length === 10) {
    candidates.add(`256${digits.slice(1)}`);
  }
  if (digits.startsWith("256") && digits.length === 12) {
    candidates.add(`0${digits.slice(3)}`);
  }

  return Array.from(candidates);
}
