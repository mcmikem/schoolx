import {
  validateStudent,
  validateGrade,
  validatePayment,
  validateClass,
  calculateGrade,
  calculateFeeBalance,
  calculateAge,
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
})
