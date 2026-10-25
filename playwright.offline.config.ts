import { defineConfig, devices } from "@playwright/test";

/**
 * Offline behaviour can only be tested against a production build: the service
 * worker is deliberately unregistered in `next dev` (HMR owns reloads there),
 * and without it an offline navigation has no cached shell to boot from.
 */
const shouldUseManagedWebServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER !== "true";
const PORT = 3210;

export default defineConfig({
  testDir: "./tests/offline",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  timeout: 180_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "offline", use: { ...devices["Desktop Chrome"] } }],
  webServer: shouldUseManagedWebServer
    ? {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        // Never reuse: a stale server on this port served a build whose manifests
        // had been replaced, and every chunk 500ed.
        reuseExistingServer: false,
        timeout: 300_000,
        env: {
          NEXT_TELEMETRY_DISABLED: "1",
        },
      }
    : undefined,
});
