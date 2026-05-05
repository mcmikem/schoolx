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
  webServer: shouldUseManagedWebServer
    ? {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120 * 1000,
        env: {
          NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES: "true",
          NEXT_PUBLIC_DEMO_ENABLED: "true",
          DEMO_ADMIN_PASSWORD: "skoolmate_demo_2024",
        },
      }
    : undefined,
});