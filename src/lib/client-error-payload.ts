/**
 * Shape + sanitisation for the public client-error beacon.
 *
 * Kept dependency-free so both the route (server) and the reporter (browser)
 * can import it. Everything is capped: this endpoint is unauthenticated and
 * must never be able to grow a row without bound.
 */

export interface ClientErrorPayload {
  message: string;
  stack?: string;
  url?: string;
  ua?: string;
  digest?: string;
  source?: string;
}

export interface SanitisedClientError {
  message: string;
  stack: string | null;
  url: string | null;
  ua: string | null;
  digest: string | null;
  source: string | null;
}

const LIMITS = {
  message: 500,
  stack: 4000,
  url: 400,
  ua: 500,
  digest: 120,
  source: 80,
} as const;

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  // Strip control characters (except tab/newline) so a hostile payload cannot
  // inject log lines, then collapse the row to a single bounded line.
  const stripped = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const trimmed = stripped.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/** Path only — query strings can carry recovery tokens we must not store. */
function pathOnly(value: unknown): string | null {
  const cleaned = clean(value, LIMITS.url);
  if (!cleaned) return null;
  try {
    const parsed = new URL(cleaned, "https://app.local");
    return `${parsed.pathname}${parsed.search ? "?…" : ""}`.slice(0, LIMITS.url);
  } catch {
    return cleaned.slice(0, LIMITS.url);
  }
}

export function sanitizeClientErrorPayload(raw: unknown): SanitisedClientError | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const message = clean(input.message, LIMITS.message);
  if (!message) return null;
  return {
    message,
    stack: clean(input.stack, LIMITS.stack),
    url: pathOnly(input.url),
    ua: clean(input.ua, LIMITS.ua),
    digest: clean(input.digest, LIMITS.digest),
    source: clean(input.source, LIMITS.source),
  };
}
