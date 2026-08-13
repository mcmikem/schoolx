// ============================================================================
// 🔒 LOCKED DOWN — VALIDATION UTILITIES (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Core validation functions: normalizeAuthPhone, normalizeStudentInput,
// sanitizeString, getErrorMessage, and Zod schemas.
//
// Known pitfalls:
//   - normalizeAuthPhone() must produce 12-digit format (256XXXXXXXXX)
//   - normalizeStudentInput() MUST include gender field or inserts fail (NOT NULL)
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { z } from "zod";

export const phoneSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .max(15, "Phone number must be at most 15 digits")
  .regex(/^[0-9+\-\s()]+$/, "Invalid phone number format");

export const smsRequestSchema = z
  .object({
    phone: phoneSchema.optional(),
    phones: z.array(phoneSchema).max(100, "Maximum 100 recipients").optional(),
    message: z.string().min(1).max(1000, "Message must be 1-1000 characters"),
    schoolId: z.string().uuid("Invalid school ID"),
    studentId: z.string().uuid().optional(),
    type: z.enum(["individual", "class", "all", "bulk", "staff"]).optional(),
  })
  .refine(
    (data) => {
      if (!data.phone && (!data.phones || data.phones.length === 0)) {
        return { valid: false, error: "Either phone or phones array is required" };
      }
      return { valid: true };
    },
    { message: "Either phone or phones array is required" },
  );

export const feePaymentSchema = z.object({
  studentId: z.string().uuid(),
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["cash", "mobile_money", "bank", "installment", "in_kind"]),
  paymentReference: z.string().optional(),
  notes: z.string().max(500).optional(),
  schoolId: z.string().uuid(),
});

export const studentSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  gender: z.enum(["M", "F"]),
  dateOfBirth: z.string(),
  parentName: z.string().min(1).max(200),
  parentPhone: phoneSchema,
  parentPhone2: phoneSchema.optional().nullable(),
  classId: z.string().uuid(),
  address: z.string().max(500).optional().nullable(),
  pleIndexNumber: z.string().max(50).optional().nullable(),
  schoolId: z.string().uuid(),
});

export const userSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: phoneSchema,
  email: z.string().email().optional().nullable(),
  role: z.enum([
    "super_admin",
    "school_admin",
    "admin",
    "headmaster",
    "dean_of_studies",
    "bursar",
    "teacher",
    "secretary",
    "dorm_master",
    "board",
    "parent",
    "student",
    "marketer",
  ]),
  schoolId: z.string().uuid().optional().nullable(),
});

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { success: true; data: T } | { success: false; error: string; errors: z.ZodIssue[] } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues[0]?.message || "Invalid request",
    errors: result.error.issues,
  };
}

// ---------------------------------------------------------------------------
// Utility functions (used by tests and throughout the app)
// ---------------------------------------------------------------------------

export function sanitizeString(input: string): string {
  if (!input) return "";
  let result = String(input).trim();
  result = result.replace(/<[^>]*>/g, "");
  if (result.length > 500) result = result.slice(0, 500);
  return result;
}

export function sanitizePhone(input: string): string {
  if (!input) return "";
  return String(input).replace(/[^\d+]/g, "");
}

export function sanitizeNumber(input: string): string {
  if (!input) return "";
  return String(input).replace(/[^\d.\-]/g, "");
}

export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    return cleaned.length >= 10 && cleaned.length <= 15;
  }
  if (cleaned.startsWith("256")) {
    return cleaned.length >= 12 && cleaned.length <= 15;
  }
  return cleaned.length >= 9 && cleaned.length <= 13;
}

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

export function isValidScore(score: number, maxScore = 100): boolean {
  return score >= 0 && score <= maxScore;
}

export function isFutureDate(dateStr: string, referenceDate = new Date()): boolean {
  const d = new Date(dateStr);
  return d > referenceDate;
}

