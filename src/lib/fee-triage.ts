/**
 * Pure helpers behind the bursar triage bar and the parent installment
 * translator. Kept here (not in the pages) so the band edges and the split
 * maths are unit-testable without rendering anything.
 */

/** Balance bands (UGX). `max` is exclusive; the top band is open-ended. */
export const TRIAGE_BANDS = [
  { id: "b500", label: "500k+", min: 500_000, max: Number.POSITIVE_INFINITY },
  { id: "b200", label: "200–500k", min: 200_000, max: 500_000 },
  { id: "b50", label: "50–200k", min: 50_000, max: 200_000 },
  { id: "bSmall", label: "Under 50k", min: 1, max: 50_000 },
] as const;

export interface TriageBandResult {
  id: string;
  label: string;
  min: number;
  max: number;
  count: number;
  total: number;
  /** Bar width relative to the fullest band (0–100). */
  widthPct: number;
}

export function bucketTriageBalances(balances: Array<{ balance: number }>): TriageBandResult[] {
  const owing = balances.filter((s) => s.balance > 0);
  const counts = TRIAGE_BANDS.map((b) => owing.filter((s) => s.balance >= b.min && s.balance < b.max).length);
  const peak = Math.max(1, ...counts);
  return TRIAGE_BANDS.map((b, i) => {
    const rows = owing.filter((s) => s.balance >= b.min && s.balance < b.max);
    return {
      ...b,
      count: rows.length,
      total: rows.reduce((sum, s) => sum + (s.balance || 0), 0),
      widthPct: Math.round((counts[i] / peak) * 100),
    };
  });
}

/** Split a balance into `n` whole-UGX installments (rounds up). */
export function splitBalance(balance: number, n: number): number {
  if (n <= 0) return Math.max(0, Math.round(balance));
  return Math.max(0, Math.ceil(balance / n));
}

/**
 * One row per pupil, as the money position sees them.
 */
export interface FeeRosterRow {
  expected: number;
  paid: number;
  balance: number;
  /**
   * Whether the pupil actually had fee lines this term.
   *
   * `expected === 0` alone cannot tell "nobody set up this class's fees" apart
   * from "this pupil's whole bill was discounted away". Kikunyu's Mutebi Keron
   * has a 100,000 tuition line and a 100,000 discount, so every number is
   * right and the pupil still landed in the "no fee structure" warning — a
   * fully-sponsored child reported as a setup mistake. Callers that can tell
   * the difference pass this; when omitted, the old `expected === 0` test
   * stands.
   */
  billed?: boolean;
}

/**
 * Exclusive buckets for the roster.
 *
 * `unbilled` is the important one: a pupil whose class has no fee structure
 * yet has expected === 0 AND paid === 0, so a naive `balance === 0` test calls
 * them "fully paid" while a naive `paid === 0` test calls them "unpaid" — the
 * same pupil lands in two buckets, the buckets stop summing to the roster, and
 * the reported collection rate inflates by however many classes lack fees.
 * They are owed nothing, so they belong in neither collection bucket; they get
 * their own count so the bursar can go fix the missing fee structure.
 */
export interface FeeRosterPartition {
  /** Pupils with a balance to chase. */
  owing: number;
  /** Pupils who have paid something but still owe. */
  partial: number;
  /** Pupils billed this term and settled in full (or written off). */
  cleared: number;
  /** Pupils with no applicable fee structure — not owed, not counted as paying. */
  unbilled: number;
  /** Every pupil on the roster. Equals owing + partial + cleared + unbilled. */
  roster: number;
  /** Pupils actually billed (roster minus unbilled). The rate's denominator. */
  billed: number;
  totalExpected: number;
  totalPaid: number;
  totalBalance: number;
  /** Collected ÷ expected, over billed pupils only. 0–100. */
  collectionRate: number;
  /** Collected ÷ expected in money terms. 0–100. Same basis for every figure. */
  realizationRate: number;
}

export function partitionFeeRoster(rows: FeeRosterRow[]): FeeRosterPartition {
  let owing = 0;
  let partial = 0;
  let cleared = 0;
  let unbilled = 0;
  let totalExpected = 0;
  let totalPaid = 0;
  let totalBalance = 0;

  for (const row of rows) {
    const expected = Math.max(0, Number(row.expected) || 0);
    const paid = Math.max(0, Number(row.paid) || 0);
    const balance = Math.max(0, Number(row.balance) || 0);

    totalExpected += expected;
    totalPaid += paid;
    totalBalance += balance;

    const notBilled = row.billed === undefined ? expected === 0 : row.billed === false;

    if (notBilled) {
      unbilled += 1;
    } else if (balance === 0) {
      cleared += 1;
    } else if (paid > 0) {
      partial += 1;
    } else {
      owing += 1;
    }
  }

  const roster = rows.length;
  const billed = roster - unbilled;

  return {
    owing,
    partial,
    cleared,
    unbilled,
    roster,
    billed,
    totalExpected,
    totalPaid,
    totalBalance,
    collectionRate: billed > 0 ? Math.round((cleared / billed) * 100) : 0,
    realizationRate: totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0,
  };
}

/** Status pills the balances list can filter by. */
export type FeeStatusFilterId = "all" | "paid" | "partial" | "unpaid" | "written_off" | "unbilled";

/**
 * Does this roster row belong in the chosen status filter?
 *
 * The list used to compare `student.status` directly, which put unbilled pupils
 * (expected 0, balance 0) in the "Paid" bucket while the tiles above counted
 * them separately. Same pupil, two answers. This mirrors `partitionFeeRoster`
 * so tapping a tile and reading the list always agree — and `unbilled` gives the
 * bursar a way to see WHICH pupil the warning is about, instead of a count with
 * no way to reach the row.
 */
export function matchesFeeStatus(
  row: FeeRosterRow & { status?: string | null },
  filter: FeeStatusFilterId | string,
): boolean {
  if (!filter || filter === "all") return true;
  const expected = Math.max(0, Number(row.expected) || 0);
  const paid = Math.max(0, Number(row.paid) || 0);
  const balance = Math.max(0, Number(row.balance) || 0);

  const notBilled = row.billed === undefined ? expected === 0 : row.billed === false;

  if (filter === "unbilled") return notBilled;
  if (filter === "written_off") return row.status === "written_off";
  // A written-off bill is settled for the ledger but was never *paid*, and
  // the old status === "paid" test excluded it too.
  if (filter === "paid") return !notBilled && balance === 0 && row.status !== "written_off";
  if (filter === "partial") return !notBilled && balance > 0 && paid > 0;
  if (filter === "unpaid") return !notBilled && balance > 0 && paid === 0;
  return true;
}
