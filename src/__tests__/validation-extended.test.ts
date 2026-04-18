import {
  isFutureDate,
  normalizeAuthPhone,
  sanitizeString,
  sanitizePhone,
  sanitizeNumber,
  isValidPhone,
  isValidEmail,
  isValidDate,
  isValidScore,
  normalizeAttendanceInput,
  normalizeFeeStructureInput,
  normalizePaymentInput,
  normalizeStudentInput,
  validateAttendanceInput,
  validateFeeStructureInput,
  validatePaymentInput,
  validateStudentInput,
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

  describe('normalizeAuthPhone', () => {
    test('normalizes local and international Uganda numbers to one auth id', () => {
      expect(normalizeAuthPhone('0700 000 000')).toBe('256700000000')
      expect(normalizeAuthPhone('+256700000000')).toBe('256700000000')
      expect(normalizeAuthPhone('700000000')).toBe('256700000000')
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

  describe('isFutureDate', () => {
    test('detects future dates', () => {
      expect(isFutureDate('2030-01-01', new Date('2026-01-01'))).toBe(true)
      expect(isFutureDate('2025-12-31', new Date('2026-01-01'))).toBe(false)
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

describe('Validation - Student Input', () => {
  describe('normalizeStudentInput', () => {
    test('normalizes names, phones, and student number', () => {
      expect(
        normalizeStudentInput({
          first_name: '  Jane ',
          last_name: ' Doe ',
          parent_name: ' Parent Name ',
          parent_phone: '+256 700 000 000',
          parent_phone2: '0700-111-222',
          student_number: ' sm 001 ',
          class_id: ' class-1 ',
          opening_balance: '15,000' as any,
        }),
      ).toEqual({
        first_name: 'Jane',
        last_name: 'Doe',
        parent_name: 'Parent Name',
        parent_phone: '+256700000000',
        parent_phone2: '0700111222',
        student_number: 'SM001',
        class_id: 'class-1',
        opening_balance: 15000,
      })
    })
  })

  describe('getErrorMessage', () => {
    test('reads messages from plain objects', () => {
      expect(getErrorMessage({ message: 'Column does not exist' })).toBe('Column does not exist')
      expect(getErrorMessage({ error: 'Permission denied' })).toBe('Permission denied')
      expect(getErrorMessage('Oops')).toBe('Oops')
    })
  })

  describe('validateStudentInput', () => {
    test('accepts a valid student payload', () => {
      expect(
        validateStudentInput({
          first_name: 'Jane',
          last_name: 'Doe',
          parent_name: 'Parent',
          parent_phone: '0700000000',
          class_id: 'class-1',
          date_of_birth: '2020-01-01',
          opening_balance: 0,
        }),
      ).toEqual([])
    })

    test('rejects future date of birth but allows negative balance for credits', () => {
      expect(
        validateStudentInput(
          {
            first_name: 'Jane',
            last_name: 'Doe',
            parent_name: 'Parent',
            parent_phone: '0700000000',
            class_id: 'class-1',
            date_of_birth: '2030-01-01',
            opening_balance: -1,
          },
          { today: new Date('2026-01-01') },
        ),
      ).toEqual(['Date of birth cannot be in the future'])
    })

    test('allows partial updates without required field errors', () => {
      expect(
        validateStudentInput(
          { student_number: 'SM001', opening_balance: 5000 },
          { partial: true },
        ),
      ).toEqual([])
    })

    test('rejects invalid phone numbers', () => {
      expect(
        validateStudentInput({
          first_name: 'Jane',
          last_name: 'Doe',
          parent_name: 'Parent',
          parent_phone: '123',
          parent_phone2: 'abc',
          class_id: 'class-1',
        }),
      ).toEqual([
        'Parent phone must be a valid phone number',
        'Alternative parent phone must be a valid phone number',
      ])
    })

    test('rejects duplicate parent phone numbers', () => {
      expect(
        validateStudentInput({
          first_name: 'Jane',
          last_name: 'Doe',
          parent_name: 'Parent',
          parent_phone: '0700000000',
          parent_phone2: '0700 000 000',
          class_id: 'class-1',
        }),
      ).toEqual([
        'Alternative parent phone must be different from the primary parent phone',
      ])
    })
  })
})

describe('Validation - Payment Input', () => {
  describe('normalizePaymentInput', () => {
    test('normalizes payment fields', () => {
      expect(
        normalizePaymentInput({
          student_id: ' student-1 ',
          amount_paid: '50,000' as any,
          payment_method: ' MOBILE_MONEY ',
          payment_reference: ' mm 123 ',
          paid_by: ' Parent Name ',
          notes: '  Paid at office ',
          payment_date: ' 2026-04-10 ',
        }),
      ).toEqual({
        student_id: 'student-1',
        amount_paid: 50000,
        payment_method: 'mobile_money',
        payment_reference: 'MM123',
        paid_by: 'Parent Name',
        notes: 'Paid at office',
        payment_date: '2026-04-10',
      })
    })
  })

  describe('validatePaymentInput', () => {
    test('accepts a valid payment payload', () => {
      expect(
        validatePaymentInput({
          student_id: 'student-1',
          amount_paid: 50000,
          payment_method: 'cash',
          payment_date: '2026-04-10',
        }),
      ).toEqual([])
    })

    test('rejects invalid payment payload', () => {
      expect(
        validatePaymentInput(
          {
            student_id: '',
            amount_paid: -1,
            payment_method: 'wire',
            payment_date: '2030-01-01',
          },
          { today: new Date('2026-01-01') },
        ),
      ).toEqual([
        'Student is required',
        'Amount must be greater than 0',
        'Payment method is invalid',
        'Payment date cannot be in the future',
      ])
    })
  })
})

describe('Validation - Attendance Input', () => {
  describe('normalizeAttendanceInput', () => {
    test('normalizes attendance fields', () => {
      expect(
        normalizeAttendanceInput({
          student_id: ' student-1 ',
          class_id: ' class-1 ',
          status: ' PRESENT ',
          date: ' 2026-04-10 ',
          recorded_by: ' user-1 ',
        }),
      ).toEqual({
        student_id: 'student-1',
        class_id: 'class-1',
        status: 'present',
        date: '2026-04-10',
        recorded_by: 'user-1',
      })
    })
  })

  describe('validateAttendanceInput', () => {
    test('accepts a valid attendance payload', () => {
      expect(
        validateAttendanceInput({
          student_id: 'student-1',
          class_id: 'class-1',
          status: 'present',
          date: '2026-04-10',
        }),
      ).toEqual([])
    })

    test('rejects invalid attendance payload', () => {
      expect(
        validateAttendanceInput(
          {
            student_id: '',
            class_id: '',
            status: 'unknown',
            date: '2030-01-01',
          },
          { today: new Date('2026-01-01') },
        ),
      ).toEqual([
        'Student is required',
        'Class is required',
        'Attendance status is invalid',
        'Attendance date cannot be in the future',
      ])
    })
  })
})

describe('Validation - Fee Structure Input', () => {
  describe('normalizeFeeStructureInput', () => {
    test('normalizes fee structure fields', () => {
      expect(
        normalizeFeeStructureInput({
          name: ' Tuition ',
          class_id: ' class-1 ',
          amount: '150,000' as any,
          term: 1,
          academic_year: ' 2026 ',
          due_date: ' 2026-05-01 ',
        }),
      ).toEqual({
        name: 'Tuition',
        class_id: 'class-1',
        amount: 150000,
        term: 1,
        academic_year: '2026',
        due_date: '2026-05-01',
      })
    })
  })

  describe('validateFeeStructureInput', () => {
    test('accepts a valid fee structure payload', () => {
      expect(
        validateFeeStructureInput({
          name: 'Tuition',
          amount: 150000,
          term: 1,
          academic_year: '2026',
          due_date: '2026-05-01',
        }),
      ).toEqual([])
    })

    test('rejects invalid fee structure payload', () => {
      expect(
        validateFeeStructureInput({
          name: '',
          amount: -10,
          term: 4,
          academic_year: '',
          due_date: 'not-a-date',
        }),
      ).toEqual([
        'Fee name is required',
        'Amount must be greater than 0',
        'Term must be 1, 2, or 3',
        'Academic year is required',
        'Due date must be a valid date',
      ])
    })
  })
})
