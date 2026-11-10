import { test, expect } from "@playwright/test";

const phone = process.env.SMOKE_PHONE ?? "";
const password = process.env.SMOKE_PASSWORD ?? "";

test("production password sign-in reaches the dashboard and survives reload", async ({ page }) => {
  test.skip(!phone || !password, "Production smoke credentials are supplied only by the protected deploy workflow.");

  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/login/");
  await page.locator("#identifier").fill(phone);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/, { timeout: 30_000 });
  await expect(page.locator("#identifier")).toHaveCount(0, { timeout: 15_000 });

  // A new document load exercises the deployed cookie/session restoration path.
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/, { timeout: 30_000 });
  await expect(page.locator("#identifier")).toHaveCount(0, { timeout: 15_000 });
  expect(browserErrors, `Browser runtime errors: ${browserErrors.join(" | ")}`).toEqual([]);
});
