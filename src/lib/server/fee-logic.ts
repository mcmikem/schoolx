// Shared fee business logic. Imported by the fees hook, API routes, and unit
// tests so tests exercise the real production code rather than a local copy.

export const VALID_ADJUSTMENT_TYPES = [
  "discount",
  "scholarship",
  "penalty",
  "manual_credit",
  "write_off",
  "bursary",
  "amnesty",
] as const;

export interface AdjustmentInput {
  student_id: string;
  adjustment_type: string;
  amount: number;
  description?: string;
}

export function validateAdjustment(adj: AdjustmentInput): string[] {
  const errors: string[] = [];

  if (!adj.student_id) errors.push("Student is required");
  if (!adj.amount || adj.amount <= 0) errors.push("Amount must be positive");
  if (adj.amount > 100_000_000) errors.push("Amount seems too large");
  if (!(VALID_ADJUSTMENT_TYPES as readonly string[]).includes(adj.adjustment_type)) {
    errors.push("Invalid adjustment type");
  }

  return errors;
}

export interface PaymentInput {
  student_id: string;
  amount_paid: number;
  payment_method: string;
  payment_reference?: string;
  paid_by?: string;
  notes?: string;
  payment_date?: string;
}

export function validatePayment(payment: PaymentInput): string[] {
  const errors: string[] = [];
  const validMethods = ["cash", "mobile_money", "bank", "installment", "in_kind"];

  if (!payment.student_id) errors.push("Student is required");
  if (!payment.amount_paid || payment.amount_paid <= 0) errors.push("Amount must be positive");
  if (payment.amount_paid > 100_000_000) errors.push("Amount seems too large");
  if (!validMethods.includes(payment.payment_method)) errors.push("Invalid payment method");

  return errors;
}

export interface FeeItem {
  name: string;
  amount: number;
}

export interface InvoiceInput {
  studentId: string;
  studentName: string;
  studentNumber: string;
  className: string;
  feeItems: FeeItem[];
  payments: Array<{ student_id: string; amount_paid: number }>;
  term: number;
  academicYear: string;
}

export interface GeneratedInvoice {
  student_id: string;
  student_name: string;
  student_number: string;
  class_name: string;
  fee_items: FeeItem[];
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: string;
}

export function generateInvoice(input: InvoiceInput): GeneratedInvoice {
  const totalAmount = input.feeItems.reduce((sum, f) => sum + f.amount, 0);
  const studentPayments = input.payments.filter((p) => p.student_id === input.studentId);
  const amountPaid = studentPayments.reduce((sum, p) => sum + p.amount_paid, 0);
  const balance = Math.max(0, totalAmount - amountPaid);
  const status = balance === 0 ? "paid" : "issued";

  return {
    student_id: input.studentId,
    student_name: input.studentName,
    student_number: input.studentNumber,
    class_name: input.className,
    fee_items: input.feeItems,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    balance,
    status,
  };
}
