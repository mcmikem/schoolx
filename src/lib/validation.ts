import type { CreateStudentInput, Student } from "@/types";

// Input sanitization and validation utilities

export function sanitizeString(input: string): string {
  if (!input) return ''
  return input
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 500)
}

export function sanitizePhone(input: string): string {
  if (!input) return ''
  return input.replace(/[^0-9+]/g, '')
}

export function normalizeAuthPhone(input: string): string {
  const digits = sanitizePhone(input).replace(/[^0-9]/g, '')

  if (digits.length === 9) return `256${digits}`
  if (digits.startsWith('0') && digits.length === 10) {
    return `256${digits.slice(1)}`
  }

  return digits
}

export function sanitizeNumber(input: string): string {
  if (!input) return ''
  return input.replace(/[^0-9.-]/g, '')
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '')
  return cleaned.length >= 10 && cleaned.length <= 15
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidDate(date: string): boolean {
  const parsed = new Date(date)
  return !isNaN(parsed.getTime())
}

export function isFutureDate(date: string, today = new Date()): boolean {
  if (!isValidDate(date)) return false
  const inputDate = new Date(date)
  const comparisonDate = new Date(today)
  inputDate.setHours(0, 0, 0, 0)
  comparisonDate.setHours(0, 0, 0, 0)
  return inputDate.getTime() > comparisonDate.getTime()
}

export function isValidScore(score: number, maxScore = 100): boolean {
  return score >= 0 && score <= maxScore
}

type StudentMutationInput = Partial<CreateStudentInput> &
  Partial<
    Pick<
      Student,
      | "first_name"
      | "last_name"
      | "parent_name"
      | "parent_phone"
      | "parent_phone2"
      | "student_number"
      | "date_of_birth"
      | "opening_balance"
      | "photo_url"
      | "class_id"
    >
  >

export function normalizeStudentInput<T extends StudentMutationInput>(
  input: T,
): T {
  const normalized = { ...input } as T

  if ("first_name" in normalized && typeof normalized.first_name === "string") {
    normalized.first_name = sanitizeString(normalized.first_name) as T["first_name"]
  }
  if ("last_name" in normalized && typeof normalized.last_name === "string") {
    normalized.last_name = sanitizeString(normalized.last_name) as T["last_name"]
  }
  if ("parent_name" in normalized && typeof normalized.parent_name === "string") {
    normalized.parent_name = sanitizeString(normalized.parent_name) as T["parent_name"]
  }
  if ("parent_phone" in normalized && typeof normalized.parent_phone === "string") {
    normalized.parent_phone = sanitizePhone(normalized.parent_phone) as T["parent_phone"]
  }
  if ("parent_phone2" in normalized && typeof normalized.parent_phone2 === "string") {
    const cleanedPhone = sanitizePhone(normalized.parent_phone2)
    normalized.parent_phone2 = (cleanedPhone || undefined) as T["parent_phone2"]
  }
  if ("student_number" in normalized && typeof normalized.student_number === "string") {
    const cleanedNumber = sanitizeString(normalized.student_number)
      .replace(/\s+/g, "")
      .toUpperCase()
    normalized.student_number = (cleanedNumber || undefined) as T["student_number"]
  }
  if ("date_of_birth" in normalized && typeof normalized.date_of_birth === "string") {
    normalized.date_of_birth = (
      normalized.date_of_birth.trim() || undefined
    ) as T["date_of_birth"]
  }
  if ("class_id" in normalized && typeof normalized.class_id === "string") {
    normalized.class_id = normalized.class_id.trim() as T["class_id"]
  }
  if ("photo_url" in normalized && typeof normalized.photo_url === "string") {
    normalized.photo_url = sanitizeString(normalized.photo_url) as T["photo_url"]
  }
  if ("opening_balance" in normalized) {
    const rawValue = normalized.opening_balance
    if (typeof rawValue === "string") {
      const parsed = Number(sanitizeNumber(rawValue))
      normalized.opening_balance = (
        Number.isFinite(parsed) ? parsed : 0
      ) as T["opening_balance"]
    }
  }

  return normalized
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong",
): string {
  if (error instanceof Error && error.message) return error.message

  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage
    }

    const maybeError = (error as { error?: unknown }).error
    if (typeof maybeError === "string" && maybeError.trim()) {
      return maybeError
    }
  }

  if (typeof error === "string" && error.trim()) return error
  return fallback
}

