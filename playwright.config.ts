import { defineConfig, devices } from "@playwright/test";

const shouldUseManagedWebServer =
  process.env.PLAYWRIGHT_USE_EXISTING_SERVER !== "true";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // When PLAYWRIGHT_USE_EXISTING_SERVER=true, no managed server is started
  // (useful when running against a pre-started dev server).
  // Otherwise Playwright starts a dev server on port 3000 with demo mode enabled.
  // If a server is already on port 3000, it is reused (demo tests may need the
  // NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES=true flag in that case).
  webServer: shouldUseManagedWebServer
    ? {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120 * 1000,
        env: {
          NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES: "true",
        },
      }
    : undefined,
});
