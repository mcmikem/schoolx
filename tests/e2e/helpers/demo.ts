import type { Page } from '@playwright/test'

type DemoRole = 'headmaster' | 'dean_of_studies' | 'bursar' | 'teacher'

const demoNames: Record<DemoRole, string> = {
  headmaster: 'John Headmaster',
  dean_of_studies: 'Sarah Dean',
  bursar: 'James Bursar',
  teacher: 'Mary Teacher',
}

// Key must match DEMO_KEY in src/lib/auth-context.tsx
const DEMO_KEY = 'skoolmate_demo_v1'

export async function seedDemoSession(page: Page, role: DemoRole) {
  const payload = {
    demoUser: {
      role,
      name: demoNames[role],
      school_id: 'demo-school',
    },
    demoSchool: {
      id: '00000000-0000-0000-0000-000000000001',
      name: "St. Mary's Primary School (Demo)",
      school_code: 'DEMO001',
      district: 'Kampala',
      school_type: 'primary',
      ownership: 'private',
      primary_color: '#17325F',
      subscription_plan: 'growth',
      subscription_status: 'active',
      feature_stage: 'full',
    },
  }

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')

  await page.addInitScript(
    ({ key, value }) => {
      // auth-context.tsx reads sessionStorage first, then falls back to localStorage
      sessionStorage.setItem(key, value)
      localStorage.setItem('academic_year', '2026')
      localStorage.setItem('current_term', '1')
    },
    { key: DEMO_KEY, value: encoded }
  )
}
