// Automation utilities for SchoolX
// Auto-grade computation, UNEB division calculation, report card generation, etc.

import {
  getPLEGrade,
  getPLEDivision,
  getUCEGrade,
  getUCEDivision,
  getUACEGrade,
  getUACEPoints,
  SchoolLevel,
} from '@/lib/grading'

// ============================================
// AUTO-GRADE COMPUTATION
// ============================================

export function computeSubjectTotal(ca1: number, ca2: number, ca3: number, ca4: number, project: number, exam: number): {
  totalCA: number
  finalScore: number
  grade: string
  gradeLabel: string
} {
  const totalCA = (ca1 + ca2 + ca3 + ca4 + project) / 5
  const finalScore = Math.round(totalCA * 0.25 + exam * 0.75)
  const grade = getPLEGrade(finalScore)
  const gradeLabel = getGradeLabel(finalScore)

  return { totalCA, finalScore, grade, gradeLabel }
}

export function computePLEAggregate(subjectScores: number[]): {
  aggregate: number
  division: string
  best4: number[]
} {
  // Best 4 subjects for PLE
  const sorted = [...subjectScores].sort((a, b) => a - b)
  const best4 = sorted.slice(0, 4)
  const aggregate = best4.reduce((sum, s) => sum + s, 0)
  const division = getPLEDivision(aggregate)

  return { aggregate, division, best4 }
}

export function computeUCEDivision(subjectGrades: string[]): string {
  return getUCEDivision(subjectGrades)
}

export function computeUACEResult(
  principalScores: number[],
  subsidiaryScores: number[]
): {
  principalGrades: string[]
  subsidiaryGrades: string[]
  points: number
  division: string
} {
  const principalGrades = principalScores.map(s => getUACEGrade(s))
  const subsidiaryGrades = subsidiaryScores.map(s => getUACEGrade(s))
  const { points, division } = getUACEPoints(principalGrades, subsidiaryGrades)

  return { principalGrades, subsidiaryGrades, points, division }
}

export function getGradeLabel(score: number): string {
  if (score >= 80) return 'Distinction'
  if (score >= 70) return 'Very Good'
  if (score >= 65) return 'Good'
  if (score >= 60) return 'Credit'
  if (score >= 55) return 'Satisfactory'
  if (score >= 50) return 'Pass'
  if (score >= 45) return 'Below Average'
  if (score >= 40) return 'Poor'
  return 'Fail'
}

export function generateAutoComment(score: number, subject: string, studentName: string): string {
  const name = studentName.split(' ')[0] // First name only
  const comments: Record<string, string[]> = {
    excellent: [
      `${name} has shown outstanding performance in ${subject}. Keep it up!`,
      `Excellent work in ${subject}. ${name} is a role model to peers.`,
      `${name} demonstrates exceptional understanding of ${subject}.`,
    ],
    veryGood: [
      `${name} has performed very well in ${subject}. Well done!`,
      `Good effort in ${subject}. ${name} should maintain this standard.`,
      `${name} shows strong grasp of ${subject} concepts.`,
    ],
    good: [
      `${name} has shown good progress in ${subject}.`,
      `Satisfactory performance in ${subject}. ${name} can do better with more effort.`,
      `${name} is doing well in ${subject} but needs to be more consistent.`,
    ],
    average: [
      `${name} needs to put more effort in ${subject}.`,
      `Average performance in ${subject}. ${name} should seek help when needed.`,
      `${name} has potential in ${subject} but needs to work harder.`,
    ],
    poor: [
      `${name} is struggling in ${subject}. Extra support is needed.`,
      `Poor performance in ${subject}. ${name} should attend remedial classes.`,
      `${name} needs significant improvement in ${subject}.`,
    ],
    fail: [
      `${name} has failed in ${subject}. Immediate intervention required.`,
      `Very poor performance in ${subject}. ${name} needs urgent academic support.`,
      `${name} is at risk in ${subject}. Parent-teacher meeting recommended.`,
    ],
  }

  let category: string
  if (score >= 80) category = 'excellent'
  else if (score >= 70) category = 'veryGood'
  else if (score >= 60) category = 'good'
  else if (score >= 50) category = 'average'
  else if (score >= 40) category = 'poor'
  else category = 'fail'

  const options = comments[category]
  return options[Math.floor(Math.random() * options.length)]
}

// ============================================
// FEE AUTOMATION
// ============================================

export function computeFeeBalance(totalFees: number, totalPaid: number): {
  balance: number
  percentagePaid: number
  status: 'paid' | 'partial' | 'unpaid' | 'overpaid'
} {
  const balance = totalFees - totalPaid
  const percentagePaid = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0
  let status: 'paid' | 'partial' | 'unpaid' | 'overpaid'

  if (balance <= 0 && totalPaid > totalFees) status = 'overpaid'
  else if (balance <= 0) status = 'paid'
  else if (totalPaid > 0) status = 'partial'
  else status = 'unpaid'

  return { balance, percentagePaid, status }
}

