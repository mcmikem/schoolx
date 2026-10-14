// Grading tracks — ONE place that says what each school level is assessed on,
// how the parts combine, and what prints on the report.
//
// Why this exists: the app grew five different final-score formulas (a plain
// sum, 25/75, 20/80 AOI, an inverted 80/20 in /api/reports, and the CBC
// formative/summative split), three disagreeing D1-F9 band tables, and two
// disagreeing PLE division tables — so the same pupil's report changed
// depending on which screen built it. Every consumer must compute through
// these tracks; the old one-off formulas are kept only as deprecated aliases.
//
// The four tracks follow Uganda's official structures (UNEB/NCDC):
//   nursery        — developmental areas, 3-level ratings, no aggregates.
//   primary        — PLE-style: MID (all classwork) + END (exam) -> AVG, then
//                    D1-F9 per subject, best-4 aggregate, Division I-IV.
//   secondary_old  — old O-level (D1-F9, best-8 aggregate, Div I-IV) and
//                    A-level (A-F, points) for S5-S6.
//   secondary_new  — NCDC competency-based: identifiers L1-L3 feed Formative
//                    20%, end-of-year summative counts 80%, 8-level A*-G scale.
//
// A school picks the secondary track (old/new) and the printed report layout;
// nursery and primary each have one sensible track. Every field carries a
// plain-language `explain` string — the grading and settings screens render
// these verbatim so staff always see what each part does.

import { getPLEGrade, getPLEDivision, getUCEGrade, getUCEDivision, getUACEGrade, getUACEPoints } from "@/lib/grading";

// ---------------------------------------------------------------------------
// Track + layout ids (stored in school_settings, see SETTING_KEYS below)
// ---------------------------------------------------------------------------

export type GradingTrackId = "nursery" | "primary" | "secondary_old" | "secondary_new";
export type ReportLayoutId = "uganda_classic" | "ncdc_cbc";

export const SETTING_KEYS = {
  /** 'old' | 'new' — which secondary grading the school uses. Default 'new'. */
  secondaryTrack: "grading_track_secondary",
  /** 'uganda_classic' | 'ncdc_cbc' — which printed subject table to use. */
  reportLayout: "report_layout",
} as const;

export type SecondaryTrackChoice = "old" | "new";

// ---------------------------------------------------------------------------
// Entry columns: what a teacher actually types for one subject
// ---------------------------------------------------------------------------

export interface TrackColumn {
  /** Storage keys in the grades table this column reads (first present wins for END). */
  keys: string[];
  label: string;
  /** Plain language, shown under the column header on the entry screen. */
  explain: string;
}

// ---------------------------------------------------------------------------
// Weighting: the single canonical formula per track family
// ---------------------------------------------------------------------------

export interface OldTrackResult {
  /** MID: mean of every classwork mark present (tests, BOT, midterm, ...). */
  mid: number | null;
  /** END: the end-of-term exam mark. */
  end: number | null;
  /** AVG: 25% MID + 75% END. Null (never 0) while either side is missing. */
  avg: number | null;
}

/**
 * Old-curriculum weighting (primary + old secondary): every classwork mark —
 * class tests, beginning-of-term, midterm, Saturday tests — feeds MID equally;
 * the end-of-term exam is END. AVG = 25% MID + 75% END.
 */
export function weighOldCurriculum(classwork: number[], exam: number | null): OldTrackResult {
  const mid = classwork.length > 0 ? classwork.reduce((s, v) => s + v, 0) / classwork.length : null;
  const end = exam;
  const avg = mid === null || end === null ? null : Math.round((mid * 0.25 + end * 0.75) * 10) / 10;
  return { mid: mid === null ? null : Math.round(mid * 10) / 10, end, avg };
}

export interface NewTrackResult {
  /** Formative: identifier average scaled to /20 (NCDC school assessment). */
  formative: number | null;
  /** Summative: end-of-year exam scaled to /80. */
  summative: number | null;
  /** Total: formative + summative, /100. Null while either side is missing. */
  total: number | null;
}

/**
 * NCDC weighting (new lower secondary): school assessment counts 20%,
 * end-of-year summative exam counts 80%.
 */
export function weighNewCurriculum(identifierAvg: number | null, summativePercent: number | null): NewTrackResult {
  const formative = identifierAvg === null ? null : Math.round((identifierAvg / 3) * 20 * 10) / 10;
  const summative = summativePercent === null ? null : Math.round(summativePercent * 0.8 * 10) / 10;
  const total = formative === null || summative === null ? null : Math.round((formative + summative) * 10) / 10;
  return { formative, summative, total };
}

// ---------------------------------------------------------------------------
// New-curriculum 8-level scale (NCDC A*-G) + identifier levels
// ---------------------------------------------------------------------------

export interface CbcGradeBand {
  grade: string;
  min: number;
  descriptor: string;
}

