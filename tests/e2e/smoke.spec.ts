import { test, expect } from '@playwright/test'

test('landing page opens and reaches login', async ({ page }) => {
  await page.goto('/')

  const loginLink = page.getByRole('link', { name: /open dashboard/i })
  await expect(loginLink).toBeVisible()
  await loginLink.click({ force: true })

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible()
})

test('parent portal login page renders', async ({ page }) => {
  await page.goto('/parent')

  await expect(page.getByText(/parent portal/i).first()).toBeVisible()
  await expect(page.getByLabel(/phone number/i)).toBeVisible()
  await expect(page.getByLabel(/password/i)).toBeVisible()
})

test('login page renders demo shortcuts', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /headmaster/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /teacher/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /bursar/i })).toBeVisible()
})
