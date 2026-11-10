import { expect, test } from "@playwright/test";
import { seedDemoSession } from "./helpers/demo";

test("timetable photo is OCR-read into a review step without saving automatically", async ({ page }) => {
  test.setTimeout(150_000);
  const renderLoopErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Maximum update depth exceeded/i.test(message.text())) {
      renderLoopErrors.push(message.text());
    }
  });
  await seedDemoSession(page, "headmaster");
  await page.goto("/dashboard/timetable/");
  await expect(page.getByRole("button", { name: /import timetable photo/i })).toBeVisible({ timeout: 30_000 });

  // Keep the fixture fully synthetic; no school or learner data is uploaded.
  const imageBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 420;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    context.font = "bold 74px Arial";
    context.fillText("Monday 1 P1 English Ms Nakanwagi 08:00 08:40", 40, 230);
    return canvas.toDataURL("image/png").split(",")[1];
  });

  await page.locator('input[accept="image/png,image/jpeg,image/webp"]').setInputFiles({
    name: "sample-timetable.png",
    mimeType: "image/png",
    buffer: Buffer.from(imageBase64, "base64"),
  });

  const review = page.getByRole("dialog", { name: /review timetable import/i });
  await expect(review).toBeVisible({ timeout: 120_000 });
  await expect(review.getByText(/photo text was read on this device/i)).toBeVisible();
  await expect(review.getByRole("button", { name: /import lessons/i })).toBeVisible();
  await expect(review.getByRole("button", { name: /cancel/i })).toBeVisible();
  expect(renderLoopErrors).toEqual([]);
});
