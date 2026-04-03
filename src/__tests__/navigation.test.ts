import { getNavigationForRole, NavGroup } from '../lib/navigation'

describe('Navigation', () => {
  describe('getNavigationForRole', () => {
    test('returns navigation for headmaster', () => {
      const nav = getNavigationForRole('headmaster')
      expect(nav).toBeDefined()
      expect(nav.length).toBeGreaterThan(0)
      expect(nav[0].label).toBeDefined()
    })

    test('returns navigation for teacher', () => {
      const nav = getNavigationForRole('teacher')
      expect(nav).toBeDefined()
      expect(nav.some(g => g.items.some(i => i.href === '/dashboard/grades'))).toBe(true)
    })

    test('returns navigation for bursar', () => {
      const nav = getNavigationForRole('bursar')
      expect(nav).toBeDefined()
      expect(nav.some(g => g.items.some(i => i.href === '/dashboard/fees'))).toBe(true)
    })

    test('returns navigation for dean_of_students', () => {
      const nav = getNavigationForRole('dean_of_students')
      expect(nav).toBeDefined()
      expect(nav.some(g => g.items.some(i => i.href === '/dashboard/attendance'))).toBe(true)
    })

    test('returns teacher as default for unknown role', () => {
      const nav = getNavigationForRole('unknown_role')
      expect(nav).toBeDefined()
      expect(nav).toEqual(getNavigationForRole('teacher'))
    })

    test('headmaster has access to all admin functions', () => {
      const nav = getNavigationForRole('headmaster')
      const allHrefs = nav.flatMap(g => g.items.map(i => i.href))
      expect(allHrefs).toContain('/dashboard/settings')
      expect(allHrefs).toContain('/dashboard/staff')
      expect(allHrefs).toContain('/dashboard/analytics')
    })

    test('teacher does not have settings access', () => {
      const nav = getNavigationForRole('teacher')
      const allHrefs = nav.flatMap(g => g.items.map(i => i.href))
      expect(allHrefs).not.toContain('/dashboard/settings')
    })

    test('bursar has fees and budget access', () => {
      const nav = getNavigationForRole('bursar')
      const allHrefs = nav.flatMap(g => g.items.map(i => i.href))
      expect(allHrefs).toContain('/dashboard/fees')
      expect(allHrefs).toContain('/dashboard/budget')
    })

    test('secretary has visitors and messages access', () => {
      const nav = getNavigationForRole('secretary')
      const allHrefs = nav.flatMap(g => g.items.map(i => i.href))
      expect(allHrefs).toContain('/dashboard/visitors')
      expect(allHrefs).toContain('/dashboard/messages')
    })

    test('dorm_master has dorm access', () => {
      const nav = getNavigationForRole('dorm_master')
      const allHrefs = nav.flatMap(g => g.items.map(i => i.href))
      expect(allHrefs).toContain('/dashboard/dorm')
      expect(allHrefs).toContain('/dashboard/dorm-attendance')
    })
  })

  describe('NavItem structure', () => {
    test('each item has required properties', () => {
      const nav = getNavigationForRole('headmaster')
      nav.forEach(group => {
        expect(group.label).toBeDefined()
        expect(group.items).toBeDefined()
        group.items.forEach(item => {
          expect(item.href).toBeDefined()
          expect(item.label).toBeDefined()
          expect(item.icon).toBeDefined()
        })
      })
    })

    test('items have valid hrefs', () => {
      const nav = getNavigationForRole('headmaster')
      nav.forEach(group => {
        group.items.forEach(item => {
          expect(item.href).toMatch(/^\/dashboard/)
        })
      })
    })
  })
})