export function validateStudentInput(
  input: StudentMutationInput,
  options?: { partial?: boolean; today?: Date },
): string[] {
  const errors: string[] = []
  const partial = options?.partial ?? false

  const requiredStringFields: Array<[keyof StudentMutationInput, string]> = [
    ["first_name", "First name is required"],
    ["last_name", "Last name is required"],
    ["parent_name", "Parent/Guardian name is required"],
    ["parent_phone", "Parent phone is required"],
    ["class_id", "Class is required"],
  ]

  for (const [field, message] of requiredStringFields) {
    const value = input[field]
    if (!partial && (!value || (typeof value === "string" && !value.trim()))) {
      errors.push(message)
    }
  }

  if (
    "parent_phone" in input &&
    input.parent_phone &&
    !isValidPhone(input.parent_phone)
  ) {
    errors.push("Parent phone must be a valid phone number")
  }

  if (
    "parent_phone2" in input &&
    input.parent_phone2 &&
    !isValidPhone(input.parent_phone2)
  ) {
    errors.push("Alternative parent phone must be a valid phone number")
  }

  if (
    input.parent_phone &&
    input.parent_phone2 &&
    sanitizePhone(input.parent_phone) === sanitizePhone(input.parent_phone2)
  ) {
    errors.push("Alternative parent phone must be different from the primary parent phone")
  }

  if ("date_of_birth" in input && input.date_of_birth) {
    if (!isValidDate(input.date_of_birth)) {
      errors.push("Date of birth must be a valid date")
    } else if (isFutureDate(input.date_of_birth, options?.today)) {
      errors.push("Date of birth cannot be in the future")
    }
  }

  if ("opening_balance" in input && input.opening_balance !== undefined) {
    if (
      typeof input.opening_balance !== "number" ||
      !Number.isFinite(input.opening_balance)
    ) {
      errors.push("Opening balance must be a valid number")
    }
  }

  return errors
}

type PaymentMutationInput = {
  student_id?: string
  amount_paid?: number | string
  payment_method?: string
  payment_reference?: string
  paid_by?: string
  notes?: string
  payment_date?: string
}

const VALID_PAYMENT_METHODS = new Set([
  "cash",
  "mobile_money",
  "bank",
  "installment",
])

const VALID_ATTENDANCE_STATUSES = new Set([
  "present",
  "absent",
  "late",
  "excused",
])

export function normalizePaymentInput<T extends PaymentMutationInput>(input: T): T {
  const normalized = { ...input } as T

  if ("student_id" in normalized && typeof normalized.student_id === "string") {
    normalized.student_id = normalized.student_id.trim() as T["student_id"]
  }
  if (
    "payment_method" in normalized &&
    typeof normalized.payment_method === "string"
  ) {
    normalized.payment_method = normalized.payment_method
      .trim()
      .toLowerCase() as T["payment_method"]
  }
  if (
    "payment_reference" in normalized &&
    typeof normalized.payment_reference === "string"
  ) {
    const cleaned = sanitizeString(normalized.payment_reference)
      .replace(/\s+/g, "")
      .toUpperCase()
    normalized.payment_reference = (cleaned || undefined) as T["payment_reference"]
  }
  if ("paid_by" in normalized && typeof normalized.paid_by === "string") {
    normalized.paid_by = (sanitizeString(normalized.paid_by) ||
      undefined) as T["paid_by"]
  }
  if ("notes" in normalized && typeof normalized.notes === "string") {
    normalized.notes = (sanitizeString(normalized.notes) ||
      undefined) as T["notes"]
  }
  if ("payment_date" in normalized && typeof normalized.payment_date === "string") {
    normalized.payment_date = (
      normalized.payment_date.trim() || undefined
    ) as T["payment_date"]
  }
  if ("amount_paid" in normalized) {
    const rawValue = normalized.amount_paid
    if (typeof rawValue === "string") {
      const parsed = Number(sanitizeNumber(rawValue))
      normalized.amount_paid = (Number.isFinite(parsed) ? parsed : NaN) as T["amount_paid"]
    }
  }

  return normalized
}

export function validatePaymentInput(
  input: PaymentMutationInput,
  options?: { today?: Date },
): string[] {
  const errors: string[] = []

  if (!input.student_id?.trim()) {
    errors.push("Student is required")
  }

  if (input.amount_paid === undefined || input.amount_paid === null) {
    errors.push("Amount is required")
  } else if (
    typeof input.amount_paid !== "number" ||
    !Number.isFinite(input.amount_paid)
  ) {
    errors.push("Amount must be a valid number")
  } else if (input.amount_paid <= 0) {
    errors.push("Amount must be greater than 0")
  }

  if (!input.payment_method?.trim()) {
    errors.push("Payment method is required")
  } else if (!VALID_PAYMENT_METHODS.has(input.payment_method)) {
    errors.push("Payment method is invalid")
  }

  if (input.payment_date) {
    if (!isValidDate(input.payment_date)) {
      errors.push("Payment date must be a valid date")
    } else if (isFutureDate(input.payment_date, options?.today)) {
      errors.push("Payment date cannot be in the future")
    }
  }

  return errors
}

