import { logger } from "@/lib/logger";

// Sentry is auto-initialized by @sentry/nextjs config files
// (sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts).
// The register() function is intentionally empty to avoid double init.

export function register() {
  if (process.env.NEXT_PHASE !== "phase-production-build" && process.env.NODE_ENV === "production") {
    const required = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_APP_URL",
    ];

    const missing = required.filter(
      (key) => !process.env[key] || process.env[key]!.includes("your-"),
    );

    if (missing.length > 0) {
      logger.error("[env] Missing or placeholder env vars in production:", missing.join(", "));
    }
  }
}
