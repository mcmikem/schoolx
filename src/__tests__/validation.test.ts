import {
  sanitizeString,
  sanitizePhone,
  sanitizeNumber,
  isValidPhone,
  isValidEmail,
  isValidDate,
  isValidScore,
} from '../lib/validation'

describe('String Sanitization', () => {
  test('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })

  test('removes HTML tags', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).not.toContain('<')
  })

  test('limits length', () => {
    const long = 'a'.repeat(1000)
    expect(sanitizeString(long).length).toBeLessThanOrEqual(500)
  })
})

describe('Phone Validation', () => {
  test('validates Ugandan phone numbers', () => {
    expect(isValidPhone('0700000000')).toBe(true)
    expect(isValidPhone('+256700000000')).toBe(true)
    expect(isValidPhone('123')).toBe(false)
  })
})

describe('Email Validation', () => {
  test('validates email format', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
  })
})

describe('Date Validation', () => {
  test('validates date format', () => {
    expect(isValidDate('2024-01-01')).toBe(true)
    expect(isValidDate('invalid')).toBe(false)
  })
})

describe('Score Validation', () => {
  test('validates score range', () => {
    expect(isValidScore(50)).toBe(true)
    expect(isValidScore(-1)).toBe(false)
    expect(isValidScore(101)).toBe(false)
  })
})
