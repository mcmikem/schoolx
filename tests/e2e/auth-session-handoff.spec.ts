import { test, expect } from "@playwright/test";

test("server-verified credentials recover through SkoolMate when browser session validation fails", async ({ page }) => {
  const authUser = {
    id: "auth-user-123",
    email: "teacher@example.org",
    phone: "+256700000000",
    created_at: "2026-01-01T00:00:00.000Z",
    user_metadata: { role: "teacher", full_name: "Test Teacher" },
  };

  await page.route("**/api/auth/signin/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          access_token: "invalid-for-browser-session-validation",
          refresh_token: "test-refresh-token",
          expires_in: 3600,
          role: "teacher",
          user: authUser,
        },
      }),
    });
  });
  await page.route("**/api/auth/me/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "profile-123",
          auth_id: authUser.id,
          full_name: "Test Teacher",
          role: "teacher",
          roles: ["teacher"],
          email: authUser.email,
          phone: authUser.phone,
          school_id: "school-123",
          is_active: true,
        },
        school: {
          id: "school-123",
          name: "Session Handoff Test School",
          school_code: "TEST123",
          district: "Kampala",
          school_type: "primary",
          ownership: "private",
          subscription_plan: "growth",
          subscription_status: "active",
        },
      }),
    });
  });

  await page.goto("/login");
  await page.locator("#identifier").fill(authUser.email);
  await page.locator("#password").fill("ValidPass1");
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/dashboard\//, { timeout: 15_000 });
  await expect(page.getByText("Session Handoff Test School").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/couldn't reach the sign-in service/i)).toHaveCount(0);
});
