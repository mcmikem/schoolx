import { expect, test, type Page } from "@playwright/test";

/**
 * Offline behaviour only exists in a production build (the worker is
 * unregistered in `next dev`), and a real session is needed because demo
 * cookies are development-only. Run with:
 *
 *   OFFLINE_TEST_PHONE=... OFFLINE_TEST_PASSWORD=... npm run test:e2e:offline
 *
 * The account is only read from; this test never writes to the database.
 */
const PHONE = process.env.OFFLINE_TEST_PHONE;
const PASSWORD = process.env.OFFLINE_TEST_PASSWORD;

async function signIn(page: Page) {
  await page.goto("/login/");
  await page.getByLabel(/phone number or email/i).fill(PHONE as string);
  await page.locator('input[type="password"]').fill(PASSWORD as string);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard\//, { timeout: 90_000 });
}

test.describe("offline app shell", () => {
  test("a visited dashboard page reloads with no network", async ({ page, context }) => {
    test.skip(!PHONE || !PASSWORD, "OFFLINE_TEST_PHONE / OFFLINE_TEST_PASSWORD not set");
    test.setTimeout(180_000);

    await signIn(page);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 60_000 });

    // The worker controls the page only after install + clients.claim().
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 45_000 });

    await page.goto("/dashboard/students/", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: /student hub/i })).toBeVisible({ timeout: 60_000 });
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null);

    await context.setOffline(true);
    try {
      // This is the field failure: a cached page must boot from the worker,
      // not redirect to /login, the marketing site or the browser error page.
      await page.reload({ waitUntil: "load", timeout: 90_000 });
      await expect(page.getByRole("heading", { name: /student hub/i })).toBeVisible({ timeout: 90_000 });
      await expect(page).toHaveURL(/\/dashboard\/students/);
      await expect(page.getByText(/you are offline|check your internet connection/i)).toHaveCount(0);
    } finally {
      await context.setOffline(false);
    }
  });
});
