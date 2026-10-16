/**
 * Turning a term's marks into something worth reading.
 *
 * A head teacher closing a term has one report per child in every class, and
 * no time to write 200 remarks. The alternative used here -- one of four fixed
 * sentences chosen by class position -- gave every child in the top five the
 * same words twice, which is not analysis and does not survive a parent
 * asking "what exactly did my child do well?".
 *
 * So this reads the actual pattern in the marks:
 *   - the direction of travel across BOT -> MOT -> EOT, not just the endpoint
 *   - whether a subject is genuinely weak, or the pupil is simply strong
 *     everywhere and nothing stands out
 *   - where the pupil sits against the class, which is a different fact from
 *     where they sit absolutely
 *   - attendance against their own trend, since a child present 90% of the
 *     term has a very different picture from one present 55%
 *
 * It produces evidence, not encouragement. A remark that says "Mathematics is
 * the weakest subject at 44% and fell from 70 at the start of term" is worth
 * printing; "good keep it up" is not.
 */

export interface AnalysisSubject {
  name: string;
  bot: number | null;
  mot: number | null;
  eot: number | null;
  avg: number | null;
  /** The class average for this subject, when known. */
  classAverage?: number | null;
}

export interface AnalysisInput {
  pupilName: string;
  subjects: AnalysisSubject[];
  attendancePresent?: number | null;
  attendanceTotal?: number | null;
  position?: number | null;
  classSize?: number | null;
  average?: number | null;
  division?: string | null;
}

const name = (full: string): string => full.trim().split(/\s+/)[0] || full;

const has = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Last recorded assessment in the term. */
function latest(s: AnalysisSubject): number | null {
  if (has(s.eot)) return s.eot;
  if (has(s.mot)) return s.mot;
  if (has(s.bot)) return s.bot;
  return null;
}

function firstRecorded(s: AnalysisSubject): number | null {
  if (has(s.bot)) return s.bot;
  if (has(s.mot)) return s.mot;
  if (has(s.eot)) return s.eot;
  return null;
}

export interface PupilAnalysis {
  /** Subjects ranked weakest first. */
  weakest: AnalysisSubject[];
  strongest: AnalysisSubject[];
  /** Subject with the largest fall from first to last recorded assessment. */
  declining: AnalysisSubject | null;
  /** Subject with the largest rise. */
  improving: AnalysisSubject | null;
  /** Subjects markedly below the pupil's own average. */
  lagging: AnalysisSubject[];
  /** Subjects markedly above the class average for that subject. */
  aheadOfClass: AnalysisSubject[];
  attendanceRate: number | null;
  trend: "rising" | "steady" | "falling" | null;
}

export function analysePupil(input: AnalysisInput): PupilAnalysis {
  const recorded = input.subjects.filter((s) => has(s.avg));
  const ranked = [...recorded].sort((a, b) => (a.avg as number) - (b.avg as number));

  const declining =
    ranked
      .map((s) => ({ s, delta: (latest(s) as number) - (firstRecorded(s) as number) }))
      .filter((x) => has(x.delta))
      .sort((a, b) => a.delta - b.delta)[0]?.s ?? null;

  const improving =
    ranked
      .map((s) => ({ s, delta: (latest(s) as number) - (firstRecorded(s) as number) }))
      .filter((x) => has(x.delta))
      .sort((a, b) => b.delta - a.delta)[0]?.s ?? null;

  const mean = has(input.average) && input.average > 0 ? input.average : null;
  const lagging = mean
    ? ranked.filter((s) => (s.avg as number) < mean - 8).slice(0, 3)
    : [];
  const aheadOfClass = ranked
    .filter((s) => has(s.classAverage) && has(s.avg) && (s.avg as number) > (s.classAverage as number) + 5)
    .slice(0, 3);

  const attendanceRate =
    has(input.attendancePresent) && has(input.attendanceTotal) && input.attendanceTotal > 0
      ? (input.attendancePresent / input.attendanceTotal) * 100
      : null;

  // Trend is the mean movement across subjects, so one bad subject does not
  // swing the whole reading.
  const deltas = ranked
    .map((s) => (latest(s) as number) - (firstRecorded(s) as number))
    .filter((d) => has(d));
  const meanDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  const trend =
    meanDelta === null ? null : meanDelta >= 3 ? "rising" : meanDelta <= -3 ? "falling" : "steady";

  return {
    weakest: ranked.slice(0, 2),
    strongest: [...ranked].reverse().slice(0, 2),
    declining,
    improving,
    lagging,
    aheadOfClass,
    attendanceRate,
    trend,
  };
}

const list = (names: string[]): string =>
  names.length <= 1
    ? names[0] ?? ""
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

const band = (avg: number): string =>
  avg >= 80 ? "above 80" : avg >= 70 ? "in the seventies" : avg >= 60 ? "in the sixties" : "below 60";

/** One paragraph of evidence. No praise that is not earned. */
export function writeAnalysisRemark(input: AnalysisInput): string {
  const who = name(input.pupilName);
  const a = analysePupil(input);
  const parts: string[] = [];

  if (has(input.average) && input.average > 0) {
    const div = input.division ? `, placing the class in ${input.division}` : "";
    parts.push(
      `${who} averaged ${Math.round(input.average as number)}% overall${div}, which is ${band(input.average as number)}.`,
    );
  }

  if (a.trend === "rising") {
    const how = a.improving ? `, led by ${a.improving.name}` : "";
    parts.push(`Marks moved upward across the term${how}.`);
  } else if (a.trend === "falling") {
    const how = a.declining ? `, most noticeably in ${a.declining.name}` : "";
    parts.push(`Marks moved downward across the term${how}, which needs attention before the next assessment.`);
  }

  if (a.aheadOfClass.length > 0) {
    parts.push(`Ahead of the class in ${list(a.aheadOfClass.map((s) => s.name))}.`);
  }

  if (a.lagging.length > 0) {
    const detail = a.lagging
      .map((s) => `${s.name} (${Math.round(s.avg as number)}%)`)
      .join(", ");
    parts.push(`Below the pupil's own average in ${detail}.`);
  }

  if (a.attendanceRate !== null) {
    const r = Math.round(a.attendanceRate);
    if (r >= 95) parts.push("Attendance is effectively full.");
    else if (r >= 85) parts.push("Attendance is good.");
    else if (r >= 70) parts.push(`Attendance is ${r}% and should improve.`);
    else parts.push(`Attendance is ${r}%, which is affecting progress and needs to be discussed at home.`);
  }

  if (
    has(input.position) &&
    has(input.classSize) &&
    input.classSize > 0 &&
    (input.position as number) > 0
  ) {
    parts.push(`Position ${input.position} of ${input.classSize}.`);
  }

  if (parts.length === 0) {
    return `${who} has begun this term. More recorded assessments will give a fuller picture.`;
  }
  return parts.join(" ");
}