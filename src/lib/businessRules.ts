// Business rules and data validation for school operations

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// Student validation
export function validateStudent(student: {
  first_name?: string
  last_name?: string
  gender?: string
  date_of_birth?: string
  parent_name?: string
  parent_phone?: string
  student_number?: string
}): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!student.first_name?.trim()) {
    errors.push('First name is required')
  } else if (student.first_name.length < 2) {
    errors.push('First name must be at least 2 characters')
  }

  if (!student.last_name?.trim()) {
    errors.push('Last name is required')
  } else if (student.last_name.length < 2) {
    errors.push('Last name must be at least 2 characters')
  }

  if (!student.gender || !['M', 'F'].includes(student.gender)) {
    errors.push('Gender must be M or F')
  }

  if (student.date_of_birth) {
    const dob = new Date(student.date_of_birth)
    const age = (new Date().getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    if (age < 3 || age > 25) {
      warnings.push('Student age seems unusual (not between 3-25 years)')
    }
  }

  if (student.parent_phone) {
    const phone = student.parent_phone.replace(/[^0-9]/g, '')
    if (phone.length < 10 || phone.length > 15) {
      errors.push('Parent phone must be 10-15 digits')
    }
  } else {
    warnings.push('No parent phone provided - consider adding for SMS notifications')
  }

  return { valid: errors.length === 0, errors, warnings }
}

// Grade validation
export function validateGrade(grade: {
  student_id?: string
  subject_id?: string
  score?: number
  max_score?: number
  term?: number
  academic_year?: string
}): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!grade.student_id) errors.push('Student is required')
  if (!grade.subject_id) errors.push('Subject is required')

  if (grade.score === undefined || grade.score === null) {
    errors.push('Score is required')
  } else if (grade.score < 0) {
    errors.push('Score cannot be negative')
  } else if (grade.score > (grade.max_score || 100)) {
    errors.push(`Score cannot exceed maximum (${grade.max_score || 100})`)
  }

  if (grade.term && (grade.term < 1 || grade.term > 3)) {
    errors.push('Term must be 1, 2, or 3')
  }

  if (grade.score !== undefined && grade.max_score) {
    const percentage = (grade.score / grade.max_score) * 100
    if (percentage < 30) {
      warnings.push('Score is below 30% - student may need extra support')
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// Payment validation
export function validatePayment(payment: {
  student_id?: string
  amount_paid?: number
  payment_method?: string
  payment_date?: string
}): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!payment.student_id) errors.push('Student is required')

  if (payment.amount_paid === undefined || payment.amount_paid === null) {
    errors.push('Amount is required')
  } else if (payment.amount_paid <= 0) {
    errors.push('Amount must be positive')
  } else if (payment.amount_paid > 10000000) {
    warnings.push('Large payment amount - please verify')
  }

  if (!payment.payment_method) {
    errors.push('Payment method is required')
  } else if (!['cash', 'mobile_money', 'bank', 'installment'].includes(payment.payment_method)) {
    errors.push('Invalid payment method')
  }

  if (payment.payment_date) {
    const date = new Date(payment.payment_date)
    if (isNaN(date.getTime())) {
      errors.push('Invalid payment date')
    } else if (date > new Date()) {
      errors.push('Payment date cannot be in the future')
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// Class validation
export function validateClass(classData: {
  name?: string
  level?: string
  max_students?: number
}): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!classData.name?.trim()) {
    errors.push('Class name is required')
  }

  if (!classData.level) {
    errors.push('Level is required')
  }

  if (classData.max_students !== undefined) {
    if (classData.max_students < 1) {
      errors.push('Max students must be at least 1')
    } else if (classData.max_students > 100) {
      warnings.push('Class size over 100 students may be difficult to manage')
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// Attendance validation
export function validateAttendance(attendance: {
  student_id?: string
  class_id?: string
  date?: string
  status?: string
}): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!attendance.student_id) errors.push('Student is required')
  if (!attendance.class_id) errors.push('Class is required')
  
  if (!attendance.status || !['present', 'absent', 'late', 'excused'].includes(attendance.status)) {
    errors.push('Status must be present, absent, late, or excused')
  }

  if (attendance.date) {
    const date = new Date(attendance.date)
    if (isNaN(date.getTime())) {
      errors.push('Invalid date')
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// Fee structure validation
export function validateFeeStructure(fee: {
  name?: string
  amount?: number
  term?: number
  academic_year?: string
}): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!fee.name?.trim()) errors.push('Fee name is required')

  if (fee.amount === undefined || fee.amount === null) {
    errors.push('Amount is required')
  } else if (fee.amount <= 0) {
    errors.push('Amount must be positive')
  }

  if (fee.term && (fee.term < 1 || fee.term > 3)) {
    errors.push('Term must be 1, 2, or 3')
  }

  if (fee.amount && fee.amount > 5000000) {
    warnings.push('High fee amount - please verify')
  }

  return { valid: errors.length === 0, errors, warnings }
}

// Score calculation
export function calculateGrade(score: number, maxScore: number = 100): {
  grade: string
  points: number
  description: string
} {
  const percentage = (score / maxScore) * 100

  if (percentage >= 90) return { grade: 'A+', points: 5, description: 'Excellent' }
  if (percentage >= 80) return { grade: 'A', points: 4, description: 'Very Good' }
  if (percentage >= 70) return { grade: 'B', points: 3, description: 'Good' }
  if (percentage >= 60) return { grade: 'C', points: 2, description: 'Satisfactory' }
  if (percentage >= 50) return { grade: 'D', points: 1, description: 'Pass' }
  return { grade: 'F', points: 0, description: 'Fail' }
}

// Fee balance calculation
export function calculateFeeBalance(
  feeAmount: number,
  payments: { amount_paid: number }[]
): {
  totalPaid: number
  balance: number
  percentagePaid: number
  status: 'paid' | 'partial' | 'unpaid'
} {
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
  const balance = Math.max(0, feeAmount - totalPaid)
  const percentagePaid = feeAmount > 0 ? Math.round((totalPaid / feeAmount) * 100) : 0

  let status: 'paid' | 'partial' | 'unpaid' = 'unpaid'
  if (balance === 0) status = 'paid'
  else if (totalPaid > 0) status = 'partial'

  return { totalPaid, balance, percentagePaid, status }
}

// Age calculation
export function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

// Term date calculation (Uganda school terms)
export function getTermDates(year: number, term: number): {
  start: Date
  end: Date
} {
  const termStarts = [
    new Date(year, 1, 1),   // Term 1: Feb 1
    new Date(year, 4, 15),  // Term 2: May 15
    new Date(year, 8, 1),   // Term 3: Sep 1
  ]
  
  const termEnds = [
    new Date(year, 3, 30),  // Term 1: Apr 30
    new Date(year, 7, 15),  // Term 2: Aug 15
    new Date(year, 11, 1),  // Term 3: Dec 1
  ]

  const termIndex = term - 1
  return {
    start: termStarts[termIndex] || termStarts[0],
    end: termEnds[termIndex] || termEnds[0],
  }
}
