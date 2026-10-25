import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("large scanned PDFs ask for a page range instead of OCRing the whole book", async ({ page }) => {
  const samplePath = resolve(process.cwd(), "report cards samples/compressed_S.2 math baroque learners book.pdf");
  test.skip(!existsSync(samplePath), "The local 140-page scan is not checked into the repository.");
  test.setTimeout(120_000);

  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/exam-lab/");
  await page.locator('input[type="file"]').setInputFiles(samplePath);

  const rangePicker = page.getByRole("group", { name: "Choose scanned PDF pages" });
  await expect(rangePicker).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/This is a scanned PDF with 140 pages/)).toBeVisible();
  await expect(rangePicker.getByRole("spinbutton", { name: "First PDF page" })).toHaveValue("1");
  await expect(rangePicker.getByRole("spinbutton", { name: "Last PDF page" })).toHaveValue("1");
  await expect(rangePicker.getByRole("button", { name: "Read selected pages" })).toBeEnabled();

  await rangePicker.getByRole("spinbutton", { name: "First PDF page" }).fill("10");
  await rangePicker.getByRole("spinbutton", { name: "Last PDF page" }).fill("10");
  await rangePicker.getByRole("button", { name: "Read selected pages" }).click();
  await expect(page.getByText(/Read pages 10-10 of 140 using ocr/i)).toBeVisible({ timeout: 90_000 });
  await expect(rangePicker).toBeHidden();
  await expect(page.getByText("Questions found", { exact: true }).locator("..")).toContainText("2");
  const parsedForm = page.frameLocator('iframe[title="Rendered exam form"]');
  await expect(parsedForm.locator(".diagram__source")).toContainText("View original scanned page 10 (full page)");
});