export function normalizeAuthPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return "";
  // If already a full Ugandan number (256xxxxxxxxx)
  if (digits.startsWith("256") && digits.length >= 12) {
    return digits.slice(0, 12);
  }
  // If starts with a leading 0 (e.g., 07770100019), replace with 256
  if (digits.startsWith("0")) {
    return "256" + digits.slice(1);
  }
  // If just the 9‑digit local part
  if (digits.length === 9) {
    return "256" + digits;
  }
  // Fallback – return the cleaned digits as‑is
  return digits;
}

export function getErrorMessage(error: unknown, fallback?: string): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as any).message === "string") return (error as any).message;
    if ("error" in error && typeof (error as any).error === "string") return (error as any).error;
  }
  return fallback || "An unexpected error occurred";
}

export function normalizeAttendanceInput(input: Record<string, any>): Record<string, any> {
  return {
    student_id: String(input.student_id || "").trim(),
    class_id: String(input.class_id || "").trim(),
    status: String(input.status || "")
      .trim()
      .toLowerCase(),
    date: String(input.date || "").trim(),
    recorded_by: String(input.recorded_by || "").trim(),
    period_number: Number(input.period_number) || 1,
  };
}

export function normalizeFeeStructureInput(input: Record<string, any>): Record<string, any> {
  const amount = typeof input.amount === "string" ? Number(input.amount.replace(/[^\d.]/g, "")) : Number(input.amount);
  return {
    name: String(input.name || "").trim(),
    class_id: String(input.class_id || "").trim(),
    amount,
    term: Number(input.term),
    academic_year: String(input.academic_year || "").trim(),
    due_date: String(input.due_date || "").trim(),
  };
}

export function normalizePaymentInput(input: Record<string, unknown>): Record<string, unknown> {
  const amount =
    typeof input.amount_paid === "string"
      ? Number(input.amount_paid.replace(/[^\d.]/g, ""))
      : Number(input.amount_paid);
  const ref = String(input.payment_reference || "").trim();
  return {
    student_id: String(input.student_id || "").trim(),
    amount_paid: amount,
    payment_method: String(input.payment_method || "")
      .trim()
      .toLowerCase(),
    payment_reference: ref.replace(/\s+/g, "").toUpperCase(),
    paid_by: String(input.paid_by || "").trim(),
    notes: String(input.notes || "").trim(),
    payment_date: String(input.payment_date || "").trim(),
  };
}

