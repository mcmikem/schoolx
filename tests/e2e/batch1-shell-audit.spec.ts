import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { seedDemoSession, type DemoRole } from './helpers/demo'

/**
 * Batch 1 — shared shell, role dashboards, mobile navigation.
 *
 * Records, per role per width: horizontal overflow, landmark/heading presence,
 * the nav labels actually rendered for that role, and any sub-44px tap targets
 * in the primary nav. Screenshots are written for visual review — measurements
 * alone cannot tell you a layout reads badly.
 */

const ROLES: DemoRole[] = [
  'headmaster',
  'dean_of_studies',
  'bursar',
  'teacher',
  'secretary',
  'dorm_master',
  'marketer',
]

// The brief names 320/390/768/1280. 320 is the floor the app claims to fit.
const WIDTHS = [
  { name: 'w320', width: 320, height: 720 },
  { name: 'w390', width: 390, height: 844 },
  { name: 'w768', width: 768, height: 1024 },
  { name: 'w1280', width: 1280, height: 800 },
]

type Row = {
  role: DemoRole
  width: string
  documentWidth: number
  viewportWidth: number
  overflowBy: number
  headings: string[]
  hasMain: boolean
  hasNav: boolean
  bottomNavLabels: string[]
  sidebarLabels: string[]
  smallTapTargets: Array<{ label: string; w: number; h: number }>
  textSample: string
}

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }

    const headings = Array.from(document.querySelectorAll('main h1, main h2, main h3'))
      .filter(visible)
      .map((h) => `${h.tagName}:${h.textContent?.trim().slice(0, 60) ?? ''}`)

    // Mobile bottom nav: the fixed bar pinned to the viewport bottom.
    const bottomNav = Array.from(document.querySelectorAll('nav'))
      .filter((n) => {
        const r = n.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && r.bottom > window.innerHeight - 120 && r.top < window.innerHeight
      })

    const sidebar = Array.from(document.querySelectorAll('aside, nav'))
      .filter((n) => {
        const r = n.getBoundingClientRect()
        return r.width > 0 && r.height > 200 && r.left < 40
      })

    const labelsOf = (nodes: Element[]) =>
      nodes.flatMap((n) =>
        Array.from(n.querySelectorAll('a, button'))
          .filter(visible)
          .map((a) => (a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40))
          .filter(Boolean),
      )

    // Tap targets inside the primary nav only — the app claims a 44px floor.
    const navRoots = [...bottomNav, ...sidebar]
    const small: Array<{ label: string; w: number; h: number }> = []
    for (const root of navRoots) {
      for (const el of Array.from(root.querySelectorAll('a, button'))) {
        if (!visible(el)) continue
        const r = el.getBoundingClientRect()
        if (r.height < 44 || r.width < 44) {
          const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
          if (label) small.push({ label, w: Math.round(r.width), h: Math.round(r.height) })
        }
      }
    }

    return {
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewportWidth: window.innerWidth,
      headings,
      hasMain: Boolean(document.querySelector('main')),
      hasNav: document.querySelectorAll('nav, aside').length > 0,
      bottomNavLabels: labelsOf(bottomNav),
      sidebarLabels: labelsOf(sidebar),
      smallTapTargets: small.slice(0, 12),
      textSample: (document.querySelector('main')?.innerText || '').slice(0, 400),
    }
  })
}

test('batch 1 — shell and role dashboards across phone, tablet and desktop', async ({ page }) => {
  test.setTimeout(600_000)
  const outDir = join(process.cwd(), 'test-results', 'batch1-audit')
  await mkdir(outDir, { recursive: true })

  const rows: Row[] = []
  const problems: string[] = []

  for (const role of ROLES) {
    await seedDemoSession(page, role)

    for (const vp of WIDTHS) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

      const main = page.locator('main')
      await main.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined)
      // Let role dashboard data settle so we audit the loaded state, not a skeleton.
      await page.waitForTimeout(1500)
      await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' }).catch(() => undefined)
      await main.evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)))
      }).catch(() => undefined)

      const m = await measure(page)
      const row: Row = {
        role,
        width: vp.name,
        ...m,
        overflowBy: Math.max(0, m.documentWidth - m.viewportWidth),
      }
      rows.push(row)

      const tag = `${role}/${vp.name}`
      if (row.overflowBy > 2) problems.push(`${tag}: horizontal overflow ${row.overflowBy}px`)
      if (!row.hasMain) problems.push(`${tag}: no <main> landmark`)
      if (row.headings.length === 0) problems.push(`${tag}: no visible heading in main`)
      if (row.smallTapTargets.length) {
        problems.push(
          `${tag}: ${row.smallTapTargets.length} nav tap target(s) under 44px: ` +
            row.smallTapTargets.map((t) => `${t.label}(${t.w}x${t.h})`).join(', '),
        )
      }
      if (vp.width <= 390 && row.bottomNavLabels.length === 0) {
        problems.push(`${tag}: phone width but no bottom-nav items detected`)
      }

      await page.screenshot({
        path: join(outDir, `${role}-${vp.name}.png`),
        fullPage: vp.width <= 768,
      })
    }
  }

  await writeFile(join(outDir, 'measurements.json'), JSON.stringify(rows, null, 2))
  await writeFile(join(outDir, 'problems.txt'), problems.join('\n') || 'none')

  // Overflow and landmarks are hard failures; tap-target size is reported for
  // triage rather than blocking, since the brief asks for evidence first.
  expect(problems.filter((p) => p.includes('overflow') || p.includes('landmark') || p.includes('heading'))).toEqual([])
})
