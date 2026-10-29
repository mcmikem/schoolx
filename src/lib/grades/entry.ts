/**
 * Pure grading rules for the marks sheet. Kept out of the 2,900-line page so the
 * grade scale, assessment columns and completion checks can be tested without
 * rendering the whole screen.
 */

export type StudentMarks = Record<string, number | null>;

export type SaveStatus = "idle" | "dirty" | "saving" | "saved";

export type GradeResult = { grade: string; color: string };

/** The beginning/mid/end-of-term marks that make up a traditional total. */
export const TRADITIONAL_ASSESSMENT_TYPES = ["bot", "mid_term", "eot"] as const;

export const COMPETENCY_ASSESSMENT_TYPES = ["competency"] as const;

/**
 * Every assessment key the mark sheet can read or write, ordered longest-first
 * so suffix matching in `parseMarkKey` never splits `mid_term` or
 * `holiday_package` on their internal underscore.
 */
export const KNOWN_ASSESSMENT_TYPES = [
  "holiday_package",
  "competency",
  "mid_term",
  "project",
  "exam",
  "bot",
  "eot",
  "ca1",
  "ca2",
  "ca3",
  "ca4",
  "u1",
  "u2",
] as const;

/**
 * Splits a `${studentId}_${assessmentType}` key back into its two parts.
 *
 * Several assessment types contain an underscore (`mid_term`,
 * `holiday_package`), so naive `key.split("_")` corrupts UUID student IDs into
 * `<uuid>_mid` with type `term`, which Postgres rejects with 22P02 (`invalid
 * input syntax for type uuid`).
 */
export function parseMarkKey(key: string): { studentId: string; assessmentType: string } | null {
  for (const type of KNOWN_ASSESSMENT_TYPES) {
    const suffix = `_${type}`;
    if (key.endsWith(suffix)) {
      const studentId = key.slice(0, -suffix.length);
      if (studentId) return { studentId, assessmentType: type };
    }
  }
  const lastUnderscore = key.lastIndexOf("_");
  if (lastUnderscore <= 0 || lastUnderscore === key.length - 1) return null;
  return {
    studentId: key.slice(0, lastUnderscore),
    assessmentType: key.slice(lastUnderscore + 1),
  };
}

export const ASSESSMENT_MAX: Record<string, number> = {
  bot: 100,
  mid_term: 100,
  eot: 100,
  ca1: 100,
  ca2: 100,
  ca3: 100,
  ca4: 100,
  project: 100,
  exam: 100,
  holiday_package: 100,
};

/** UNEB-style division. Shared by the sheet, summaries and printed reports. */
export function getGrade(score: number): GradeResult {
  if (score >= 80) return { grade: "D1", color: "text-secondary" };
  if (score >= 70) return { grade: "D2", color: "text-secondary" };
  if (score >= 65) return { grade: "C3", color: "text-primary" };
  if (score >= 60) return { grade: "C4", color: "text-primary" };
  if (score >= 55) return { grade: "C5", color: "text-tertiary" };
  if (score >= 50) return { grade: "C6", color: "text-tertiary" };
  if (score >= 45) return { grade: "P7", color: "text-yellow-600" };
  if (score >= 40) return { grade: "P8", color: "text-yellow-500" };
  return { grade: "F9", color: "text-error" };
}

/** Columns shown on a fresh sheet, before any marks exist. */
export function assessmentTypesFor(competencyMode: boolean, useBotEnabled: boolean): readonly string[] {
  if (competencyMode) return COMPETENCY_ASSESSMENT_TYPES;
  // A school that does not run a beginning-of-term test must not be shown a
  // column for it: it invites a mark nobody intended to record, and a stray
  // entry silently shifts every average.
  return useBotEnabled ? TRADITIONAL_ASSESSMENT_TYPES : (["mid_term", "eot"] as const);
}

export function readMark(marks: StudentMarks, studentId: string, type: string): number | null {
  return marks[`${studentId}_${type}`] ?? null;
}

/** Average of recorded traditional marks, or the single competency level. */
export function getStudentTotal(marks: StudentMarks, studentId: string, competencyMode: boolean): number | null {
  if (competencyMode) {
    const score = marks[`${studentId}_competency`];
    return score === null || score === undefined ? null : score;
  }
  const recorded = TRADITIONAL_ASSESSMENT_TYPES.map((type) => marks[`${studentId}_${type}`]).filter(
    (value): value is number => value !== null && value !== undefined,
  );
  if (recorded.length === 0) return null;
  return Math.round(recorded.reduce((sum, value) => sum + value, 0) / recorded.length);
}

/** A pupil counts as graded only when every expected column has a mark. */
export function isStudentGraded(
  marks: StudentMarks,
  studentId: string,
  competencyMode: boolean,
  useBotEnabled: boolean,
  additionalTypes: readonly string[] = [],
): boolean {
  return [...assessmentTypesFor(competencyMode, useBotEnabled), ...additionalTypes].every((type) => {
    const value = marks[`${studentId}_${type}`];
    return value !== null && value !== undefined;
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Class average for one assessment column, ignoring blank cells. */
export function columnAverage(marks: StudentMarks, studentIds: string[], type: string): number | null {
  const values = studentIds
    .map((studentId) => marks[`${studentId}_${type}`])
    .filter((value): value is number => value !== null && value !== undefined);
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Class average of per-pupil totals. */
export function averageOfTotals(marks: StudentMarks, studentIds: string[], competencyMode: boolean): number | null {
  const totals = studentIds
    .map((studentId) => getStudentTotal(marks, studentId, competencyMode))
    .filter((value): value is number => value !== null);
  if (totals.length === 0) return null;
  return round1(totals.reduce((sum, value) => sum + value, 0) / totals.length);
}

const DEFAULT_LABELS: Record<string, string> = {
  bot: "Beginning of Term",
  mid_term: "Mid Term",
  eot: "End of Term",
  ca1: "CA1",
  ca2: "CA2",
  ca3: "CA3",
  ca4: "CA4",
  project: "Project",
  exam: "Exam",
  holiday_package: "Holiday Package (HPG)",
  competency: "Competency Level",
};

/** Fallback label when a school has not customised the column. */
export function assessmentLabel(type: string): string {
  return DEFAULT_LABELS[type] ?? type.replaceAll("_", " ").toUpperCase();
}
