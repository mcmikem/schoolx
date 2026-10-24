"use client";

/**
 * Fire-and-forget report of a client crash to our own server.
 *
 * Sentry only exists in builds that carry a DSN, and a crash during boot means
 * the browser-side error logger (which writes through the authenticated
 * Supabase client) may never run. This beacon goes to an unauthenticated route
 * that stores the error with the service role, so a phone that fails on its
 * very first launch still leaves a trace we can read.
 */

import type { ClientErrorPayload } from "@/lib/client-error-payload";

export function errorDetails(error: Error & { digest?: string }, source: string): ClientErrorPayload {
  return {
    message: error?.message || error?.name || "Unknown client error",
    stack: error?.stack,
    digest: error?.digest,
    source,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    ua: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}

export function reportClientError(error: Error & { digest?: string }, source: string): void {
  try {
    const body = JSON.stringify(errorDetails(error, source));
    void fetch("/api/client-error/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let reporting throw on the error screen.
  }
}
