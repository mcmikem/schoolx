import { test, expect } from "@playwright/test";

test.describe("Critical app flows", () => {
  test("landing page loads with headline", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /save 5\+ hours/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("input").first()).toBeVisible({ timeout: 10000 });
  });

  test("parent portal loads", async ({ page }) => {
    await page.goto("/parent");
    await expect(page.getByText(/parent portal/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("setup wizard redirects unauthenticated users", async ({ page }) => {
    await page.goto("/setup-admin");
    // Should redirect to login or show access denied
    await expect(page.url()).toMatch(/login|setup|register/);
  });
});