type AttendanceMutationInput = {
  student_id?: string
  class_id?: string
  date?: string
  status?: string
  recorded_by?: string
}

export function normalizeAttendanceInput<T extends AttendanceMutationInput>(
  input: T,
): T {
  const normalized = { ...input } as T

  if ("student_id" in normalized && typeof normalized.student_id === "string") {
    normalized.student_id = normalized.student_id.trim() as T["student_id"]
  }
  if ("class_id" in normalized && typeof normalized.class_id === "string") {
    normalized.class_id = normalized.class_id.trim() as T["class_id"]
  }
  if ("recorded_by" in normalized && typeof normalized.recorded_by === "string") {
    normalized.recorded_by = normalized.recorded_by.trim() as T["recorded_by"]
  }
  if ("status" in normalized && typeof normalized.status === "string") {
    normalized.status = normalized.status.trim().toLowerCase() as T["status"]
  }
  if ("date" in normalized && typeof normalized.date === "string") {
    normalized.date = normalized.date.trim() as T["date"]
  }

  return normalized
}

export function validateAttendanceInput(
  input: AttendanceMutationInput,
  options?: { today?: Date },
): string[] {
  const errors: string[] = []

  if (!input.student_id?.trim()) {
    errors.push("Student is required")
  }
  if (!input.class_id?.trim()) {
    errors.push("Class is required")
  }
  if (!input.status?.trim()) {
    errors.push("Attendance status is required")
  } else if (!VALID_ATTENDANCE_STATUSES.has(input.status)) {
    errors.push("Attendance status is invalid")
  }
  if (!input.date?.trim()) {
    errors.push("Attendance date is required")
  } else if (!isValidDate(input.date)) {
    errors.push("Attendance date must be a valid date")
  } else if (isFutureDate(input.date, options?.today)) {
    errors.push("Attendance date cannot be in the future")
  }

  return errors
}

type FeeStructureMutationInput = {
  name?: string
  class_id?: string | null
  amount?: number | string
  term?: number
  academic_year?: string
  due_date?: string
}

export function normalizeFeeStructureInput<T extends FeeStructureMutationInput>(
  input: T,
): T {
  const normalized = { ...input } as T

  if ("name" in normalized && typeof normalized.name === "string") {
    normalized.name = sanitizeString(normalized.name) as T["name"]
  }
  if ("class_id" in normalized && typeof normalized.class_id === "string") {
    normalized.class_id = (normalized.class_id.trim() || null) as T["class_id"]
  }
  if (
    "academic_year" in normalized &&
    typeof normalized.academic_year === "string"
  ) {
    normalized.academic_year = sanitizeString(normalized.academic_year) as T["academic_year"]
  }
  if ("due_date" in normalized && typeof normalized.due_date === "string") {
    normalized.due_date = (normalized.due_date.trim() || undefined) as T["due_date"]
  }
  if ("amount" in normalized) {
    const rawValue = normalized.amount
    if (typeof rawValue === "string") {
      const parsed = Number(sanitizeNumber(rawValue))
      normalized.amount = (Number.isFinite(parsed) ? parsed : NaN) as T["amount"]
    }
  }

  return normalized
}

export function validateFeeStructureInput(
  input: FeeStructureMutationInput,
): string[] {
  const errors: string[] = []

  if (!input.name?.trim()) {
    errors.push("Fee name is required")
  }

  if (input.amount === undefined || input.amount === null) {
    errors.push("Amount is required")
  } else if (typeof input.amount !== "number" || !Number.isFinite(input.amount)) {
    errors.push("Amount must be a valid number")
  } else if (input.amount <= 0) {
    errors.push("Amount must be greater than 0")
  }

  if (input.term === undefined || input.term === null) {
    errors.push("Term is required")
  } else if (![1, 2, 3].includes(input.term)) {
    errors.push("Term must be 1, 2, or 3")
  }

  if (!input.academic_year?.trim()) {
    errors.push("Academic year is required")
  }

  if (input.due_date && !isValidDate(input.due_date)) {
    errors.push("Due date must be a valid date")
  }

  return errors
}
