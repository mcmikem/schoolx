import { test, expect } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test.describe("Import page (unified stepper)", () => {
  test("renders the template and data-entry steps", async ({ page }) => {
    test.setTimeout(45_000);
    await seedDemoSession(page, "headmaster");
    await page.goto("/dashboard/import");

    await expect(page.getByRole("heading", { name: /import students/i })).toBeVisible();

    // Step 1 — template downloads
    await expect(page.getByRole("button", { name: /excel template/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /word template/i })).toBeVisible();

    // Step 2 — the three data-entry methods
    await expect(page.getByRole("button", { name: /upload a file/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /paste a list/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /google sheets/i })).toBeVisible();

    // Upload zone accepts Word/Excel/CSV/TXT
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute("accept", /\.xlsx|\.xls|\.csv|\.docx|\.txt/);

    // Switch to the paste method and verify the AI textarea appears
    await page.getByRole("button", { name: /paste a list/i }).click();
    await expect(page.getByPlaceholder(/john mukasa/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /read my list/i })).toBeVisible();

    // Switch to Google Sheets and verify the URL input
    await page.getByRole("button", { name: /google sheets/i }).click();
    await expect(page.getByPlaceholder(/docs\.google\.com/i)).toBeVisible();
  });
});

test.describe("Setup checklist on the headmaster dashboard", () => {
  test("shows the guided setup checklist card", async ({ page }) => {
    test.setTimeout(45_000);
    await seedDemoSession(page, "headmaster");
    await page.goto("/dashboard");

    // The checklist card renders on the admin home (demo has no setup data,
    // so the card shows with the default items via fallback).
    await expect(page.getByText("School Setup Checklist")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/of 8 completed/)).toBeVisible({ timeout: 15_000 });
  });
});
