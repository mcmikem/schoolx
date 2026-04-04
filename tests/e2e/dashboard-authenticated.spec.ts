import { test, expect } from '@playwright/test'
import { seedDemoSession } from './helpers/demo'

test.describe('Authenticated dashboard flows', () => {
  test('headmaster can open auto-sms actions', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/auto-sms')
    await expect(page.getByRole('heading', { name: /smart sms triggers/i })).toBeVisible()
    await page.getByRole('button', { name: /new automation rule/i }).click()
    await expect(page.getByRole('heading', { name: /create automation rule/i })).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()
  })

  test('headmaster can open transport schedule details', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/transport')
    await expect(page.getByRole('heading', { name: /transport & logistics/i })).toBeVisible()
    await page.getByRole('button', { name: /view schedule/i }).first().click()
    await expect(page.getByText(/time not set|stop 1/i).first()).toBeVisible()
  })

  test('headmaster can reach attendance and grades work areas', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/attendance')
    await expect(page.getByRole('heading', { name: /attendance/i })).toBeVisible()
    const classSelect = page.locator('select').first()
    await classSelect.selectOption('4')
    await expect(page.getByRole('button', { name: /mark all present|reset all/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /save attendance|save offline/i })).toBeVisible()

    await page.goto('/dashboard/grades')
    await expect(page.getByRole('heading', { name: /grades & marks/i })).toBeVisible()
    await page.locator('select').nth(0).selectOption({ index: 1 })
    await page.locator('select').nth(1).selectOption({ index: 1 })
    await expect(page.getByRole('button', { name: /save grades/i })).toBeVisible()
  })

  test('bursar can open finance actions on fees page', async ({ page }) => {
    await seedDemoSession(page, 'bursar')

    await page.goto('/dashboard/fees')
    await expect(page.getByRole('heading', { name: /fee management/i })).toBeVisible()

    await page.getByRole('button', { name: /add payment/i }).click()
    await expect(page.getByRole('heading', { name: /record payment/i })).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()

    await page.getByRole('button', { name: /add adjustment/i }).click()
    await expect(page.getByRole('heading', { name: /record fee adjustment/i })).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()
  })
})
