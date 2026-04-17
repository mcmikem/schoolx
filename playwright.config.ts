import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
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
  // Automatically start the dev server when running E2E tests.
  // NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES=true is required so that the
  // demo-session storage mechanism in auth-context is active, which the
  // authenticated test helpers rely on.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Reuse an already-running server to avoid slow restarts during development.
    reuseExistingServer: true,
    timeout: 120 * 1000,
    env: {
      NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES: "true",
    },
  },
});
