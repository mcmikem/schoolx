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
    
    // Fill required basic details
    await page.getByLabel(/first name/i).fill("TestName");
    await page.getByLabel(/last name/i).fill("TestSurname");
    await page.locator("#parent-name").fill("Test Parent");
    await page.locator("#parent-phone").fill("0700111222");
    
    // Wait for the class dropdown and select a valid class
    const classSelect = page.locator("#student-class-id");
    await classSelect.waitFor({ state: "visible" });
    await classSelect.selectOption({ index: 1 }); // Select first available class

    // Submit the form and verify the student is actually created
    await page.getByRole("button", { name: /add student/i }).click();
    await expect(page.getByText(/student added successfully/i)).toBeVisible({ timeout: 10_000 });
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

    // Select a student and enter an amount
    const studentSelect = page.getByLabel(/^student$/i);
    await expect(studentSelect).toBeVisible();
    await studentSelect.selectOption({ index: 1 });
    const amountInput = page.getByLabel(/amount/i);
    await amountInput.fill("50000");

    // Advance to step 2 and record the payment
    await page.getByRole("button", { name: /^next$/i }).click();
    await page.getByRole("button", { name: /record payment/i }).click();

    // Verify the payment is actually recorded
    await expect(page.getByText(/payment recorded successfully/i)).toBeVisible({ timeout: 10_000 });
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
    test.setTimeout(60_000);
    await seedDemoSession(page, "headmaster");
    
    // Go to Report Cards page
    await page.goto("/dashboard/report-cards");
    await expect(page.getByRole("heading", { name: /report cards/i })).toBeVisible();

    // Select P.1 (class value "4") — the demo class with students AND grades.
    // Other classes have no demo students, so generation would legitimately
    // no-op; P.1 verifies actual report generation end-to-end.
    const classSelect = page.getByLabel(/select class/i);
    await classSelect.waitFor({ state: "visible" });
    await classSelect.selectOption("4");
    
    // Click Generate
    await page.getByRole("button", { name: /generate now|generate report cards/i }).click();
    
    // Verify actual report generation — class average stats block only renders
    // when reports were produced (never accept a "no students" fallback).
    await expect(
      page.getByText(/class average/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(/division 1/i).first(),
    ).toBeVisible();
    await expect(page.getByRole("checkbox").first()).toBeVisible();
  });
});
