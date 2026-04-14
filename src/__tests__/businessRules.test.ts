import {
  validateStudent,
  validateGrade,
  validatePayment,
  validateClass,
  validateAttendance,
  validateFeeStructure,
  calculateGrade,
  calculateFeeBalance,
  calculateAge,
  getTermDates,
} from '../lib/businessRules'

describe('Student Validation', () => {
  test('validates required fields', () => {
    const result = validateStudent({})
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('First name is required')
    expect(result.errors).toContain('Last name is required')
    expect(result.errors).toContain('Gender must be M or F')
  })

  test('validates complete student', () => {
    const result = validateStudent({
      first_name: 'John',
      last_name: 'Doe',
      gender: 'M',
      parent_phone: '0700000000',
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('warns about unusual age', () => {
    const result = validateStudent({
      first_name: 'John',
      last_name: 'Doe',
      gender: 'M',
      date_of_birth: '2000-01-01', // 26 years old
    })
    expect(result.warnings).toContain('Student age seems unusual (not between 3-25 years)')
  })
})

describe('Grade Validation', () => {
  test('validates required fields', () => {
    const result = validateGrade({})
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Student is required')
    expect(result.errors).toContain('Subject is required')
    expect(result.errors).toContain('Score is required')
  })

  test('validates score range', () => {
    const result = validateGrade({
      student_id: '1',
      subject_id: '1',
      score: 150,
      max_score: 100,
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Score cannot exceed maximum (100)')
  })

  test('warns about low score', () => {
    const result = validateGrade({
      student_id: '1',
      subject_id: '1',
      score: 20,
      max_score: 100,
    })
    expect(result.warnings).toContain('Score is below 30% - student may need extra support')
  })
})

describe('Payment Validation', () => {
  test('validates required fields', () => {
    const result = validatePayment({})
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Student is required')
    expect(result.errors).toContain('Amount is required')
    expect(result.errors).toContain('Payment method is required')
  })

  test('validates positive amount', () => {
    const result = validatePayment({
      student_id: '1',
      amount_paid: -100,
      payment_method: 'cash',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Amount must be positive')
  })

  test('valid payment passes', () => {
    const result = validatePayment({
      student_id: '1',
      amount_paid: 50000,
      payment_method: 'mobile_money',
    })
    expect(result.valid).toBe(true)
  })
})

describe('Grade Calculation', () => {
  test('calculates A+ for 90+', () => {
    const result = calculateGrade(95)
    expect(result.grade).toBe('A+')
    expect(result.points).toBe(5)
  })

  test('calculates F for below 50', () => {
    const result = calculateGrade(40)
    expect(result.grade).toBe('F')
    expect(result.points).toBe(0)
  })
})

describe('Fee Balance', () => {
  test('calculates correct balance', () => {
    const result = calculateFeeBalance(100000, [{ amount_paid: 60000 }])
    expect(result.totalPaid).toBe(60000)
    expect(result.balance).toBe(40000)
    expect(result.status).toBe('partial')
  })

  test('marks as paid when balance is zero', () => {
    const result = calculateFeeBalance(100000, [{ amount_paid: 100000 }])
    expect(result.balance).toBe(0)
    expect(result.status).toBe('paid')
  })
})

describe('Age Calculation', () => {
  test('calculates correct age', () => {
    const birthDate = new Date()
    birthDate.setFullYear(birthDate.getFullYear() - 10)
    const age = calculateAge(birthDate.toISOString().split('T')[0])
    expect(age).toBe(10)
  })

  test('handles birthday not yet passed this year', () => {
    const birthDate = new Date()
    birthDate.setFullYear(birthDate.getFullYear() - 10)
    birthDate.setMonth(11) // December
    birthDate.setDate(31)
    const age = calculateAge(birthDate.toISOString().split('T')[0])
    expect(age).toBe(9)
  })
})

describe('Class Validation', () => {
  test('validates required fields', () => {
    const result = validateClass({})
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Class name is required')
    expect(result.errors).toContain('Level is required')
  })

  test('validates class with all fields', () => {
    const result = validateClass({
      name: 'P.1',
      level: 'primary',
      max_students: 40,
    })
    expect(result.valid).toBe(true)
  })

  test('warns about large class size', () => {
    const result = validateClass({
      name: 'P.1',
      level: 'primary',
      max_students: 150,
    })
    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('Class size over 100 students may be difficult to manage')
  })

  test('rejects invalid max students', () => {
    const result = validateClass({
      name: 'P.1',
      level: 'primary',
      max_students: 0,
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Max students must be at least 1')
  })
})

describe('Attendance Validation', () => {
  test('validates required fields', () => {
    const result = validateAttendance({})
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Student is required')
    expect(result.errors).toContain('Class is required')
  })

  test('validates valid attendance', () => {
    const result = validateAttendance({
      student_id: '1',
      class_id: '1',
      status: 'present',
      date: '2024-01-01',
    })
    expect(result.valid).toBe(true)
  })

  test('rejects invalid status', () => {
    const result = validateAttendance({
      student_id: '1',
      class_id: '1',
      status: 'invalid',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Status must be present, absent, late, or excused')
  })

  test('rejects invalid date', () => {
    const result = validateAttendance({
      student_id: '1',
      class_id: '1',
      status: 'present',
      date: 'not-a-date',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid date')
  })
})

describe('Fee Structure Validation', () => {
  test('validates required fields', () => {
    const result = validateFeeStructure({})
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Fee name is required')
    expect(result.errors).toContain('Amount is required')
  })

  test('validates valid fee structure', () => {
    const result = validateFeeStructure({
      name: 'Tuition',
      amount: 50000,
      term: 1,
      academic_year: '2024',
    })
    expect(result.valid).toBe(true)
  })

  test('rejects negative amount', () => {
    const result = validateFeeStructure({
      name: 'Tuition',
      amount: -5000,
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Amount must be positive')
  })

  test('rejects invalid term', () => {
    const result = validateFeeStructure({
      name: 'Tuition',
      amount: 50000,
      term: 4,
      academic_year: '2024',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Term must be 1, 2, or 3')
  })

  test('requires academic year', () => {
    const result = validateFeeStructure({
      name: 'Tuition',
      amount: 50000,
      term: 1,
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Academic year is required')
  })

  test('rejects invalid due date', () => {
    const result = validateFeeStructure({
      name: 'Tuition',
      amount: 50000,
      term: 1,
      academic_year: '2024',
      due_date: 'not-a-date',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid due date')
  })

  test('warns about high fee amount', () => {
    const result = validateFeeStructure({
      name: 'Tuition',
      amount: 10000000,
      academic_year: '2024',
    })
    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('High fee amount - please verify')
  })
})

describe('Term Dates', () => {
  test('returns correct term 1 dates', () => {
    const result = getTermDates(2024, 1)
    expect(result.start.getMonth()).toBe(1) // February
    expect(result.end.getMonth()).toBe(3) // April
  })

  test('returns correct term 2 dates', () => {
    const result = getTermDates(2024, 2)
    expect(result.start.getMonth()).toBe(4) // May
    expect(result.end.getMonth()).toBe(7) // August
  })

  test('returns correct term 3 dates', () => {
    const result = getTermDates(2024, 3)
    expect(result.start.getMonth()).toBe(8) // September
    expect(result.end.getMonth()).toBe(11) // December
  })
})
