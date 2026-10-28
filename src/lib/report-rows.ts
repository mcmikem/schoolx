/**
 * Report-card row configuration — the settings that make the printed card
 * match how a school actually reports.
 *
 * Two school realities drove this:
 *
 * 1. Subjects taught separately but graded as one line. Lower-primary
 *    science and social studies content lives inside the NCDC themes, so a
 *    P2 class may teach the two in separate lessons while the report card
 *    shows a single "Science and Social Studies" grade. Which subjects
 *    merge, and whether the merged line is the average or the best of its
 *    members, is the school's choice — set per class level (P.1, P.2, S.1…)
 *    with a school-wide default.
 *
 * 2. Which assessments feed the term grade. Some schools grade on the end-
 *    of-term exam only, some weight BOT/MOT/EOT, some run on continuous
 *    assessment. See TermGradeBasis in uganda-report.ts.
 *
 * Both live in school_settings (keys below) so they ride the same load the
 * report generator already does, need no migration, and apply identically
 * to on-screen cards, the print layout, and what is persisted to
 * report_cards.subjects.
 */

import { ugandaGrade, type UgandaSubjectResult, type TermGradeBasis } from "./uganda-report";

export type { TermGradeBasis, GradeBasisType } from "./uganda-report";

export const REPORT_ROWS_KEY = "report_rows_v1";
export const TERM_GRADE_BASIS_KEY = "term_grade_basis_v1";

export type ReportRowMode = "mean" | "best";

export interface ReportRowConfig {
  id: string;
  /** The line as printed on the card, e.g. "Science and Social Studies". */
  label: string;
  /** Subjects whose marks fold into this line. */
  subjectIds: string[];
  /** mean = average of members; best = the strongest member stands for the line. */
  mode: ReportRowMode;
}

export interface ReportRowsConfig {
  /** Rows for every class without a level-specific override. */
  default?: ReportRowConfig[];
  /** Overrides keyed by classes.level (e.g. "P.2"). */
  levels?: Record<string, ReportRowConfig[]>;
}

const GRADE_BASIS_TYPES: TermGradeBasis["types"][number][] = ["bot", "mid_term", "eot", "ca", "holiday_package"];

type GradeBasisType = TermGradeBasis["types"][number];

/** Tolerant parser: garbage in settings must never crash generation. */
export function parseTermGradeBasis(raw: unknown): TermGradeBasis | null {
  if (!raw) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { types?: unknown; weights?: unknown };
  if (!Array.isArray(candidate.types)) return null;
  const types = candidate.types.filter(
    (t): t is GradeBasisType => typeof t === "string" && GRADE_BASIS_TYPES.includes(t as GradeBasisType),
  );
  if (types.length === 0) return null;
  const weights: Partial<Record<GradeBasisType, number>> = {};
  if (typeof candidate.weights === "object" && candidate.weights !== null) {
    for (const [key, num] of Object.entries(candidate.weights as Record<string, unknown>)) {
      if (GRADE_BASIS_TYPES.includes(key as GradeBasisType) && Number.isFinite(Number(num)) && Number(num) > 0) {
        weights[key as GradeBasisType] = Number(num);
      }
    }
  }
  return { types, weights };
}

/** Tolerant parser for the report-rows configuration. */
export function parseReportRows(raw: unknown): ReportRowsConfig | null {
  if (!raw) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null) return null;
  const out: ReportRowsConfig = {};
  const candidate = value as { default?: unknown; levels?: unknown };
  const cleanList = (list: unknown): ReportRowConfig[] | null => {
    if (!Array.isArray(list)) return null;
    const rows = list
      .filter(
        (entry): entry is ReportRowConfig =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as ReportRowConfig).label === "string" &&
          Array.isArray((entry as ReportRowConfig).subjectIds) &&
          (entry as ReportRowConfig).subjectIds.length > 0,
      )
      .map((entry, i) => ({
        id: typeof entry.id === "string" && entry.id ? entry.id : `row-${i}`,
        label: entry.label,
        subjectIds: entry.subjectIds.filter((id): id is string => typeof id === "string"),
        mode: entry.mode === "best" ? ("best" as const) : ("mean" as const),
      }))
      .filter((entry) => entry.subjectIds.length > 0);
    return rows.length > 0 ? rows : null;
  };
  const def = cleanList(candidate.default);
  if (def) out.default = def;
  if (typeof candidate.levels === "object" && candidate.levels !== null) {
    out.levels = {};
    for (const [level, list] of Object.entries(candidate.levels as Record<string, unknown>)) {
      const rows = cleanList(list);
      if (rows) out.levels[level] = rows;
    }
    if (Object.keys(out.levels).length === 0) delete out.levels;
  }
  return out.default || out.levels ? out : null;
}

/** Rows for a class: the level override, else the school default. */
export function resolveReportRows(
  config: ReportRowsConfig | null | undefined,
  classLevel: string | null | undefined,
): ReportRowConfig[] {
  if (!config) return [];
  const forLevel = classLevel ? config.levels?.[classLevel] : undefined;
  if (forLevel && forLevel.length > 0) return forLevel;
  return config.default ?? [];
}

