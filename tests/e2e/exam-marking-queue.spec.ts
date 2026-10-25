import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("the marking queue sits beside the header, not inside the Create Exam button", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/exams/");

  const createButton = page.getByRole("button", { name: "Create Exam" });
  await expect(createButton).toBeVisible();
  await expect(page.getByRole("heading", { name: "Handed-in papers" })).toBeVisible();

  // The queue renders its own answers and inputs; a click there must not open
  // the exam-creation modal.
  await expect(createButton).not.toContainText("Handed-in papers");
  await expect(createButton).not.toContainText("Marks");
  await expect(createButton).not.toContainText("to mark");
});
