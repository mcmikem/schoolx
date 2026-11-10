const EVENT_TYPES = new Set(["page_view", "feature_use", "error", "api_call"]);

export interface SanitizedTelemetryEvent {
  event_type: "page_view" | "feature_use" | "error" | "api_call";
  event_name: string;
  url: string | null;
}

function cleanEventName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[number]")
    .replace(/[?#].*$/, "")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .trim()
    .slice(0, 180);
  return cleaned || null;
}

function cleanPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const path = new URL(value, "https://skoolmate.invalid").pathname;
    return path
      .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ":id")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ":email")
      .replace(/\/\+?\d[\d\s().-]{7,}\d(?=\/|$)/g, "/:id")
      .replace(/\/\d+(?=\/|$)/g, "/:id")
      .slice(0, 400);
  } catch {
    return null;
  }
}

export function sanitizeTelemetryEvents(raw: unknown): SanitizedTelemetryEvent[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const events = Array.isArray(input.events) ? input.events : [input];
  if (events.length < 1 || events.length > 30) return null;
  const sanitized: SanitizedTelemetryEvent[] = [];
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) return null;
    const row = event as Record<string, unknown>;
    if (typeof row.event_type !== "string" || !EVENT_TYPES.has(row.event_type)) return null;
    const eventName = cleanEventName(row.event_name);
    if (!eventName) return null;
    sanitized.push({
      event_type: row.event_type as SanitizedTelemetryEvent["event_type"],
      event_name: eventName,
      url: cleanPath(row.url),
    });
  }
  return sanitized;
}