export const CBC_GRADE_BANDS: CbcGradeBand[] = [
  { grade: "A*", min: 85, descriptor: "Exceptional" },
  { grade: "A", min: 80, descriptor: "Outstanding" },
  { grade: "B", min: 75, descriptor: "Outstanding" },
  { grade: "C", min: 70, descriptor: "Satisfactory" },
  { grade: "D", min: 65, descriptor: "Satisfactory" },
  { grade: "E", min: 50, descriptor: "Basic" },
  { grade: "F", min: 40, descriptor: "Elementary" },
  { grade: "G", min: 0, descriptor: "Elementary" },
];

export function getCbcGrade(total: number): string {
  return CBC_GRADE_BANDS.find((b) => total >= b.min)?.grade ?? "G";
}

export function getCbcDescriptor(grade: string): string {
  return CBC_GRADE_BANDS.find((b) => b.grade === grade)?.descriptor ?? "";
}

export interface IdentifierLevel {
  level: number;
  min: number;
  max: number;
  label: string;
  meaning: string;
}

/** NCDC activity-of-integration identifier levels (0-3 scale). */
export const IDENTIFIER_LEVELS: IdentifierLevel[] = [
  { level: 3, min: 2.5, max: 3.0, label: "Outstanding", meaning: "Most or all learning outcomes achieved." },
  {
    level: 2,
    min: 1.5,
    max: 2.49,
    label: "Moderate",
    meaning: "Many outcomes achieved, enough for overall achievement.",
  },
  { level: 1, min: 0.9, max: 1.49, label: "Basic", meaning: "Few outcomes achieved, not yet sufficient." },
];

export function getIdentifierLevel(avg: number): IdentifierLevel | null {
  return IDENTIFIER_LEVELS.find((l) => avg >= l.min && avg <= l.max) ?? null;
}

// ---------------------------------------------------------------------------
// Aggregates (UNEB official cutoffs; labels kept stable for the UI)
// ---------------------------------------------------------------------------

/** PLE: best-4 core-subject points (D1=1 … F9=9), total 4-36. */
export function pleAggregate(points: number[]): { aggregate: number | null; division: string } {
  if (points.length < 4) return { aggregate: null, division: "Ungraded" };
  const best4 = [...points].sort((a, b) => a - b).slice(0, 4);
  const aggregate = best4.reduce((s, v) => s + v, 0);
  return { aggregate, division: getPLEDivision(aggregate) };
}

const POINTS_TO_GRADE: Record<number, string> = {
  1: "D1",
  2: "D2",
  3: "C3",
  4: "C4",
  5: "C5",
  6: "C6",
  7: "P7",
  8: "P8",
  9: "F9",
};

export function pointsToGrade(points: number): string {
  return POINTS_TO_GRADE[points] ?? "F9";
}

/** Old O-level: best-8 points, Div I 8-32, II 33-45, III 46-58, IV 59-68. */
export function uceAggregate(points: number[]): { aggregate: number | null; division: string } {
  if (points.length < 8) return { aggregate: null, division: "Ungraded" };
  const best8 = [...points].sort((a, b) => a - b).slice(0, 8);
  const aggregate = best8.reduce((s, v) => s + v, 0);
  return { aggregate, division: getUCEDivision(best8.map(pointsToGrade)) };
}

// ---------------------------------------------------------------------------
// Track definitions
// ---------------------------------------------------------------------------

export interface GradingTrack {
  id: GradingTrackId;
  label: string;
  explain: string;
  /** Columns the entry screen shows for one subject, in order. */
  columns: TrackColumn[];
  /** Which printed subject table this track feeds by default. */
  defaultLayout: ReportLayoutId;
  /** Grade one subject average (null-safe: null in -> "—"). */
  gradeSubject: (avg: number | null) => string;
  /** Points one subject grade is worth toward an aggregate. */
  gradePoints: (grade: string) => number;
}

const PLE_POINTS: Record<string, number> = { D1: 1, D2: 2, C3: 3, C4: 4, C5: 5, C6: 6, P7: 7, P8: 8, F9: 9 };

const CLASSIC_COLUMNS: TrackColumn[] = [
  {
    keys: ["ca1", "ca2", "ca3", "ca4", "project", "u1", "u2", "class_test", "bot", "mid_term", "saturday"],
    label: "MID",
    explain: "Classwork average — every test, beginning-of-term, midterm and Saturday mark counts equally.",
  },
  {
    keys: ["exam", "eot"],
    label: "END",
    explain: "End-of-term exam mark. Counts 75% of the subject average.",
  },
];

