/**
 * The arithmetic a bursar needs to see in a pupil's ledger.
 *
 * A Kikunyu pupil showed "Expected 300,000 · paid 100,000 · discount 120,000 ·
 * balance 200,000". Every number was right and the sum still looked wrong,
 * because "Expected" is already net of the discount: the 300,000 was what was
 * owed AFTER the 120,000 was waived. Without the gross fee line the reader
 * subtracts the discount a second time (300 − 120 − 100 = 80) and concludes the
 * balance is broken.
 *
 * So the equation has to start from what was charged and walk down to what is
 * left, with credits visibly reducing the bill and payments visibly reducing
 * the balance. `grossFees` comes from the same allocated fee lines the
 * breakdown uses, so it is exactly the `feeTotal` fed into
 * `calculateStudentFeePosition`.
 */
import { isCreditAdjustment } from "@/lib/fee-allocation";

export interface LedgerSummaryInput {
  fees?: Array<{ amount: number | string }> | null;
  adjustments?: Array<{ adjustment_type: string; amount: number | string }> | null;
  openingBalance?: number | string | null;
}

export interface LedgerSummary {
  /** What the fee lines add up to, before any credit is applied. */
  grossFees: number;
  /** Discounts, scholarships, write-offs and other credits. */
  credits: number;
  /** Fines and other charges added on top of the fee lines. */
  penalties: number;
  /** Pre-system debt carried into the ledger. */
  openingBalance: number;
  /**
   * Whether the ledger needs the itemised equation. A pupil with no credits,
   * penalties or opening balance has nothing to explain: the familiar
   * "Expected → payments → Balance" lines are already unambiguous.
   */
  itemised: boolean;
}

export function summariseLedger(input: LedgerSummaryInput): LedgerSummary {
  const grossFees = (input.fees || []).reduce((sum, fee) => sum + Math.max(0, Number(fee.amount) || 0), 0);
  const adjustments = input.adjustments || [];
  const credits = adjustments
    .filter((a) => isCreditAdjustment(a.adjustment_type))
    .reduce((sum, a) => sum + Math.max(0, Number(a.amount) || 0), 0);
  const penalties = adjustments
    .filter((a) => a.adjustment_type === "penalty")
    .reduce((sum, a) => sum + Math.max(0, Number(a.amount) || 0), 0);
  const openingBalance = Math.max(0, Number(input.openingBalance) || 0);

  return {
    grossFees,
    credits,
    penalties,
    openingBalance,
    itemised: credits > 0 || penalties > 0 || openingBalance > 0,
  };
}
