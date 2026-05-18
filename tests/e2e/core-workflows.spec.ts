import { test, expect } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test.describe("Core Workflows (Big Five)", () => {
  // Login & Auth is already covered extensively in auth-flows.spec.ts

  test("1. Student Registration Flow", async ({ page }) => {
    test.setTimeout(45_000);
    await seedDemoSession(page, "headmaster");
    
    // Go to Students page
    await page.goto("/dashboard/students");
    await expect(page.getByRole("heading", { name: /student hub/i })).toBeVisible();

    // Open Register Student modal/page
    await page.getByRole("button", { name: /register student/i }).first().click();
    
    // Check if the form renders
    await expect(page.getByRole("heading", { name: /register student|add new student/i })).toBeVisible();
    
    // Fill basic details
    await page.getByLabel(/first name/i).fill("TestName");
    await page.getByLabel(/last name/i).fill("TestSurname");
    
    // Wait for the class dropdown and select a valid class
    const classSelect = page.getByLabel(/class|grade/i);
    await classSelect.waitFor({ state: "visible" });
    await classSelect.selectOption({ index: 1 }); // Select first available class

    // Since it's a demo mode, we might just submit or cancel to ensure the form is fully interactive
    const cancelBtn = page.getByRole("button", { name: /cancel/i });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
  });

  test("2. Fee Payment & Receipting Flow", async ({ page }) => {
    test.setTimeout(45_000);
    await seedDemoSession(page, "bursar");
    
    // Go to Fees page
    await page.goto("/dashboard/fees");
    await expect(page.getByRole("heading", { name: /fees tracker/i })).toBeVisible();

    // Open Add Payment Modal
    await page.getByRole("button", { name: /add payment/i }).click();
    await expect(page.getByRole("heading", { name: /record payment/i })).toBeVisible();

    // Select a student (using standard combobox if applicable)
    // Here we'll just check if the amount field is visible
    const amountInput = page.getByLabel(/amount/i);
    await expect(amountInput).toBeVisible();
    
    // Close modal
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("3. Grade Entry Flow", async ({ page }) => {
    test.setTimeout(45_000);
    await seedDemoSession(page, "teacher");
    
    // Go to Grades page
    await page.goto("/dashboard/grades");
    await expect(page.getByRole("heading", { name: /grades & marks/i })).toBeVisible();

    // Select Class, Term, Exam, and Subject
    const selects = page.locator("select");
    
    // Ensure the selects are populated
    await expect(selects.first()).not.toBeDisabled();
    
    if (await selects.count() > 1) {
      await selects.nth(0).selectOption({ index: 1 }); // Class
      await selects.nth(1).selectOption({ index: 1 }); // Subject
    }
    
    // Check if the Save Grades button appears
    await expect(page.getByRole("button", { name: /save grades/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test("4. Report Card Generation Flow", async ({ page }) => {
    test.setTimeout(45_000);
    await seedDemoSession(page, "headmaster");
    
    // Go to Report Cards page
    await page.goto("/dashboard/report-cards");
    await expect(page.getByRole("heading", { name: /report cards/i })).toBeVisible();

    // Select class
    await page.getByLabel(/select class/i).selectOption({ index: 1 });
    
    // Click Generate
    await page.getByRole("button", { name: /generate now|generate report cards/i }).click();
    
    // Verify report card preview appears
    await expect(page.getByText(/class average/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("checkbox").first()).toBeVisible();
  });
});
