/**
 * Spread a pupil's payments across their fee lines, so the balance can say
 * *which* fee is still owed rather than only how much.
 *
 * The problem this solves is concrete. A Kikunyu P.2 pupil paid 100,000 against
 * a bill of 235,000, and the fees screen showed "135,000 owing" with no
 * breakdown. The real answer was "tuition is cleared, uniform is not", and
 * nobody could see it: the screen held one number, and payments recorded
 * against a whole bill (fee_id null) cannot be attributed without help.
 *
 * Allocation is deliberately simple and predictable, because a bursar has to be
 * able to reproduce it in their head:
 *
 *   1. A payment that names a fee_id settles that fee and nothing else.
 *   2. A payment that names no fee is pooled and applied in the order the fee
 *      lines are given, clearing each line fully before the next one starts.
 *   3. Credits (discount, bursary, write-off...) are pooled alongside payments,
 *      because from the bursar's side they both reduce what is owed.
 *      Debit adjustments are not: they add to the bill and are left to the
 *      balance, which already carries them.
 *
 * The order of `fees` is therefore load-bearing, and the caller passes the
 * order the bursar already sees. Change it and the "remaining" line moves.
 */

import type { FinancialAdjustmentType } from "@/lib/operations";

/** A charge on a pupil's bill. */
export interface AllocatableFee {
  id?: string | null;
  name: string;
  amount: number;
  category?: string | null;
  /** Kept so repeated lines can be told apart in the UI. */
  term?: 1 | 2 | 3 | null;
}

/** A payment. `fee_id` null means the bursar recorded it against the bill. */
export interface AllocatablePayment {
  id: string;
  amount_paid: number;
  fee_id?: string | null;
}

/** An adjustment. Only credits reduce what a fee line still owes. */
export interface AllocatableAdjustment {
  id: string;
  adjustment_type: FinancialAdjustmentType | string;
  amount: number;
  fee_id?: string | null;
}

export type AllocatedFeeStatus = "paid" | "partial" | "unpaid";

export interface AllocatedFee {
  id: string | null;
  name: string;
  category?: string | null;
  term?: 1 | 2 | 3 | null;
  /** What the line is worth. */
  amount: number;
  /** How much of it has been settled, whether by payment or by credit. */
  settled: number;
  /** What is still owed on this line. */
  remaining: number;
  status: AllocatedFeeStatus;
  /** Percentage settled, 0-100. */
  progress: number;
}

/** Adjustments that reduce a bill rather than add to it. */
const CREDIT_ADJUSTMENTS = new Set(["discount", "scholarship", "manual_credit", "write_off", "bursary", "amnesty"]);

export function isCreditAdjustment(type: string): boolean {
  return CREDIT_ADJUSTMENTS.has(type);
}

/**
 * Settle fee lines in order with pooled money, reporting what each one still
 * owes.
 *
 * Rounding: amounts are UGX whole units, and any sub-unit left over from
 * spreading is deliberately dropped rather than forced onto the last line. A
 * balance that does not add up to the bill by one shilling is worse than one
 * that is off by a rounding in the pupil's favour, and the caller already
 * computes the authoritative balance from the totals.
 */
export function allocateAcrossFees(
  fees: AllocatableFee[],
  payments: AllocatablePayment[] = [],
  adjustments: AllocatableAdjustment[] = [],
): AllocatedFee[] {
  if (fees.length === 0) return [];

  const remaining = fees.map((fee) => Math.max(0, Number(fee.amount || 0)));

  // 1. Payments that name a fee settle that fee only; the rest are pooled.
  let pooled = 0;

  const spend = (index: number, amount: number) => {
    const take = Math.min(amount, remaining[index]);
    remaining[index] -= take;
    return take;
  };

  for (const payment of payments) {
    const amount = Number(payment.amount_paid || 0);
    if (amount <= 0) continue;
    const index = payment.fee_id != null ? fees.findIndex((f) => f.id === payment.fee_id) : -1;
    if (index >= 0) spend(index, amount);
    else pooled += amount;
  }

  // 2. Credits reduce the bill the same way payments do.
  for (const adjustment of adjustments) {
    if (!isCreditAdjustment(adjustment.adjustment_type)) continue;
    const amount = Number(adjustment.amount || 0);
    if (amount <= 0) continue;
    const index = adjustment.fee_id != null ? fees.findIndex((f) => f.id === adjustment.fee_id) : -1;
    if (index >= 0) spend(index, amount);
    else pooled += amount;
  }

  // 3. Pooled money clears each line in turn.
  for (let i = 0; i < remaining.length && pooled > 0; i++) {
    if (remaining[i] <= 0) continue;
    pooled -= spend(i, pooled);
  }

  return fees.map((fee, i) => {
    const amount = Math.max(0, Number(fee.amount || 0));
    const owed = Math.max(0, remaining[i]);
    const settled = amount - owed;
    return {
      id: fee.id ?? null,
      name: fee.name,
      category: fee.category ?? null,
      term: fee.term ?? null,
      amount,
      settled,
      remaining: owed,
      status: owed <= 0 ? "paid" : settled > 0 ? "partial" : "unpaid",
      progress: amount > 0 ? Math.min(100, Math.round((settled / amount) * 100)) : 100,
    };
  });
}

/** The lines that still owe something, in the order they were given. */
export function outstandingFees(allocated: AllocatedFee[]): AllocatedFee[] {
  return allocated.filter((fee) => fee.remaining > 0);
}

/** Total of every settled amount across the lines. */
export function totalSettled(allocated: AllocatedFee[]): number {
  return allocated.reduce((sum, fee) => sum + fee.settled, 0);
}

/**
 * Money available to spread across lines before allocation: every payment plus
 * every credit. Debit adjustments are excluded, because they grow the bill
 * rather than settle it.
 */
export function poolCapacity(payments: AllocatablePayment[], adjustments: AllocatableAdjustment[]): number {
  let total = 0;
  for (const p of payments) total += Number(p.amount_paid || 0);
  for (const a of adjustments) {
    if (isCreditAdjustment(a.adjustment_type)) total += Number(a.amount || 0);
  }
  return total;
}
