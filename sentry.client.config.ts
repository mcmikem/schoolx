import * as Sentry from "@sentry/nextjs";

// Mirrors src/sentry.client.config.ts tuning: no-op without a DSN and no
// session replay (perf + privacy). This root file is the one @sentry/nextjs
// actually bundles for the browser; keep the two in sync.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
