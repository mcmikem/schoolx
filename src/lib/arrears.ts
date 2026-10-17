import type { FinancialAdjustmentType } from "@/lib/operations";

/**
 * Arrears carry-forward analysis.
 *
 * The school bills by term, but payments are recorded against a pupil rather
 * than against a specific term. `calculateStudentFeePosition` therefore reports
 * one cumulative balance. Bursars still need to answer the everyday question:
 * "how much of this balance is old debt (a previous term's fees) versus what
 * this term is actually charging?"
 *
 * This helper keeps the exact cumulative balance produced by
 * `calculateStudentFeePosition` (so figures never disagree with the ledger) and
 * additionally splits it into `arrears` (unpaid charges from earlier terms plus
 * any opening balance carried forward) and `currentDue` (the remainder).
 *
 * Allocation is FIFO: money received clears the oldest charges first. Because
 * payments are not term-tagged this is a defensible allocation, not an exact
 * history — the totals always reconcile to the cumulative balance.
 */

const CREDIT_ADJUSTMENTS = new Set<FinancialAdjustmentType>([
  "discount",
  "scholarship",
  "manual_credit",
  "write_off",
  "bursary",
  "amnesty",
]);

export interface ArrearsFeeLike {
  amount: number;
  term?: number | string | null;
  academic_year?: string | number | null;
}

export interface ArrearsAdjustmentLike {
  amount: number;
  adjustment_type: FinancialAdjustmentType;
}

export interface ArrearsSplitInput {
  fees: ArrearsFeeLike[];
  payments: Array<{ amount_paid: number }>;
  adjustments?: ArrearsAdjustmentLike[];
  openingBalance?: number;
  /** The school's current academic year, e.g. "2026" or "2025/2026". */
  academicYear?: string | number | null;
  /** The term the school is currently in (1 | 2 | 3). */
  currentTerm?: number | string | null;
}

export interface ArrearsSplit {
  /** Charges from earlier terms (same or previous academic year). */
  priorCharges: number;
  /** Charges belonging to the current term. */
  currentCharges: number;
  /** Same figure as `calculateStudentFeePosition().totalExpected`. */
  totalExpected: number;
  totalPaid: number;
  /** Same figure as `calculateStudentFeePosition().balance`. */
  balance: number;
  /** Unpaid portion of prior charges + opening balance, i.e. brought forward. */
  arrears: number;
  /** Portion of the balance attributable to the current term. */
  currentDue: number;
}

/** First 4-digit year in a value: "2025/2026" → 2025, "2026" → 2026. */
function academicYearStart(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

/** Term as a number: "Term 2" → 2, 3 → 3. */
function termNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).match(/\d/);
  return match ? Number(match[0]) : null;
}

function isPriorTerm(fee: ArrearsFeeLike, year: number | null, term: number | null): boolean {
  const feeYear = academicYearStart(fee.academic_year);
  const feeTerm = termNumber(fee.term);
  // A charge with no year or term (one-off levies) is treated as current.
  if (feeYear === null || feeTerm === null || year === null || term === null) return false;
  if (feeYear < year) return true;
  if (feeYear > year) return false;
  return feeTerm < term;
}

export function computeArrearsSplit(input: ArrearsSplitInput): ArrearsSplit {
  const year = academicYearStart(input.academicYear);
  const term = termNumber(input.currentTerm);
  const adjustments = input.adjustments || [];

  const totalPaid = input.payments.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
  const totalCredits = adjustments
    .filter((item) => CREDIT_ADJUSTMENTS.has(item.adjustment_type))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalPenalties = adjustments
    .filter((item) => item.adjustment_type === "penalty")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  let priorCharges = 0;
  let currentCharges = 0;
  for (const fee of input.fees) {
    const amount = Number(fee.amount || 0);
    if (isPriorTerm(fee, year, term)) priorCharges += amount;
    else currentCharges += amount;
  }

  const openingBalance = Number(input.openingBalance || 0);
  const feeTotal = priorCharges + currentCharges;
  const totalExpected = Math.max(0, feeTotal + openingBalance + totalPenalties - totalCredits);
  const balance = Math.max(0, totalExpected - totalPaid);

  // Brought-forward debt settles first; clamp so the split can never exceed the
  // reconciled balance (credits can push priorExpected above totalExpected).
  const priorExpected = Math.max(0, priorCharges + openingBalance);
  const arrears = Math.min(balance, Math.max(0, priorExpected - totalPaid));
  const currentDue = balance - arrears;

  return {
    priorCharges,
    currentCharges,
    totalExpected,
    totalPaid,
    balance,
    arrears,
    currentDue,
  };
}
