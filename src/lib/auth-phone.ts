export interface UgandaPhoneInfo {
  canonical: string;
  international: string;
  rawDigits: string;
  variants: string[];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function parseUgandaPhone(input: string): UgandaPhoneInfo | null {
  const rawDigits = (input || "").replace(/[^0-9]/g, "");
  if (!rawDigits) return null;

  let canonical = "";
  if (rawDigits.length === 10 && rawDigits.startsWith("0")) {
    canonical = rawDigits;
  } else if (rawDigits.length === 9 && rawDigits.startsWith("7")) {
    canonical = `0${rawDigits}`;
  } else if (rawDigits.length === 12 && rawDigits.startsWith("2567")) {
    canonical = `0${rawDigits.slice(3)}`;
  } else {
    return null;
  }

  const international = `256${canonical.slice(1)}`;
  return {
    canonical,
    international,
    rawDigits,
    variants: unique([canonical, international, rawDigits]),
  };
}

export function isValidUgandaPhone(input: string): boolean {
  return parseUgandaPhone(input) !== null;
}

export function getOmutoAuthEmailCandidates(input: string): string[] {
  const parsed = parseUgandaPhone(input);
  if (!parsed) return [];
  return unique(parsed.variants.map((phone) => `${phone}@omuto.org`));
}

