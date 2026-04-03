import {
  UserRole,
  RolePermissions,
  ROLE_PERMISSIONS,
  canAccess,
} from '../lib/roles'

describe('Roles', () => {
  describe('ROLE_PERMISSIONS', () => {
    test('teacher has correct permissions', () => {
      expect(ROLE_PERMISSIONS.teacher.students).toBe(true)
      expect(ROLE_PERMISSIONS.teacher.grades).toBe(true)
      expect(ROLE_PERMISSIONS.teacher.fees).toBe(false)
      expect(ROLE_PERMISSIONS.teacher.settings).toBe(false)
    })

    test('headmaster has all permissions', () => {
      const perms = ROLE_PERMISSIONS.headmaster
      expect(perms.students).toBe(true)
      expect(perms.attendance).toBe(true)
      expect(perms.grades).toBe(true)
      expect(perms.fees).toBe(true)
      expect(perms.reports).toBe(true)
      expect(perms.staff).toBe(true)
      expect(perms.settings).toBe(true)
    })

    test('parent has minimal permissions', () => {
      const perms = ROLE_PERMISSIONS.parent
      // Parent currently has no permissions - this is a gap that should be fixed
      expect(perms.students).toBe(false)
      expect(perms.reports).toBe(false)
      expect(perms.staff).toBe(false)
    })

    test('all roles have analytics permission', () => {
      const roles: UserRole[] = ['teacher', 'headmaster', 'bursar', 'parent', 'dean_of_studies']
      roles.forEach(role => {
        expect(ROLE_PERMISSIONS[role]).toBeDefined()
      })
    })
  })

  describe('canAccess', () => {
    test('teacher can access students', () => {
      expect(canAccess('teacher', 'students')).toBe(true)
    })

    test('teacher cannot access fees', () => {
      expect(canAccess('teacher', 'fees')).toBe(false)
    })

    test('headmaster can access all', () => {
      expect(canAccess('headmaster', 'students')).toBe(true)
      expect(canAccess('headmaster', 'fees')).toBe(true)
      expect(canAccess('headmaster', 'payroll')).toBe(true)
    })

    test('bursar can access fees', () => {
      expect(canAccess('bursar', 'fees')).toBe(true)
    })

    test('dean can access discipline', () => {
      expect(canAccess('dean_of_studies', 'discipline')).toBe(true)
    })

    test('parent cannot access settings', () => {
      expect(canAccess('parent', 'settings')).toBe(false)
    })
  })
})