export const GRADING_TRACKS: Record<GradingTrackId, GradingTrack> = {
  nursery: {
    id: "nursery",
    label: "Nursery (developmental)",
    explain:
      "Nursery is not examined. Teachers rate each learning area as Emerging (1), Developing (2) or Secure (3). No totals, aggregates or divisions — the report shows the levels plus the teacher's comment.",
    columns: [
      {
        keys: ["competency"],
        label: "Level",
        explain: "1 = Emerging, 2 = Developing, 3 = Secure for this learning area.",
      },
    ],
    defaultLayout: "uganda_classic",
    gradeSubject: () => "—",
    gradePoints: () => 0,
  },
  primary: {
    id: "primary",
    label: "Primary (PLE-style)",
    explain:
      "PLE-style grading. MID averages all classwork; END is the end-of-term exam; AVG is 25% MID + 75% END. Each subject grades D1-F9; the four core subjects (English, Maths, Science, SST) add up to the aggregate (best 4, lowest is best) and Division I-IV.",
    columns: CLASSIC_COLUMNS,
    defaultLayout: "uganda_classic",
    gradeSubject: (avg) => (avg === null ? "—" : getPLEGrade(avg)),
    gradePoints: (grade) => PLE_POINTS[grade] ?? 9,
  },
  secondary_old: {
    id: "secondary_old",
    label: "Secondary — old curriculum (O/A-level)",
    explain:
      "Old UNEB grading. O-level: same D1-F9 subject bands as primary with MID/END/AVG; best-8 aggregate gives Division I-IV. A-level (S5-S6): A-F grades with points toward the division.",
    columns: CLASSIC_COLUMNS,
    defaultLayout: "uganda_classic",
    gradeSubject: (avg) => (avg === null ? "—" : getUCEGrade(avg)),
    gradePoints: (grade) => PLE_POINTS[grade] ?? 9,
  },
  secondary_new: {
    id: "secondary_new",
    label: "Secondary — new curriculum (CBC)",
    explain:
      "NCDC competency-based grading. Identifier scores (0-3) average into the Formative mark out of 20; the end-of-year exam gives the Summative mark out of 80. Total out of 100 grades A*-G with a written descriptor.",
    columns: [
      {
        keys: ["competency", "identifier_score", "aoi"],
        label: "Identifiers",
        explain: "Activity-of-integration scores, 0-3 per outcome. Their average becomes the formative mark out of 20.",
      },
      {
        keys: ["eot", "exam"],
        label: "Summative",
        explain: "End-of-year exam percent. Counts 80% of the total.",
      },
    ],
    defaultLayout: "ncdc_cbc",
    gradeSubject: (avg) => (avg === null ? "—" : getCbcGrade(avg)),
    gradePoints: () => 0,
  },
};

// ---------------------------------------------------------------------------
// Resolving which track (and layout) applies
// ---------------------------------------------------------------------------

export function detectLevelFromClass(classNameOrLevel: string | null | undefined): "nursery" | "primary" | "secondary" {
  const s = (classNameOrLevel || "").toLowerCase();
  if (/(baby|middle|top|nursery|kg|kindergarten|daycare)/.test(s)) return "nursery";
  if (/\bp\.?\s?[1-7]\b|\bprimary\b|\bp[1-7]\b/.test(s)) return "primary";
  if (/\bs\.?\s?[1-6]\b|\bsecondary\b|\bsenior\b|\bs[1-6]\b|\bo[-\s]?level\b|\ba[-\s]?level\b/.test(s))
    return "secondary";
  return "primary";
}

/** Lower primary (P1-P3): marks and average only — no grades, aggregate or division. */
export function isLowerPrimary(classNameOrLevel: string | null | undefined): boolean {
  return /\bp\.?\s?[1-3]\b|\bp[1-3]\b/.test((classNameOrLevel || "").toLowerCase());
}

/** S5-S6 run A-level bands inside the old secondary track. */
export function isALevel(classNameOrLevel: string | null | undefined): boolean {
  return /\bs\.?\s?[56]\b|\bs[56]\b|\ba[-\s]?level\b/.test((classNameOrLevel || "").toLowerCase());
}

export function resolveTrackForClass(
  classNameOrLevel: string | null | undefined,
  settings?: Record<string, string>,
): GradingTrackId {
  const level = detectLevelFromClass(classNameOrLevel);
  if (level === "nursery") return "nursery";
  if (level === "primary") return "primary";
  const choice = settings?.[SETTING_KEYS.secondaryTrack] as SecondaryTrackChoice | undefined;
  return choice === "old" ? "secondary_old" : "secondary_new";
}

export function resolveLayout(settings?: Record<string, string>, track?: GradingTrackId): ReportLayoutId {
  const chosen = settings?.[SETTING_KEYS.reportLayout] as ReportLayoutId | undefined;
  if (chosen === "uganda_classic" || chosen === "ncdc_cbc") return chosen;
  if (track) return GRADING_TRACKS[track].defaultLayout;
  return "uganda_classic";
}

/** A-level subject grade + points (kept here so old-secondary A-level resolves in one place). */
export function aLevelGrade(avg: number | null): string {
  return avg === null ? "—" : getUACEGrade(avg);
}

export function aLevelPoints(
  principalGrades: string[],
  subsidiaryGrades: string[],
): { points: number; division: string } {
  return getUACEPoints(principalGrades, subsidiaryGrades);
}
