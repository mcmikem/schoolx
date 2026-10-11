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
