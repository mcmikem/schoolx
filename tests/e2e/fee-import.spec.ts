import { test, expect } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test.describe("Fee structure bulk import", () => {
  test("imports a fee list from CSV through the preview", async ({ page }) => {
    test.setTimeout(60_000);
    await seedDemoSession(page, "bursar");
    await page.goto("/dashboard/fees");

    await page.getByRole("button", { name: /bulk import/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /import fee structure/i })).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(/download blank template/i)).toBeVisible();

    const csv = [
      "Fee Name,Class,Amount (UGX),Term,Category,Applies To,Frequency",
      "Library Fee,,30000,,,All,Per Term",
    ].join("\n");

    await dialog.locator('input[type="file"]').setInputFiles({
      name: "fees.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });

    await expect(dialog.getByText(/1 ready to import/i)).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText("Library Fee")).toBeVisible();

    await dialog.getByRole("button", { name: /import 1 fee/i }).click();

    await expect(dialog.getByRole("heading", { name: /import complete/i })).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(/1 fee added/i)).toBeVisible();
  });
});
