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

/** Traditional primary beginning-of-term marks. */
export const UG_MID_TYPES = ["bot"];
/** Final-term exam types used by legacy records. */
export const UG_END_TYPES = ["exam", "eot"];
/** Legacy rows without a recorded maximum are treated as marks out of 100. */
const UG_CA_MAX: Record<string, number> = { ca1: 100, ca2: 100, ca3: 100, ca4: 100, project: 100 };

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
  /** BOT mark as a percentage, or null when nothing recorded. */
  mid: number | null;
  /** MOT mark as a percentage, or null when nothing recorded. */
  mot: number | null;
  /** EOT mark as a percentage, or null when nothing recorded. */
  end: number | null;
  /** Simple mean of available BOT, MOT and EOT marks. */
  avg: number | null;
  /** PLE aggregate points for avg, or null when avg is null. */
  agg: number | null;
  /** PLE grade band for avg, or "—" when avg is null. */
  grade: string;
  /** Secondary-school marks displayed on a progressive report card. */
  assessmentBreakdown?: Array<{ type: string; label: string; score: number | null }>;
  /** Human-readable descriptor for the secondary A–E scale. */
  gradeDescriptor?: string;
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

/** Which recorded exam a school wants the term grade built from. */
export type GradeBasisType = "bot" | "mid_term" | "eot" | "ca" | "holiday_package";
/**
 * The school's term-grade recipe: which assessments count and their weights.
 * Stored in school_settings as term_grade_basis_v1; weights are plain
 * percentages (30/30/40) — anything unweighted counts equally.
 */
export interface TermGradeBasis {
  types: GradeBasisType[];
  weights?: Partial<Record<GradeBasisType, number>>;
}

/** Continuous-assessment row types folded into the "ca" bucket. */
const UG_CA_TYPES = ["ca1", "ca2", "ca3", "ca4", "project", "u1", "u2", "class_test", "saturday"];

function typePct(rows: UgandaGradeRow[], type: GradeBasisType): number | null {
  let picked: UgandaGradeRow[];
  if (type === "bot") picked = rows.filter((r) => UG_MID_TYPES.includes(r.assessment_type));
  else if (type === "mid_term")
    picked = rows.filter((r) => ["mid_term", "mock", "mock_exam"].includes(r.assessment_type.toLowerCase()));
  else if (type === "eot") {
    const eot = rows.filter((r) => r.assessment_type === "eot");
    // Legacy records sit under "exam" when no EOT row exists.
    picked = eot.length > 0 ? eot : rows.filter((r) => r.assessment_type === "exam");
  } else if (type === "holiday_package") {
    picked = rows.filter((r) => ["holiday_package", "hpg"].includes(r.assessment_type.toLowerCase()));
  } else picked = rows.filter((r) => UG_CA_TYPES.includes(r.assessment_type));
  return meanOrNull(picked.map((r) => pct(Number(r.score), maxFor(r.assessment_type, r.max_score))));
}

/**
 * Weighted mean over the basis types actually on record — a pupil who missed
 * the mid-term is not punished: the remaining types carry the grade on their
 * own weights. Returns null when none of the chosen types have any rows.
 */
export function gradeBasisAvg(rows: UgandaGradeRow[], basis: TermGradeBasis): number | null {
  const present = basis.types
    .map((type) => ({ type, score: typePct(rows, type) }))
    .filter((entry): entry is { type: GradeBasisType; score: number } => entry.score !== null);
  if (present.length === 0) return null;
  const weightOf = (type: GradeBasisType): number => {
    const w = Number(basis.weights?.[type]);
    return Number.isFinite(w) && w > 0 ? w : 1;
  };
  const totalWeight = present.reduce((sum, entry) => sum + weightOf(entry.type), 0);
  const weighted = present.reduce((sum, entry) => sum + entry.score * weightOf(entry.type), 0);
  return Math.round(weighted / totalWeight);
}