export function normalizeStudentInput(input: Record<string, any>): Record<string, any> {
  const balance =
    typeof input.opening_balance === "string"
      ? Number(input.opening_balance.replace(/[^\d.\-]/g, ""))
      : Number(input.opening_balance);
  const rawGender = String(input.gender || "")
    .trim()
    .toUpperCase();
  const gender =
    rawGender === "M" || rawGender === "MALE" ? "M" : rawGender === "F" || rawGender === "FEMALE" ? "F" : "";
  return {
    first_name: String(input.first_name || "").trim(),
    last_name: String(input.last_name || "").trim(),
    gender,
    date_of_birth: input.date_of_birth || null,
    parent_name: String(input.parent_name || "").trim(),
    parent_phone: normalizeAuthPhone(String(input.parent_phone || "")),
    parent_phone2: normalizeAuthPhone(String(input.parent_phone2 || "")),
    parent_email: input.parent_email || null,
    address: input.address || null,
    student_number: String(input.student_number || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase(),
    class_id: String(input.class_id || "").trim(),
    ple_index_number: input.ple_index_number || null,
    opening_balance: isNaN(balance) ? 0 : balance,
    photo_url: input.photo_url || null,
    blood_type: input.blood_type || null,
    religion: input.religion || null,
    nationality: input.nationality || null,
    boarding_status: input.boarding_status || "day",
    house_id: input.house_id || null,
    previous_school: input.previous_school || null,
    district_origin: input.district_origin || null,
    sub_county: input.sub_county || null,
    parish: input.parish || null,
    village: input.village || null,
    games_house: input.games_house || null,
    is_class_monitor: input.is_class_monitor === true,
    prefect_role: input.prefect_role || null,
    student_council_role: input.student_council_role || null,
  };
}

export function validateAttendanceInput(input: Record<string, any>, options: { today?: Date } = {}): string[] {
  const errors: string[] = [];
  const today = options.today || new Date();
  if (!input.student_id || String(input.student_id).trim() === "") errors.push("Student is required");
  if (!input.class_id || String(input.class_id).trim() === "") errors.push("Class is required");
  const validStatuses = ["present", "absent", "late", "excused"];
  if (!validStatuses.includes(String(input.status).trim().toLowerCase())) errors.push("Attendance status is invalid");
  if (input.date && isFutureDate(String(input.date), today)) errors.push("Attendance date cannot be in the future");
  return errors;
}

export function validateFeeStructureInput(input: Record<string, any>): string[] {
  const errors: string[] = [];
  if (!input.name || String(input.name).trim() === "") errors.push("Fee name is required");
  const amount = Number(input.amount);
  if (isNaN(amount) || amount <= 0) errors.push("Amount must be greater than 0");
  if (![1, 2, 3].includes(Number(input.term))) errors.push("Term must be 1, 2, or 3");
  if (!input.academic_year || String(input.academic_year).trim() === "") errors.push("Academic year is required");
  if (input.due_date && !isValidDate(String(input.due_date))) errors.push("Due date must be a valid date");
  return errors;
}

export function validatePaymentInput(input: Record<string, any>, options: { today?: Date } = {}): string[] {
  const errors: string[] = [];
  const today = options.today || new Date();
  if (!input.student_id || String(input.student_id).trim() === "") errors.push("Student is required");
  const amount = Number(input.amount_paid);
  if (isNaN(amount) || amount <= 0) errors.push("Amount must be greater than 0");
  const validMethods = ["cash", "mobile_money", "bank", "installment", "in_kind"];
  if (!validMethods.includes(String(input.payment_method).trim().toLowerCase()))
    errors.push("Payment method is invalid");
  if (input.payment_date && isFutureDate(String(input.payment_date), today))
    errors.push("Payment date cannot be in the future");
  return errors;
}

// Partial-safe variant for UPDATE operations. Unlike normalizeStudentInput which
// always emits a full record (and drops status/dropout/transfer/nin fields), this
// only normalizes keys that are actually present in the input, preserving
// status | transfer_* | dropout_* | admission_date | nin when explicitly provided.
// Fixes: dropout, transfer, PLE-index, and rollover updates corrupting the row
// (e.g. gender set to "" triggering the CHECK constraint, or status silently dropped).
export function normalizeStudentUpdateInput(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};

  if (input.first_name !== undefined) out.first_name = String(input.first_name || "").trim();
  if (input.last_name !== undefined) out.last_name = String(input.last_name || "").trim();

  if (input.gender !== undefined) {
    const rawGender = String(input.gender || "")
      .trim()
      .toUpperCase();
    out.gender =
      rawGender === "M" || rawGender === "MALE" ? "M" : rawGender === "F" || rawGender === "FEMALE" ? "F" : "";
  }

  if (input.date_of_birth !== undefined) out.date_of_birth = input.date_of_birth || null;
  if (input.parent_name !== undefined) out.parent_name = String(input.parent_name || "").trim();
  if (input.parent_phone !== undefined) out.parent_phone = normalizeAuthPhone(String(input.parent_phone || ""));
  if (input.parent_phone2 !== undefined) out.parent_phone2 = normalizeAuthPhone(String(input.parent_phone2 || ""));
  if (input.parent_email !== undefined) out.parent_email = input.parent_email || null;
  if (input.address !== undefined) out.address = input.address || null;

  if (input.student_number !== undefined) {
    out.student_number = String(input.student_number || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase();
  }

  if (input.class_id !== undefined) out.class_id = String(input.class_id || "").trim();
  if (input.ple_index_number !== undefined) out.ple_index_number = input.ple_index_number || null;
  if (input.nin !== undefined) out.nin = input.nin || null;

  if (input.opening_balance !== undefined) {
    const balance =
      typeof input.opening_balance === "string"
        ? Number(input.opening_balance.replace(/[^\d.\-]/g, ""))
        : Number(input.opening_balance);
    out.opening_balance = isNaN(balance) ? 0 : balance;
  }

  if (input.photo_url !== undefined) out.photo_url = input.photo_url || null;
  if (input.blood_type !== undefined) out.blood_type = input.blood_type || null;
  if (input.religion !== undefined) out.religion = input.religion || null;
  if (input.nationality !== undefined) out.nationality = input.nationality || null;
  if (input.boarding_status !== undefined) out.boarding_status = input.boarding_status || "day";
  if (input.house_id !== undefined) out.house_id = input.house_id || null;
  if (input.previous_school !== undefined) out.previous_school = input.previous_school || null;
  if (input.district_origin !== undefined) out.district_origin = input.district_origin || null;
  if (input.sub_county !== undefined) out.sub_county = input.sub_county || null;
  if (input.parish !== undefined) out.parish = input.parish || null;
  if (input.village !== undefined) out.village = input.village || null;
  if (input.games_house !== undefined) out.games_house = input.games_house || null;
  if (input.is_class_monitor !== undefined) out.is_class_monitor = input.is_class_monitor === true;
  if (input.prefect_role !== undefined) out.prefect_role = input.prefect_role || null;
  if (input.student_council_role !== undefined) out.student_council_role = input.student_council_role || null;

  if (input.status !== undefined) out.status = input.status;
  if (input.transfer_from !== undefined) out.transfer_from = input.transfer_from || null;
  if (input.transfer_to !== undefined) out.transfer_to = input.transfer_to || null;
  if (input.transfer_reason !== undefined) out.transfer_reason = input.transfer_reason || null;
  if (input.dropout_reason !== undefined) out.dropout_reason = input.dropout_reason || null;
  if (input.dropout_date !== undefined) out.dropout_date = input.dropout_date || null;
  if (input.admission_date !== undefined) out.admission_date = input.admission_date || null;
  if (input.repeating !== undefined)
    out.repeating = input.repeating === true || input.repeating === 1 || input.repeating === "true";
  if (input.last_attendance_date !== undefined) out.last_attendance_date = input.last_attendance_date || null;
  if (input.consecutive_absent_days !== undefined)
    out.consecutive_absent_days = Number(input.consecutive_absent_days) || 0;

  return out;
}

export function validateStudentInput(
  input: Record<string, any>,
  options: { partial?: boolean; today?: Date } = {},
): string[] {
  const errors: string[] = [];
  const today = options.today || new Date();
  const { partial = false } = options;

  if (!partial) {
    if (!input.first_name || String(input.first_name).trim() === "") errors.push("First name is required");
    if (!input.last_name || String(input.last_name).trim() === "") errors.push("Last name is required");
    if (!input.parent_name || String(input.parent_name).trim() === "") errors.push("Parent name is required");
    if (!input.class_id || String(input.class_id).trim() === "") errors.push("Class is required");
  }

  if (input.parent_phone) {
    if (!isValidPhone(String(input.parent_phone))) errors.push("Parent phone must be a valid phone number");
  }

  if (input.parent_phone2) {
    const phone2 = String(input.parent_phone2).trim();
    if (phone2 && !isValidPhone(phone2)) {
      errors.push("Alternative parent phone must be a valid phone number");
    } else if (phone2 && normalizeAuthPhone(phone2) === normalizeAuthPhone(String(input.parent_phone))) {
      errors.push("Alternative parent phone must be different from the primary parent phone");
    }
  }

  if (input.date_of_birth && isFutureDate(String(input.date_of_birth), today)) {
    errors.push("Date of birth cannot be in the future");
  }

  if (!partial) {
    const g = String(input.gender || "")
      .trim()
      .toUpperCase();
    if (g !== "M" && g !== "MALE" && g !== "F" && g !== "FEMALE") {
      errors.push("Gender must be Male or Female");
    }
  }

  return errors;
}
