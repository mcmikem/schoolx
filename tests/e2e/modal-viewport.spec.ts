import { test, expect, devices, type Page, type Locator } from '@playwright/test'
import { seedDemoSession } from './helpers/demo'

/**
 * Bursar report: button-triggered popups (and the fee-draft restore prompt)
 * open off-screen on phones — the screen dims, but the dialog sits in the
 * middle of the page so users must scroll to find it and feel stuck.
 *
 * These specs assert every dialog opens fully inside the viewport, on a real
 * mobile viewport with real layout (no jsdom).
 */

test.use({ ...devices['Pixel 5'] })

test.beforeEach(async ({ page }) => {
  await seedDemoSession(page, 'bursar')
})

async function expectFullyInViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible({ timeout: 15000 })
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  expect(box, 'dialog has a bounding box').not.toBeNull()
  expect(box!.y, 'dialog top inside viewport').toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height, 'dialog bottom inside viewport').toBeLessThanOrEqual(viewport!.height)
  expect(box!.x, 'dialog left inside viewport').toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width, 'dialog right inside viewport').toBeLessThanOrEqual(viewport!.width)
}

test('fee restore-draft prompt opens inside the viewport', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'autosave_fee_add_form',
      JSON.stringify({ data: { name: 'Term 3 fees' }, savedAt: new Date().toISOString() }),
    )
  })
  await page.goto('/dashboard/fees/')
  await expectFullyInViewport(page, page.getByRole('heading', { name: /restore draft/i }))
})

test('record-payment dialog opens inside the viewport', async ({ page }) => {
  await page.goto('/dashboard/fees/')
  await page.getByRole('button', { name: /record payment|add payment/i }).first().click()
  await expectFullyInViewport(page, page.getByRole('dialog'))
})