export function generateReceiptNumber(schoolCode: string, studentId: string): string {
  const date = new Date()
  const dateStr = date.getFullYear().toString().slice(2) +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0')
  const timeStr = String(date.getHours()).padStart(2, '0') +
    String(date.getMinutes()).padStart(2, '0') +
    String(date.getSeconds()).padStart(2, '0')

  return `${schoolCode || 'SCH'}-${dateStr}-${timeStr}-${studentId.slice(0, 4).toUpperCase()}`
}

// ============================================
// ATTENDANCE AUTOMATION
// ============================================

export function computeAttendanceStats(records: { status: string }[]): {
  present: number
  absent: number
  late: number
  total: number
  rate: number
} {
  const present = records.filter(r => r.status === 'present').length
  const absent = records.filter(r => r.status === 'absent').length
  const late = records.filter(r => r.status === 'late').length
  const total = records.length
  const rate = total > 0 ? Math.round((present / total) * 100) : 0

  return { present, absent, late, total, rate }
}

export function identifyAtRiskStudents(
  students: Array<{ id: string; name: string; attendanceRate: number; avgScore: number; feeBalance: number }>,
  thresholds: { attendanceMin: number; scoreMin: number; feeMax: number } = {
    attendanceMin: 70,
    scoreMin: 40,
    feeMax: 500000,
  }
): Array<{ id: string; name: string; risks: string[] }> {
  return students
    .map(student => {
      const risks: string[] = []
      if (student.attendanceRate < thresholds.attendanceMin) risks.push('low_attendance')
      if (student.avgScore < thresholds.scoreMin) risks.push('low_grades')
      if (student.feeBalance > thresholds.feeMax) risks.push('fee_arrears')
      return risks.length > 0 ? { id: student.id, name: student.name, risks } : null
    })
    .filter(Boolean) as Array<{ id: string; name: string; risks: string[] }>
}

// ============================================
// PAYROLL AUTOMATION (Uganda)
// ============================================

export function computeNSSF(grossSalary: number): { employee: number; employer: number; total: number } {
  // NSSF: 5% employee, 10% employer (Uganda)
  const employee = Math.round(grossSalary * 0.05)
  const employer = Math.round(grossSalary * 0.10)
  return { employee, employer, total: employee + employer }
}

export function computePAYE(grossSalary: number): number {
  // Uganda PAYE brackets (2024)
  // First UGX 235,000: 0%
  // Next UGX 235,000 - 1,000,000: 10%
  // Above UGX 1,000,000: 30%
  const threshold1 = 235000
  const threshold2 = 1000000

  if (grossSalary <= threshold1) return 0

  let tax = 0
  const taxable2 = Math.min(grossSalary, threshold2) - threshold1
  tax += taxable2 * 0.10

  if (grossSalary > threshold2) {
    tax += (grossSalary - threshold2) * 0.30
  }

  return Math.round(tax)
}

export function computeNetSalary(grossSalary: number, allowances: number = 0, deductions: number = 0): {
  gross: number
  nssf_employee: number
  paye: number
  other_deductions: number
  net: number
} {
  const totalGross = grossSalary + allowances
  const nssf = computeNSSF(grossSalary)
  const paye = computePAYE(totalGross - nssf.employee)

  return {
    gross: totalGross,
    nssf_employee: nssf.employee,
    paye,
    other_deductions: deductions,
    net: totalGross - nssf.employee - paye - deductions,
  }
}

// ============================================
// PROMOTION AUTOMATION
// ============================================

export function checkPromotionEligibility(
  studentGrades: number[],
  attendanceRate: number,
  thresholds: { minAverage: number; minAttendance: number } = { minAverage: 40, minAttendance: 60 }
): { eligible: boolean; reason: string } {
  const average = studentGrades.length > 0
    ? studentGrades.reduce((sum, g) => sum + g, 0) / studentGrades.length
    : 0

  if (average < thresholds.minAverage) {
    return { eligible: false, reason: `Average score ${average.toFixed(1)}% below minimum ${thresholds.minAverage}%` }
  }
  if (attendanceRate < thresholds.minAttendance) {
    return { eligible: false, reason: `Attendance ${attendanceRate}% below minimum ${thresholds.minAttendance}%` }
  }

  return { eligible: true, reason: 'Meets all promotion criteria' }
}

// ============================================
// TERM DATE AUTOMATION
// ============================================

export function getCurrentTerm(): { term: number; year: number } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12

  // Uganda school terms (approximate)
  // Term 1: Feb - May
  // Term 2: Jun - Aug
  // Term 3: Sep - Nov
  let term = 1
  if (month >= 2 && month <= 5) term = 1
  else if (month >= 6 && month <= 8) term = 2
  else if (month >= 9 && month <= 11) term = 3
  else term = 1 // Dec-Jan is holiday, default to Term 1 of next year

  if (month === 12 || month === 1) {
    return { term: 3, year: month === 1 ? year - 1 : year }
  }

  return { term, year }
}

export function getTermDates(year: number): Array<{ term: number; start: string; end: string }> {
  return [
    { term: 1, start: `${year}-02-05`, end: `${year}-05-10` },
    { term: 2, start: `${year}-06-03`, end: `${year}-08-15` },
    { term: 3, start: `${year}-09-02`, end: `${year}-11-15` },
  ]
}
