import type { Student, Class, User, Attendance, SMSTrigger } from '@/types'

export type FinancialAdjustmentType =
  | 'discount'
  | 'scholarship'
  | 'penalty'
  | 'manual_credit'
  | 'write_off'
  | 'bursary'

export interface FinancialAdjustmentLike {
  amount: number
  adjustment_type: FinancialAdjustmentType
}

export interface StudentFeePositionInput {
  feeTotal: number
  payments: Array<{ amount_paid: number }>
  adjustments?: FinancialAdjustmentLike[]
  openingBalance?: number
}

export interface StudentFeePosition {
  totalExpected: number
  totalPaid: number
  totalCredits: number
  totalPenalties: number
  balance: number
  status: 'paid' | 'partial' | 'unpaid' | 'written_off'
}

export interface AcademicClassLike {
  id: string
  name: string
  level?: string
  academic_year?: string
  max_students?: number
  stream?: string | null
}

export interface AcademicStudentLike {
  id: string
  class_id?: string | null
  status: Student['status']
  classes?: { name?: string | null } | null
}

export interface RolloverPreview {
  nextAcademicYear: string
  nextTerm: 1 | 2 | 3
  graduatingStudentIds: string[]
  promotableStudentIds: string[]
  entryClassNames: string[]
  clonedClasses: Array<{ from: string; to: string }>
  warnings: string[]
}

export interface PromotionCandidate {
  studentId: string
  averageScore: number
  passingThreshold: number
  currentClassName: string
}

export interface PromotionDecision {
  studentId: string
  recommendedAction: 'promote' | 'repeat'
  targetClassName: string
  reason: string
}

export interface TimetableConflict {
  teacher_id: string
  day_of_week: number
  period_number: number
  subject_name?: string | null
  class_name?: string | null
}

export interface SubstitutionAssignment {
  substitute_teacher_id: string
  date: string
  period: number
  class_name?: string | null
}

export interface SubstituteSuggestion {
  teacherId: string
  teacherName: string
  status: 'recommended' | 'busy'
  reason: string
}

export interface AttendanceAlert {
  studentId: string
  studentName: string
  parentPhone?: string
  consecutiveAbsentDays: number
  shouldSendSms: boolean
  smsMessage: string
}

export interface AuditDiffEntry {
  field: string
  before: unknown
  after: unknown
}

const CREDIT_ADJUSTMENTS = new Set<FinancialAdjustmentType>([
  'discount',
  'scholarship',
  'manual_credit',
  'write_off',
  'bursary',
])

const TERMINAL_CLASS_NAMES = ['P.7', 'P7', 'S.6', 'S6']

export function getNextClassName(name: string): string {
  const match = name.match(/([A-Z]\.?)(\d+)(.*)/)
  if (!match) return name

  const prefix = match[1].endsWith('.') ? match[1] : `${match[1]}.`
  const num = Number(match[2])
  const suffix = match[3] || ''
  return `${prefix}${num + 1}${suffix}`
}

export function isTerminalClass(name: string): boolean {
  return TERMINAL_CLASS_NAMES.some((value) => name.includes(value))
}

export function buildRolloverPreview(input: {
  academicYear: string
  currentTerm: 1 | 2 | 3
  nextAcademicYear?: string
  schoolType: 'primary' | 'secondary' | 'combined'
  students: AcademicStudentLike[]
  classes: AcademicClassLike[]
}): RolloverPreview {
  const nextAcademicYear = input.nextAcademicYear || String(Number(input.academicYear) + 1)
  const nextTerm = input.currentTerm < 3 ? ((input.currentTerm + 1) as 1 | 2 | 3) : 1
  const graduatingStudentIds = input.students
    .filter((student) => isTerminalClass(student.classes?.name || ''))
    .map((student) => student.id)
  const promotableStudentIds = input.students
    .filter((student) => student.status === 'active' && student.class_id && !isTerminalClass(student.classes?.name || ''))
    .map((student) => student.id)

  const currentYearClasses = input.classes.filter((item) => item.academic_year === input.academicYear)
  const clonedClasses = currentYearClasses
    .filter((item) => !isTerminalClass(item.name))
    .map((item) => ({ from: item.name, to: getNextClassName(item.name) }))

  const requiredEntryClasses =
    input.schoolType === 'primary'
      ? ['P.1']
      : input.schoolType === 'secondary'
        ? ['S.1']
        : ['P.1', 'S.1']

  const existingNextNames = new Set(clonedClasses.map((item) => item.to))
  const entryClassNames = requiredEntryClasses.filter((name) => !existingNextNames.has(name))

  const warnings: string[] = []
  if (input.currentTerm !== 3) {
    warnings.push('Year rollover should normally happen after Term 3 closeout.')
  }
  if (clonedClasses.length === 0) {
    warnings.push('No current-year classes were found to clone into the next academic year.')
  }

  return {
    nextAcademicYear,
    nextTerm,
    graduatingStudentIds,
    promotableStudentIds,
    entryClassNames,
    clonedClasses,
    warnings,
  }
}

export function recommendBulkPromotion(candidates: PromotionCandidate[]): PromotionDecision[] {
  return candidates.map((candidate) => {
    const passes = candidate.averageScore >= candidate.passingThreshold
    return {
      studentId: candidate.studentId,
      recommendedAction: passes ? 'promote' : 'repeat',
      targetClassName: passes ? getNextClassName(candidate.currentClassName) : candidate.currentClassName,
      reason: passes
        ? `Average ${candidate.averageScore}% meets promotion threshold ${candidate.passingThreshold}%.`
        : `Average ${candidate.averageScore}% is below promotion threshold ${candidate.passingThreshold}%.`,
    }
  })
}

