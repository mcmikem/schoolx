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

// ---------------------------------------------------------------------------
// Oldest-first payment allocation (ROADMAP #35)
// A bursar records ONE payment; it is split across the student's outstanding
// fee_structure charges oldest-first (due_date, then academic_year, term).
// Payments already linked via fee_id reduce that charge; unlinked historic
// payments reduce the oldest balances first. All math is rounded to 2dp so
// float dust never creates penny balances.
// ---------------------------------------------------------------------------

export interface ChargeInput {
  id: string;
  name: string;
  amount: number;
  due_date: string | null;
  academic_year: string;
  term: number;
}

export interface LedgerPayment {
  fee_id: string | null;
  amount_paid: number;
}

export interface OutstandingItem {
  feeStructureId: string;
  name: string;
  academicYear: string;
  term: number;
  dueDate: string | null;
  balance: number;
}

export interface Allocation {
  feeStructureId: string;
  name: string;
  amount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function compareCharges(a: ChargeInput, b: ChargeInput): number {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) {
    return a.due_date < b.due_date ? -1 : 1;
  }
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  if (a.academic_year !== b.academic_year) {
    return a.academic_year < b.academic_year ? -1 : 1;
  }
  return a.term - b.term;
}

/** Net each charge down by linked payments, then absorb unlinked payments
 *  oldest-first. Returns only items with a positive balance, oldest first. */
export function buildOutstandingItems(charges: ChargeInput[], payments: LedgerPayment[]): OutstandingItem[] {
  const paidByFee = new Map<string, number>();
  let unlinked = 0;
  for (const p of payments) {
    const amt = Number(p.amount_paid) || 0;
    if (amt <= 0) continue;
    if (p.fee_id) {
      paidByFee.set(p.fee_id, (paidByFee.get(p.fee_id) || 0) + amt);
    } else {
      unlinked += amt;
    }
  }

  const items: OutstandingItem[] = [...charges]
    .sort(compareCharges)
    .map((c) => ({
      feeStructureId: c.id,
      name: c.name,
      academicYear: c.academic_year,
      term: c.term,
      dueDate: c.due_date,
      balance: round2(Math.max(0, (Number(c.amount) || 0) - (paidByFee.get(c.id) || 0))),
    }))
    .filter((i) => i.balance > 0);

  let remaining = round2(unlinked);
  for (const item of items) {
    if (remaining <= 0) break;
    const absorbed = Math.min(item.balance, remaining);
    item.balance = round2(item.balance - absorbed);
    remaining = round2(remaining - absorbed);
  }

  return items.filter((i) => i.balance > 0);
}

/** Split `amount` across outstanding items oldest-first.
 *  Returns per-charge allocations plus any unallocated remainder
 *  (caller decides: reject as overpayment or accept with override). */
export function allocatePaymentOldestFirst(
  items: OutstandingItem[],
  amount: number,
): { allocations: Allocation[]; unallocated: number; appliedTotal: number } {
  const allocations: Allocation[] = [];
  let remaining = round2(Math.max(0, amount));
  for (const item of items) {
    if (remaining <= 0) break;
    if (item.balance <= 0) continue;
    const take = round2(Math.min(item.balance, remaining));
    if (take > 0) {
      allocations.push({ feeStructureId: item.feeStructureId, name: item.name, amount: take });
      remaining = round2(remaining - take);
    }
  }
  return { allocations, unallocated: remaining, appliedTotal: round2(amount - remaining) };
}

/** Total outstanding across items (2dp). */
export function totalOutstanding(items: OutstandingItem[]): number {
  return round2(items.reduce((sum, i) => sum + i.balance, 0));
}
