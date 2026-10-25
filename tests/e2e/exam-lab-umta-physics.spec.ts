import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("UMTA UCE Physics paper parses as seven illustrated items", async ({ page }) => {
  const samplePath = resolve(process.cwd(), "report cards samples/UMTA_UCE_PHY_1_2025.pdf");
  test.skip(!existsSync(samplePath), "The local UMTA Physics sample is not checked into the repository.");
  test.setTimeout(90_000);

  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/exam-lab/");
  await page.locator('input[type="file"]').setInputFiles(samplePath);

  await expect(page.getByText("Read as text layer — 9 pages.")).toBeVisible({ timeout: 30_000 });
  const parsedForm = page.frameLocator('iframe[title="Rendered exam form"]');
  await expect(parsedForm.locator(".q")).toHaveCount(7);
  await expect(parsedForm.locator(".alert--warn")).toHaveCount(0);
  await expect(parsedForm.locator(".flag")).toHaveCount(0);
  await expect(parsedForm.locator(".diagram img").first()).toHaveAttribute("src", /^data:image\/jpeg/);
  await expect(parsedForm.locator(".diagram__missing")).toHaveCount(0);
  await expect(parsedForm.locator(".q").nth(1)).not.toContainText("© UMTA Joint Mocks");
  const expectedParts = [
    ["1(a)", "1(b)", "1(c)", "1(d)"],
    ["2(a)", "2(b)", "2(c)", "2(d)"],
    ["3(a)", "3(b)", "3(c)", "3(d)"],
    ["4(a)", "4(b)", "4(c)"],
    ["5(a)", "5(b)", "5(c)", "5(d)"],
    ["6(a)", "6(b)", "6(c)", "6(d)"],
    ["7(a)", "7(b)", "7(c)", "7(d)"],
  ];
  for (const [index, parts] of expectedParts.entries()) {
    await expect(parsedForm.locator(".q").nth(index).locator(".subtask__label")).toHaveText(parts);
  }
});