export function calculateStudentFeePosition(input: StudentFeePositionInput): StudentFeePosition {
  const adjustments = input.adjustments || []
  const totalPaid = input.payments.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0)
  const totalCredits = adjustments
    .filter((item) => CREDIT_ADJUSTMENTS.has(item.adjustment_type))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const totalPenalties = adjustments
    .filter((item) => item.adjustment_type === 'penalty')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const rawExpected = Number(input.feeTotal || 0) + Number(input.openingBalance || 0) + totalPenalties - totalCredits
  const totalExpected = Math.max(0, rawExpected)
  const balance = Math.max(0, totalExpected - totalPaid)
  const hasWriteOff = adjustments.some((item) => item.adjustment_type === 'write_off')

  let status: StudentFeePosition['status'] = 'unpaid'
  if (balance === 0 && hasWriteOff) status = 'written_off'
  else if (balance === 0) status = 'paid'
  else if (totalPaid > 0 || totalCredits > 0) status = 'partial'

  return {
    totalExpected,
    totalPaid,
    totalCredits,
    totalPenalties,
    balance,
    status,
  }
}

function getIsoDayOfWeek(date: string): number {
  const jsDay = new Date(date).getDay()
  return jsDay === 0 ? 7 : jsDay
}

export function suggestAvailableSubstitutes(input: {
  teachers: Array<Pick<User, 'id' | 'full_name'>>
  absentTeacherId: string
  date: string
  period: number
  timetable: TimetableConflict[]
  substitutions: SubstitutionAssignment[]
}): SubstituteSuggestion[] {
  const dayOfWeek = getIsoDayOfWeek(input.date)

  return input.teachers
    .filter((teacher) => teacher.id !== input.absentTeacherId)
    .map((teacher) => {
      const timetableConflict = input.timetable.find(
        (entry) =>
          entry.teacher_id === teacher.id &&
          entry.day_of_week === dayOfWeek &&
          entry.period_number === input.period
      )
      if (timetableConflict) {
        return {
          teacherId: teacher.id,
          teacherName: teacher.full_name,
          status: 'busy' as const,
          reason: `Busy with ${timetableConflict.subject_name || 'another lesson'} in ${timetableConflict.class_name || 'another class'}.`,
        }
      }

      const substitutionConflict = input.substitutions.find(
        (item) => item.substitute_teacher_id === teacher.id && item.date === input.date && item.period === input.period
      )
      if (substitutionConflict) {
        return {
          teacherId: teacher.id,
          teacherName: teacher.full_name,
          status: 'busy' as const,
          reason: `Already assigned to substitute ${substitutionConflict.class_name || 'another class'}.`,
        }
      }

      return {
        teacherId: teacher.id,
        teacherName: teacher.full_name,
        status: 'recommended' as const,
        reason: 'Free for this slot based on timetable and substitution records.',
      }
    })
    .sort((a, b) => {
      if (a.status === b.status) return a.teacherName.localeCompare(b.teacherName)
      return a.status === 'recommended' ? -1 : 1
    })
}

export function detectConsecutiveAbsenceAlerts(input: {
  students: Array<Pick<Student, 'id' | 'first_name' | 'last_name' | 'parent_phone'>>
  attendance: Array<Pick<Attendance, 'student_id' | 'date' | 'status'>>
  trigger?: Pick<SMSTrigger, 'threshold_days' | 'is_active'>
}): AttendanceAlert[] {
  const threshold = input.trigger?.threshold_days || 3
  const isActive = input.trigger?.is_active ?? true
  const grouped = new Map<string, Array<Pick<Attendance, 'date' | 'status'>>>()

  input.attendance.forEach((entry) => {
    const current = grouped.get(entry.student_id) || []
    current.push({ date: entry.date, status: entry.status })
    grouped.set(entry.student_id, current)
  })

  const alerts = input.students.map((student): AttendanceAlert | null => {
      const records = (grouped.get(student.id) || []).sort((a, b) => b.date.localeCompare(a.date))
      let consecutiveAbsentDays = 0

      for (const record of records) {
        if (record.status === 'absent') consecutiveAbsentDays += 1
        else break
      }

      if (consecutiveAbsentDays < threshold) return null

      const studentName = `${student.first_name} ${student.last_name}`.trim()
      return {
        studentId: student.id,
        studentName,
        parentPhone: student.parent_phone,
        consecutiveAbsentDays,
        shouldSendSms: Boolean(isActive && student.parent_phone),
        smsMessage: `Alert: ${studentName} has missed school for ${consecutiveAbsentDays} consecutive day(s). Please contact the school.`,
      }
    })

  return alerts
    .filter((item): item is AttendanceAlert => item !== null)
    .sort((a, b) => b.consecutiveAbsentDays - a.consecutiveAbsentDays)
}

export function buildAuditDiff<T extends Record<string, unknown>>(before: T, after: T): AuditDiffEntry[] {
  const fields = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  return Array.from(fields)
    .filter((field) => JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field]))
    .map((field) => ({
      field,
      before: before?.[field],
      after: after?.[field],
    }))
}
