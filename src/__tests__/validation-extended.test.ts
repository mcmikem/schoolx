import {
  sanitizeString,
  sanitizePhone,
  sanitizeNumber,
  isValidPhone,
  isValidEmail,
  isValidDate,
  isValidScore,
} from '../lib/validation'

describe('Validation - String Sanitization', () => {
  describe('sanitizeString', () => {
    test('trims whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello')
    })

    test('removes HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain('<')
      expect(sanitizeString('<div>test</div>')).toBe('test')
    })

    test('handles nested HTML', () => {
      expect(sanitizeString('<p><em>text</em></p>')).toBe('text')
    })

    test('limits length to 500 characters', () => {
      const long = 'a'.repeat(1000)
      expect(sanitizeString(long).length).toBe(500)
    })

    test('handles empty input', () => {
      expect(sanitizeString('')).toBe('')
    })

    test('handles null/undefined', () => {
      expect(sanitizeString(null as any)).toBe('')
      expect(sanitizeString(undefined as any)).toBe('')
    })
  })

  describe('sanitizePhone', () => {
    test('removes non-numeric characters', () => {
      expect(sanitizePhone('0700-000-000')).toBe('0700000000')
      expect(sanitizePhone('+256 700 000 000')).toBe('+256700000000')
    })

    test('handles empty input', () => {
      expect(sanitizePhone('')).toBe('')
    })
  })

  describe('sanitizeNumber', () => {
    test('removes non-numeric except decimal and minus', () => {
      expect(sanitizeNumber('123.45')).toBe('123.45')
      expect(sanitizeNumber('-100')).toBe('-100')
      expect(sanitizeNumber('$1,000')).toBe('1000')
    })
  })
})

describe('Validation - Phone Validation', () => {
  describe('isValidPhone', () => {
    test('validates Ugandan phone numbers', () => {
      expect(isValidPhone('0700000000')).toBe(true)
      expect(isValidPhone('0772000000')).toBe(true)
      expect(isValidPhone('+256700000000')).toBe(true)
    })

    test('rejects invalid phone numbers', () => {
      expect(isValidPhone('123')).toBe(false)
      expect(isValidPhone('0700')).toBe(false)
      expect(isValidPhone('')).toBe(false)
    })
  })
})

describe('Validation - Email Validation', () => {
  describe('isValidEmail', () => {
    test('validates correct email format', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
      expect(isValidEmail('user+tag@example.org')).toBe(true)
    })

    test('rejects invalid email format', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('@domain.com')).toBe(false)
      expect(isValidEmail('test @domain.com')).toBe(false)
    })
  })
})

describe('Validation - Date Validation', () => {
  describe('isValidDate', () => {
    test('validates ISO date format', () => {
      expect(isValidDate('2024-01-01')).toBe(true)
      expect(isValidDate('2024-12-31')).toBe(true)
    })

    test('validates date strings', () => {
      expect(isValidDate('January 1, 2024')).toBe(true)
      expect(isValidDate('2024/01/01')).toBe(true)
    })

    test('rejects invalid dates', () => {
      expect(isValidDate('invalid')).toBe(false)
      expect(isValidDate('')).toBe(false)
      expect(isValidDate('not-a-date')).toBe(false)
    })
  })
})

describe('Validation - Score Validation', () => {
  describe('isValidScore', () => {
    test('validates score within default range', () => {
      expect(isValidScore(0)).toBe(true)
      expect(isValidScore(50)).toBe(true)
      expect(isValidScore(100)).toBe(true)
    })

    test('rejects negative scores', () => {
      expect(isValidScore(-1)).toBe(false)
    })

    test('rejects scores above max', () => {
      expect(isValidScore(101)).toBe(false)
      expect(isValidScore(200, 100)).toBe(false)
    })

    test('respects custom max score', () => {
      expect(isValidScore(50, 50)).toBe(true)
      expect(isValidScore(75, 50)).toBe(false)
    })
  })
})
