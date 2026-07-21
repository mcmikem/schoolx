// App-wide constants for magic strings

// User roles
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  SCHOOL_ADMIN: "school_admin",
  ADMIN: "admin",
  HEADMASTER: "headmaster",
  BOARD: "board",
  DEAN_OF_STUDIES: "dean_of_studies",
  BURSAR: "bursar",
  TEACHER: "teacher",
  SECRETARY: "secretary",
  DORM_MASTER: "dorm_master",
  STUDENT: "student",
  PARENT: "parent",
  MARKETER: "marketer",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// Student statuses
export const STUDENT_STATUS = {
  ACTIVE: "active",
  TRANSFERRED: "transferred",
  DROPPED: "dropped",
  COMPLETED: "completed",
} as const;

export type StudentStatus = (typeof STUDENT_STATUS)[keyof typeof STUDENT_STATUS];

// Attendance statuses
export const ATTENDANCE_STATUS = {
  PRESENT: "present",
  ABSENT: "absent",
  LATE: "late",
  EXCUSED: "excused",
} as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

// Event types for calendar
export const EVENT_TYPES = {
  EXAM: "exam",
  MEETING: "meeting",
  HOLIDAY: "holiday",
  EVENT: "event",
  ACADEMIC: "academic",
  SUBSTITUTION: "substitution",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// Gender
export const GENDER = {
  MALE: "M",
  FEMALE: "F",
} as const;

export type Gender = (typeof GENDER)[keyof typeof GENDER];

// Payment methods
export const PAYMENT_METHODS = {
  CASH: "cash",
  MOBILE_MONEY: "mobile_money",
  BANK: "bank",
  INSTALLMENT: "installment",
  IN_KIND: "in_kind",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

// Grade types
export const ASSESSMENT_TYPES = {
  CA1: "ca1",
  CA2: "ca2",
  CA3: "ca3",
  CA4: "ca4",
  PROJECT: "project",
  EXAM: "exam",
  COMPETENCY: "competency",
  U1: "u1",
  U2: "u2",
  EOT: "eot",
} as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[keyof typeof ASSESSMENT_TYPES];

// Terms
export const TERMS = [1, 2, 3] as const;
export type Term = (typeof TERMS)[number];
