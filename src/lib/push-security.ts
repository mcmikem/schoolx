const ALLOWED_PUSH_HOST = (hostname: string) =>
  hostname === "fcm.googleapis.com" ||
  hostname === "web.push.apple.com" ||
  hostname.endsWith(".push.services.mozilla.com") ||
  hostname.endsWith(".notify.windows.com");

export function isAllowedWebPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 4096) return false;
  try {
    const parsed = new URL(endpoint);
    return (
      parsed.protocol === "https:" &&
      (!parsed.port || parsed.port === "443") &&
      !parsed.username &&
      !parsed.password &&
      ALLOWED_PUSH_HOST(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function isValidWebPushKeys(value: unknown): value is { p256dh: string; auth: string } {
  if (!value || typeof value !== "object") return false;
  const keys = value as Record<string, unknown>;
  return (
    typeof keys.p256dh === "string" &&
    /^[A-Za-z0-9_-]{16,128}$/.test(keys.p256dh) &&
    typeof keys.auth === "string" &&
    /^[A-Za-z0-9_-]{16,128}$/.test(keys.auth)
  );
}
