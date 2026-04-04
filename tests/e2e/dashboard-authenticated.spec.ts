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

  test('headmaster can post a notice in demo mode', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/notices')
    await expect(page.getByRole('heading', { name: /notices/i })).toBeVisible()

    await page.getByRole('button', { name: /post notice/i }).click()
    await expect(page.getByRole('heading', { name: /post notice/i })).toBeVisible()

    await page.getByLabel(/title/i).fill('Playwright Notice')
    await page.getByLabel(/category/i).selectOption('Academic')
    await page.getByLabel(/content/i).fill('Browser test notice body')
    await page.getByRole('button', { name: /^post notice$/i }).click()

    await expect(page.getByText(/playwright notice/i)).toBeVisible()
  })

  test('headmaster can log a substitution in demo mode', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/substitutions')
    await expect(page.getByRole('heading', { name: /substitutions/i })).toBeVisible()

    await page.getByRole('button', { name: /log substitution/i }).click()
    await expect(page.getByRole('heading', { name: /log substitution/i })).toBeVisible()

    await page.getByLabel(/absent teacher/i).selectOption({ index: 1 })
    await page.getByLabel(/class affected/i).selectOption('4')
    await page.getByLabel(/substitute teacher/i).selectOption({ index: 1 })
    await page.getByRole('button', { name: /^log substitution$/i }).last().click()

    await expect(page.getByText(/→/).first()).toBeVisible()
  })

  test('headmaster can send a demo parent message', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/messages')
    await expect(page.getByRole('heading', { name: /messages/i })).toBeVisible()

    await page.getByLabel(/phone number/i).fill('0700000000')
    await page.getByLabel(/message/i).fill('Playwright demo message')
    await page.getByRole('button', { name: /send message/i }).click()

    await expect(page.getByText(/playwright demo message/i)).toBeVisible()
  })

  test('headmaster can open sync center controls', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/sync-center')
    await expect(page.getByRole('heading', { name: /sync center/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /refresh cache/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sync now/i })).toBeVisible()
    await expect(page.getByText(/pending queue/i)).toBeVisible()
  })

  test('headmaster can search a student and open SMS modal', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/student-lookup')
    await expect(page.getByRole('heading', { name: /student lookup/i })).toBeVisible()

    await page.getByLabel(/student search/i).fill('Amina')
    await expect(page.getByText(/amina nakamya/i)).toBeVisible()

    await page.getByRole('button', { name: /sms parent/i }).click()
    await expect(page.getByRole('heading', { name: /sms parent of amina nakamya/i })).toBeVisible()

    await page.getByRole('button', { name: /fee reminder/i }).click()
    await expect(page.getByLabel(/message/i)).not.toHaveValue('')
    await page.getByRole('button', { name: /cancel/i }).click()
  })

  test('headmaster can review dropout actions in demo mode', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/dropout-tracking')
    await expect(page.getByRole('heading', { name: /dropout tracking/i })).toBeVisible()
    await expect(page.getByText(/likely dropout|at risk/i).first()).toBeVisible()

    await page.getByRole('button', { name: /contact/i }).first().click()
    await page.getByRole('button', { name: /dropout/i }).first().click()
    await expect(page.getByRole('heading', { name: /mark as dropout/i })).toBeVisible()

    await page.getByLabel(/reason for dropout/i).selectOption('Family relocation')
    await page.getByRole('button', { name: /mark as dropout/i }).last().click()
    await expect(page.getByRole('heading', { name: /dropout tracking/i })).toBeVisible()
  })

  test('headmaster can record transfer in and transfer out flows', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/student-transfers')
    await expect(page.getByRole('heading', { name: /student transfers/i })).toBeVisible()

    await page.getByRole('button', { name: /new transfer/i }).click()
    await expect(page.getByRole('heading', { name: /new transfer in/i })).toBeVisible()
    await page.getByLabel(/first name/i).fill('Play')
    await page.getByLabel(/last name/i).fill('Transfer')
    await page.getByLabel(/previous school/i).fill('Demo Primary')
    await page.getByLabel(/transfer reason/i).selectOption('Family relocation')
    await page.getByLabel(/assign to class/i).selectOption('4')
    await page.getByLabel(/parent\/guardian name/i).fill('Test Parent')
    await page.getByLabel(/^parent phone$/i).fill('0700000011')
    await page.getByRole('button', { name: /add transfer student/i }).click()
    await expect(page.getByText(/play transfer/i)).toBeVisible()

    await page.getByRole('tab', { name: /^transfer out$/i }).click()
    await expect(page.getByRole('heading', { name: /students transferred out/i })).toBeVisible()
    await page.getByRole('button', { name: /transfer out/i }).first().click()
    await page.getByLabel(/select student/i).selectOption({ index: 1 })
    await page.getByLabel(/transferring to/i).fill('Next School')
    await page.getByLabel(/^reason$/i).selectOption('Better opportunity')
    await page.getByRole('button', { name: /transfer out/i }).last().click()
    await expect(page.getByRole('cell', { name: /next school/i })).toBeVisible()
  })

  test('headmaster can generate report cards in demo mode', async ({ page }) => {
    await seedDemoSession(page, 'headmaster')

    await page.goto('/dashboard/report-cards')
    await expect(page.getByRole('heading', { name: 'Report Cards', exact: true })).toBeVisible()

    await page.getByLabel(/select class/i).selectOption('4')
    await page.getByRole('button', { name: /generate report cards/i }).click()

    await expect(page.getByText(/class average/i)).toBeVisible()
    await expect(page.locator('div').filter({ hasText: /^Division 1$/ }).first()).toBeVisible()
    await expect(page.getByRole('checkbox')).toBeVisible()
  })
})
