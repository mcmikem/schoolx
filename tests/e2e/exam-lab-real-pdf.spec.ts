import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("Exam Lab reads and parses the supplied Biology PDF", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`Browser console: ${message.text()}`);
  });
  const samplePath = resolve(process.cwd(), "report cards samples/A-LEVEL BIOLOGY SCENARIO ITEMS.pdf");
  test.skip(!existsSync(samplePath), "The local Biology sample PDF is not checked into this repository.");
  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/exam-lab/");
  await page.locator('input[type="file"]').setInputFiles(
    samplePath,
  );

  await expect(page.getByText(/Read as text layer — 31 pages\./)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Questions found", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Turn this paper into class practice" })).toBeVisible();
  await expect(page.getByText("Check original PDF (source of truth)")).toBeVisible();
  await expect(page.getByText(/I checked the questions against the original PDF/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Check original PDF (source of truth)").click();
  await expect(page.locator('canvas[aria-label="Original exam page 1"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Page 1 of 31")).toBeVisible();
  await expect
    .poll(() => page.locator('canvas[aria-label="Original exam page 1"]').evaluate((canvas) => (canvas as HTMLCanvasElement).width))
    .toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();

  const parsedForm = page.frameLocator('iframe[title="Rendered exam form"]');
  const questionCount = await parsedForm.locator("li.q").count();
  expect(questionCount).toBe(60);
  await expect(parsedForm.getByText(/marks do not add up/i)).toBeVisible();
  console.log(`Real Biology PDF: ${questionCount} parsed questions`);
  console.log(`Real Biology PDF preview: ${(await parsedForm.locator("body").innerText()).slice(0, 1200)}`);
});