/** Shape shared by the card's subject entries (classic report path). */
export interface GroupableSubjectDetail {
  subjectId: string;
  name: string;
  score: number;
  grade: string;
  gradeColor?: string;
  competencyLevel?: string;
  competencyNotes?: string;
  isMissing?: boolean;
  uganda?: UgandaSubjectResult;
  [key: string]: unknown;
}

const mean = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

const meanOf = (values: Array<number | null>): number | null => mean(values.filter((v): v is number => v !== null));

/**
 * Fold the school's subject details into the configured report lines.
 * Unnamed subjects (not in any row) keep printing as their own lines after
 * the grouped ones — nothing a school records may silently vanish from the
 * card. With no rows configured this is the identity function.
 */
export function groupSubjectDetails<T extends GroupableSubjectDetail>(details: T[], rows: ReportRowConfig[]): T[] {
  if (!rows || rows.length === 0) return details;
  const byId = new Map(details.map((detail) => [detail.subjectId, detail]));
  const used = new Set<string>();
  const grouped: T[] = [];

  for (const row of rows) {
    const members = row.subjectIds
      .map((id) => byId.get(id))
      .filter((m): m is T => Boolean(m))
      // A member whose line came from the subjects-table filler has no marks;
      // it still counts as a member (it is why the row exists) but cannot
      // contribute a score.
      .map((m) => m);
    if (members.length === 0) continue;
    members.forEach((m) => used.add(m.subjectId));

    const present = members.filter((m) => !m.isMissing && (m.uganda ? m.uganda.avg != null : m.score > 0));
    const missing = present.length === 0;

    if (row.mode === "best") {
      const strongest = [...present].sort((a, b) => b.score - a.score)[0] ?? members[0];
      grouped.push({
        ...strongest,
        name: row.label,
        score: missing ? 0 : strongest.score,
        grade: missing ? "M.M" : strongest.grade,
        gradeColor: missing ? "text-amber-500" : strongest.gradeColor,
        isMissing: missing,
      } as T);
      continue;
    }

    const score = meanOf(present.map((m) => (m.uganda ? m.uganda.avg : m.score)));
    const uganda: UgandaSubjectResult = missing
      ? { mid: null, mot: null, end: null, avg: null, agg: null, grade: "—" }
      : {
          mid: meanOf(members.map((m) => m.uganda?.mid ?? null)),
          mot: meanOf(members.map((m) => m.uganda?.mot ?? null)),
          end: meanOf(members.map((m) => m.uganda?.end ?? null)),
          avg: score,
          agg: meanOf(present.map((m) => m.uganda?.agg ?? null)),
          grade: score != null ? ugandaGrade(score) : "—",
        };
    if (!missing && score != null && members.some((member) => member.uganda?.assessmentBreakdown?.length)) {
      const memberBreakdowns = members.map((member) => member.uganda?.assessmentBreakdown || []);
      const breakdownTypes = [
        ...new Set(memberBreakdowns.flatMap((breakdown) => breakdown.map((entry) => entry.type))),
      ];
      uganda.assessmentBreakdown = breakdownTypes.map((type) => ({
        type,
        label: memberBreakdowns.flatMap((breakdown) => breakdown).find((entry) => entry.type === type)?.label || type,
        score: meanOf(
          memberBreakdowns.map((breakdown) => breakdown.find((entry) => entry.type === type)?.score ?? null),
        ),
      }));
      if (uganda.assessmentBreakdown.some((entry) => entry.type === "holiday_package")) {
        uganda.grade = score >= 85 ? "A" : score >= 75 ? "B" : score >= 65 ? "C" : score >= 50 ? "D" : "E";
        uganda.gradeDescriptor =
          uganda.grade === "A"
            ? "Exhibits an outstanding level of competency"
            : uganda.grade === "B"
              ? "Exhibits a very good level of competency"
              : uganda.grade === "C"
                ? "Exhibits an adequate level of competency"
                : uganda.grade === "D"
                  ? "Exhibits a basic level of competency"
                  : "Exhibits little or no competency";
        uganda.agg = null;
      }
    }
    const withComp = members.find((m) => m.competencyLevel && m.competencyLevel !== "not_started");
    grouped.push({
      ...(members[0] as T),
      name: row.label,
      score: missing ? 0 : (score as number),
      grade: missing ? "M.M" : uganda.grade,
      gradeColor: missing ? "text-amber-500" : members[0].gradeColor,
      competencyLevel: withComp?.competencyLevel ?? members[0].competencyLevel,
      competencyNotes: withComp?.competencyNotes ?? members[0].competencyNotes,
      isMissing: missing,
      uganda,
    } as T);
  }

  const rest = details.filter((detail) => !used.has(detail.subjectId));
  return [...grouped, ...rest];
}
