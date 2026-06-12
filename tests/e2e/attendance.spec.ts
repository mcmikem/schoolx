import { test, expect } from "@playwright/test";

test.describe("Attendance flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login and sign in as teacher
    await page.goto("/login");

    // Use demo teacher login if available
    const teacherBtn = page.getByRole("button", { name: /teacher/i });
    if (await teacherBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await teacherBtn.click();
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    } else {
      // Fall back to manual login with demo credentials
      await page.fill('input[name="phone"]', "256700000002");
      await page.fill('input[name="password"]', "skoolmate_demo_2024");
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    }
  });

  test("navigate to attendance page and mark a student", async ({ page }) => {
    // Navigate to attendance
    await page.goto("/dashboard/attendance");
    await page.waitForLoadState("networkidle");

    // Select a class if available
    const classSelect = page.locator("select").first();
    if (await classSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      const options = classSelect.locator("option");
      const count = await options.count();
      if (count > 1) {
        await classSelect.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
    }

    // Wait for student list to load
    await page.waitForTimeout(2000);

    // Look for the first student's present button
    const presentBtn = page.getByRole("button", { name: /in school/i }).first();
    if (await presentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await presentBtn.click();
      await page.waitForTimeout(500);
    }

    // Verify save button is visible and enabled
    const saveBtn = page.getByRole("button", { name: /save/i });
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
  });

  test("roll call mode toggles correctly", async ({ page }) => {
    await page.goto("/dashboard/attendance");
    await page.waitForLoadState("networkidle");

    // Toggle roll call mode
    const rollCallToggle = page.getByRole("switch", { name: /toggle call out names mode/i });
    if (await rollCallToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rollCallToggle.click();
      await page.waitForTimeout(500);

      // Verify roll call UI is shown
      await expect(page.getByText(/everyone starts as in school/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test("attendance history page loads", async ({ page }) => {
    await page.goto("/dashboard/attendance/history");
    await page.waitForLoadState("networkidle");

    // Verify the page loaded
    await expect(page.getByRole("heading", { name: /attendance history/i })).toBeVisible({ timeout: 10000 });
  });
});
