// App-wide constants for magic strings

// User roles
export const ROLES = {
  HEADMASTER: 'headmaster',
  DEAN_OF_STUDIES: 'dean_of_studies',
  SCHOOL_ADMIN: 'school_admin',
  TEACHER: 'teacher',
  SUPER_ADMIN: 'super_admin',
  BURSAR: 'bursar',
  PARENT: 'parent',
} as const

export type UserRole = typeof ROLES[keyof typeof ROLES]

// Student statuses
export const STUDENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  TRANSFERRED: 'transferred',
  GRADUATED: 'graduated',
  DROPPED_OUT: 'dropped_out',
} as const

export type StudentStatus = typeof STUDENT_STATUS[keyof typeof STUDENT_STATUS]

// Attendance statuses
export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
} as const

export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS]

// Event types for calendar
export const EVENT_TYPES = {
  EXAM: 'exam',
  MEETING: 'meeting',
  HOLIDAY: 'holiday',
  EVENT: 'event',
  ACADEMIC: 'academic',
} as const

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES]

// Gender
export const GENDER = {
  MALE: 'M',
  FEMALE: 'F',
} as const

export type Gender = typeof GENDER[keyof typeof GENDER]

// Payment methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  MOBILE_MONEY: 'mobile_money',
  BANK_TRANSFER: 'bank_transfer',
  CHEQUE: 'cheque',
} as const

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS]

// Grade types
export const ASSESSMENT_TYPES = {
  CA1: 'ca1',
  CA2: 'ca2',
  CA3: 'ca3',
  EXAM: 'exam',
} as const

export type AssessmentType = typeof ASSESSMENT_TYPES[keyof typeof ASSESSMENT_TYPES]

// Terms
export const TERMS = [1, 2, 3] as const
export type Term = typeof TERMS[number]