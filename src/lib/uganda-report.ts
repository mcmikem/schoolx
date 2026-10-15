/**
 * Pure builders for the printed Uganda Primary Pupil's Progress Report.
 *
 * Grading bands here follow the legend printed on the report itself (the
 * official UNEB PLE bands: D1 80+, D2 75–79, C3 70–74 … F9 0–44) — NOT the
 * app-wide getPLEGrade(), whose cutoffs differ. A printed document must
 * agree with its own legend, so this module owns its bands explicitly.
 * Division bands likewise follow UNEB (I 4–12, II 13–23, III 24–29,
 * IV 30–34, U 35+).
 *
 * Missing marks are UNKNOWN, never zero: a subject (or MID/END bucket)
 * with no recorded rows renders "—" and is excluded from totals, so an
 * unmarked subject can never drag an aggregate down.
 */

/** Assessment types feeding the printed MID column (term unit exams). */
export const UG_MID_TYPES = ["u1", "u2"];
/** Assessment types feeding the printed END column (final exams). */
export const UG_END_TYPES = ["exam", "eot"];
/** Fallback maxima for CA-style rows whose max_score was never recorded. */
const UG_CA_MAX: Record<string, number> = { ca1: 10, ca2: 10, ca3: 10, ca4: 10, project: 20 };

/** Canonical Ugandan primary subject order; unknown names sort last, stably. */
const UG_SUBJECT_ORDER = [
  "english",
  "mathematics",
  "maths",
  "social studies",
  "sst",
  "integrated science",
  "science",
  "religious education",
  "re",
  "cre",
  "ire",
  "local language",
  "capa",
  "capa/p.e.",
  "p.e.",
  "physical education",
];

export interface UgandaGradeRow {
  assessment_type: string;
  score: number;
  max_score?: number | null;
}

export interface UgandaSubjectResult {
  /** MID bucket mean as a percentage, or null when nothing recorded. */
  mid: number | null;
  /** END bucket mean as a percentage, or null when nothing recorded. */
  end: number | null;
  /** Mean of the available buckets (or percent-of-possible fallback). */
  avg: number | null;
  /** PLE aggregate points for avg, or null when avg is null. */
  agg: number | null;
  /** PLE grade band for avg, or "—" when avg is null. */
  grade: string;
}

export interface UgandaTotals {
  midTotal: number | null;
  endTotal: number | null;
  avgMean: number | null;
  aggSum: number | null;
  division: string;
}

const pct = (score: number, max: number): number | null => {
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return null;
  return Math.round((Number(score) / Number(max)) * 100);
};

const meanOrNull = (values: Array<number | null>): number | null => {
  const real = values.filter((v): v is number => v !== null);
  if (real.length === 0) return null;
  return Math.round(real.reduce((a, b) => a + b, 0) / real.length);
};

const maxFor = (type: string, recorded: unknown): number => {
  const m = Number(recorded);
  if (Number.isFinite(m) && m > 0) return m;
  return UG_CA_MAX[type] ?? 100;
};

/** PLE grade band exactly as printed in the report legend. */
export function ugandaGrade(avg: number): string {
  if (avg >= 80) return "D1";
  if (avg >= 75) return "D2";
  if (avg >= 70) return "C3";
  if (avg >= 65) return "C4";
  if (avg >= 60) return "C5";
  if (avg >= 55) return "C6";
  if (avg >= 50) return "P7";
  if (avg >= 45) return "P8";
  return "F9";
}

const UG_POINTS: Record<string, number> = {
  D1: 1,
  D2: 2,
  C3: 3,
  C4: 4,
  C5: 5,
  C6: 6,
  P7: 7,
  P8: 8,
  F9: 9,
};

/** UNEB division bands over the aggregate of the listed subjects. */
export function ugandaDivision(aggSum: number | null): string {
  if (aggSum === null) return "—";
  if (aggSum <= 12) return "DIV I";
  if (aggSum <= 23) return "DIV II";
  if (aggSum <= 29) return "DIV III";
  if (aggSum <= 34) return "DIV IV";
  return "U";
}

export function bucketUgandaSubject(rows: UgandaGradeRow[]): UgandaSubjectResult {
  const invalid = rows.some((row) => {
    const score = Number(row.score);
    const maximum = maxFor(row.assessment_type, row.max_score);
    return (
      row.score == null ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > maximum ||
      (row.max_score != null && (!Number.isFinite(Number(row.max_score)) || Number(row.max_score) <= 0))
    );
  });
  if (invalid) return { mid: null, end: null, avg: null, agg: null, grade: "—" };
  const midRows = rows.filter((r) => UG_MID_TYPES.includes(r.assessment_type));
  const examRows = rows.filter((r) => r.assessment_type === "exam");
  const endRows = examRows.length > 0 ? examRows : rows.filter((r) => r.assessment_type === "eot");

  const mid = meanOrNull(midRows.map((r) => pct(Number(r.score), maxFor(r.assessment_type, r.max_score))));
  const end = meanOrNull(endRows.map((r) => pct(Number(r.score), maxFor(r.assessment_type, r.max_score))));

  let avg: number | null = meanOrNull([mid, end]);
  if (avg === null && rows.length > 0) {
    // No MID/END exams on record (CA-only school): percent-of-possible over
    // everything recorded, so the column still answers honestly.
    const total = rows.reduce((s, r) => s + Number(r.score || 0), 0);
    const maxSum = rows.reduce((s, r) => s + maxFor(r.assessment_type, r.max_score), 0);
    avg = maxSum > 0 ? Math.round((total / maxSum) * 100) : null;
  }

  if (avg === null) return { mid, end, avg: null, agg: null, grade: "—" };
  const grade = ugandaGrade(avg);
  return { mid, end, avg, agg: UG_POINTS[grade] ?? null, grade };
}

export function sumUgandaTotals(
  subjects: Array<{ mid: number | null; end: number | null; avg: number | null; agg: number | null }>,
): UgandaTotals {
  const mids = subjects.map((s) => s.mid).filter((v): v is number => v !== null);
  const ends = subjects.map((s) => s.end).filter((v): v is number => v !== null);
  const avgs = subjects.map((s) => s.avg).filter((v): v is number => v !== null);
  const aggs = subjects.map((s) => s.agg).filter((v): v is number => v !== null);
  // A subject with no marks at all contributes nothing — never a zero.
  const nothingMarked = avgs.length === 0;
  return {
    midTotal: mids.length > 0 ? mids.reduce((a, b) => a + b, 0) : null,
    endTotal: ends.length > 0 ? ends.reduce((a, b) => a + b, 0) : null,
    avgMean: avgs.length > 0 ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10 : null,
    aggSum: nothingMarked ? null : aggs.reduce((a, b) => a + b, 0),
    division: nothingMarked ? "—" : ugandaDivision(aggs.reduce((a, b) => a + b, 0)),
  };
}

export function orderUgandaSubjects<T extends { name: string }>(subjects: T[]): T[] {
  const rank = (name: string): number => {
    const idx = UG_SUBJECT_ORDER.indexOf(name.trim().toLowerCase());
    return idx === -1 ? UG_SUBJECT_ORDER.length : idx;
  };
  return [...subjects]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s.name) - rank(b.s.name) || a.i - b.i)
    .map(({ s }) => s);
}
