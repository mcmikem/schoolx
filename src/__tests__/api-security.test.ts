import {
  sanitizeRequestBody,
  sanitizeQueryParams,
  validateUUID,
  sanitizeForSQL,
} from '../lib/api-security'

describe('API Security', () => {
  describe('sanitizeRequestBody', () => {
    test('sanitizes phone numbers', () => {
      const result = sanitizeRequestBody({ phone: '+256 700 000 000' }, ['phone'])
      expect(result.body.phone).toBe('+256700000000')
      expect(result.errors).toHaveLength(0)
    })

    test('rejects invalid phone', () => {
      const result = sanitizeRequestBody({ phone: '123' }, ['phone'])
      expect(result.errors).toContain('Invalid phone number: phone')
    })

    test('sanitizes strings', () => {
      const result = sanitizeRequestBody({ name: '<script>alert(1)</script>John' }, ['name'])
      expect(result.body.name).toBe('alert(1)John')
      expect(result.errors).toHaveLength(0)
    })

    test('reports missing fields', () => {
      const result = sanitizeRequestBody({ name: 'John' }, ['name', 'email'])
      expect(result.errors).toContain('Missing required field: email')
    })

    test('validates email', () => {
      const result = sanitizeRequestBody({ email: 'test@example.com' }, ['email'])
      expect(result.errors).toHaveLength(0)
    })

    test('rejects invalid email', () => {
      const result = sanitizeRequestBody({ email: 'not-an-email' }, ['email'])
      expect(result.errors).toContain('Invalid email: email')
    })
  })

  describe('validateUUID', () => {
    test('validates correct UUID', () => {
      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    })

    test('rejects invalid UUID', () => {
      expect(validateUUID('not-a-uuid')).toBe(false)
      expect(validateUUID('123')).toBe(false)
    })
  })

  describe('sanitizeForSQL', () => {
    test('removes SQL injection characters', () => {
      expect(sanitizeForSQL("test'; DROP TABLE users")).toBe('test DROP TABLE users')
      expect(sanitizeForSQL('test"test')).toBe('testtest')
      expect(sanitizeForSQL('test\\backslash')).toBe('testbackslash')
      expect(sanitizeForSQL('test;')).toBe('test')
    })

    test('allows safe strings', () => {
      expect(sanitizeForSQL('normal string')).toBe('normal string')
    })
  })
})
