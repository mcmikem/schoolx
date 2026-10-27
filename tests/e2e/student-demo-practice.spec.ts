import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("demo student opens the UMTA practice paper and hands it in", async ({ page }) => {
  test.setTimeout(60_000);
  await seedDemoSession(page, "headmaster");
  await page.goto("/student-portal/");

  const paper = page.getByRole("button", { name: /UMTA UCE Physics Paper 1 \(2025\)/ });
  await expect(paper).toBeVisible({ timeout: 20_000 });
  await expect(paper).toContainText("7 questions");
  await paper.click();

  const practice = page.getByRole("main", { name: "Practice paper" });
  await expect(practice.getByText("Question 1 of 7")).toBeVisible();

  const figures = practice.locator("figure img");
  await expect(figures).toHaveCount(2);
  await expect(figures.first()).toHaveAttribute("src", /^data:image\/jpeg/);
  await expect(practice.getByText("figure 1 on page 2")).toBeVisible();
  await expect(practice.getByText("The teacher has not attached the original PDF")).toHaveCount(0);
  await expect(practice.getByText(/Support Material|lamp normal|Beam of light/)).toHaveCount(0);
  await expect(practice.getByText("Refractiveindex of the glass maierial is 1.47.")).toBeVisible();

  await practice.getByRole("textbox").first().fill("A demo answer");
  await practice.getByRole("button", { name: /Review answers/ }).click();
  await practice.getByRole("button", { name: "Hand in paper" }).click();
  await practice.getByRole("button", { name: "Yes, hand in" }).click();

  await expect(practice.getByText("Paper handed in")).toBeVisible();
  await expect(practice.getByText("Handed in (demo)")).toBeVisible();
});