export function bucketUgandaSubject(rows: UgandaGradeRow[], basis?: TermGradeBasis | null): UgandaSubjectResult {
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
  if (invalid) return { mid: null, mot: null, end: null, avg: null, agg: null, grade: "—" };
  const midRows = rows.filter((r) => UG_MID_TYPES.includes(r.assessment_type));
  const motRows = rows.filter((r) => ["mid_term", "mock", "mock_exam"].includes(r.assessment_type.toLowerCase()));
  const eotRows = rows.filter((r) => r.assessment_type === "eot");
  const examRows = rows.filter((r) => r.assessment_type === "exam");
  const endRows = eotRows.length > 0 ? eotRows : examRows;
  const holidayRows = rows.filter((r) => ["holiday_package", "hpg"].includes(r.assessment_type.toLowerCase()));

  const mid = meanOrNull(midRows.map((r) => pct(Number(r.score), maxFor(r.assessment_type, r.max_score))));
  const mot = meanOrNull(motRows.map((r) => pct(Number(r.score), maxFor(r.assessment_type, r.max_score))));
  const end = meanOrNull(endRows.map((r) => pct(Number(r.score), maxFor(r.assessment_type, r.max_score))));
  const holiday = meanOrNull(holidayRows.map((r) => pct(Number(r.score), maxFor(r.assessment_type, r.max_score))));

  // Schools differ on what the term grade is made of: some count only the
  // EOT exam, some weight BOT/MOT/EOT, some run on continuous assessment.
  // The school's basis (school_settings) decides; unset keeps the classic
  // simple mean of whatever BOT/MOT/EOT exams were recorded.
  let avg: number | null = null;
  if (holiday !== null && mot !== null && !basis?.types.includes("holiday_package")) {
    // A number of secondary schools report a holiday package with a mid-term
    // mock. Without school-configured weights, the recorded marks count equally.
    avg = meanOrNull([holiday, mot]);
  } else if (basis && Array.isArray(basis.types) && basis.types.length > 0) {
    avg = gradeBasisAvg(rows, basis);
  } else {
    avg = meanOrNull([mid, mot, end]);
  }
  if (avg === null && rows.length > 0) {
    // Nothing the school grades on is on record (CA-only school, or the one
    // exam it counts was never sat): percent-of-possible over everything
    // recorded, so the column still answers honestly.
    const total = rows.reduce((s, r) => s + Number(r.score || 0), 0);
    const maxSum = rows.reduce((s, r) => s + maxFor(r.assessment_type, r.max_score), 0);
    avg = maxSum > 0 ? Math.round((total / maxSum) * 100) : null;
  }

  const hasHolidayAssessment = holiday !== null || Boolean(basis?.types.includes("holiday_package"));
  const hasMidtermAssessment = mot !== null || Boolean(basis?.types.includes("mid_term"));
  const hasProgressiveAssessment =
    (hasHolidayAssessment && hasMidtermAssessment) ||
    Boolean(basis?.types.includes("holiday_package")) ||
    Boolean(basis?.types.includes("mid_term"));
  const assessmentBreakdown = hasProgressiveAssessment
    ? [
        ...(hasHolidayAssessment ? [{ type: "holiday_package", label: "HPG", score: holiday }] : []),
        ...(hasMidtermAssessment ? [{ type: "mid_term", label: "Midterm / Mock", score: mot }] : []),
        { type: "final_average", label: "Final Average", score: avg },
      ]
    : undefined;
  if (avg === null) return { mid, mot, end, avg: null, agg: null, grade: "—", assessmentBreakdown };
  if (assessmentBreakdown) {
    const grade = avg >= 85 ? "A" : avg >= 75 ? "B" : avg >= 65 ? "C" : avg >= 50 ? "D" : "E";
    const gradeDescriptor =
      grade === "A"
        ? "Exhibits an outstanding level of competency"
        : grade === "B"
          ? "Exhibits a very good level of competency"
          : grade === "C"
            ? "Exhibits an adequate level of competency"
            : grade === "D"
              ? "Exhibits a basic level of competency"
              : "Exhibits little or no competency";
    return { mid, mot, end, avg, agg: null, grade, assessmentBreakdown, gradeDescriptor };
  }
  const grade = ugandaGrade(avg);
  return { mid, mot, end, avg, agg: UG_POINTS[grade] ?? null, grade };
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
