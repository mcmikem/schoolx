import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("calendar event can be assigned to a responsible staff member", async ({ page }) => {
  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/calendar/");
  await page.getByRole("button", { name: "Create Event" }).click();
  const owner = page.getByLabel("Responsible staff member (optional)");
  await expect(owner).toBeVisible();
  const options = await owner.locator("option").count();
  expect(options).toBeGreaterThan(1);
  await owner.selectOption({ index: 1 });
  await expect(owner).not.toHaveValue("");
  await expect(page.getByText(/Only school administrators can assign another staff member/)).toBeVisible();
});
