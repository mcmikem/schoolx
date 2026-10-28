import { test, expect } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test.describe("Attendance flow", () => {
  test.beforeEach(async ({ page }) => {
    await seedDemoSession(page, "headmaster");
    await page.goto("/dashboard/attendance");
    await page.waitForLoadState("networkidle");
  });

  async function selectFirstClass(page: any) {
    // The class dropdown is required before any attendance UI renders. If there
    // are no classes to select the attendance flow is broken and must fail.
    const classSelect = page.locator("#class-select, select").first();
    await expect(classSelect).toBeVisible({ timeout: 10_000 });
    const optionCount = await classSelect.locator("option").count();
    expect(optionCount).toBeGreaterThan(1);
    // Demo students live in P.1 (class id "4"); selecting the first class would
    // show an empty roster and break the mark-a-student assertions.
    await classSelect.selectOption({ value: "4" });
    await page.waitForTimeout(1000);
  }

  test("navigate to attendance page and mark a student", async ({ page }) => {
    await selectFirstClass(page);

    // Wait for student list to load
    await page.waitForTimeout(2000);

    // Mark the first student as present — if the mark action is unavailable the
    // attendance flow is broken and the test must fail, not pass silently.
    const presentBtn = page.getByRole("button", { name: "Present", exact: true }).first();
    await expect(presentBtn).toBeVisible({ timeout: 5000 });
    await presentBtn.click();
    await page.waitForTimeout(500);

    // Verify save button is visible and enabled
    const saveBtn = page.getByRole("button", { name: /^Save/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
  });

  test("explicit attendance status can be selected", async ({ page }) => {
    await selectFirstClass(page);

    const presentBtn = page.getByRole("button", { name: "Present", exact: true }).first();
    await expect(presentBtn).toBeVisible({ timeout: 5000 });
    await presentBtn.click();
    await expect(presentBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Save/i }).first()).toBeVisible();
  });

  test("attendance history page loads", async ({ page }) => {
    await page.goto("/dashboard/attendance/history");
    await page.waitForLoadState("networkidle");

    // Verify the page loaded
    await expect(page.getByRole("heading", { name: /attendance history/i })).toBeVisible({ timeout: 10000 });
  });
});
