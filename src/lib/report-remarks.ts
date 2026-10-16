/**
 * Suggested class-teacher and head-teacher remarks.
 *
 * Teachers currently have to invent a paragraph per child per term, and the
 * result is usually either blank or the same sentence copied onto every
 * report in the class. The facts a remark should reflect are already on the
 * page: how often the child attended, how they averaged, how that compares
 * with the class, and which subjects carried them.
 *
 * This derives that sentence. It is a *suggestion*: the teacher reads it,
 * edits it, and it becomes their words. Nothing here is written to the report
 * automatically -- a comment the teacher did not write and did not agree to
 * is worse than a blank one.
 */

export interface RemarkSubject {
  name: string;
  avg: number | null;
  grade?: string;
}

export interface RemarkFacts {
  pupilName: string;
  className?: string | null;
  position?: number | null;
  classSize?: number | null;
  attendancePresent?: number | null;
  attendanceTotal?: number | null;
  average?: number | null;
  division?: string | null;
  subjects?: RemarkSubject[];
  /** Average on the previous term, when the school has it recorded. */
  previousAverage?: number | null;
}

const firstName = (full: string): string => full.trim().split(/\s+/)[0] || full;

/** "Namata" is the Ugandan plural sense of "good at". */
function performancePhrase(average: number): string {
  if (average >= 80) return "an excellent performance";
  if (average >= 70) return "a very good performance";
  if (average >= 60) return "a good performance";
  if (average >= 50) return "a fair performance";
  return "work that needs more effort";
}

function attendancePhrase(present: number, total: number): string {
  const rate = (present / total) * 100;
  if (rate >= 95) return "excellent attendance";
  if (rate >= 85) return "very good attendance";
  if (rate >= 75) return "good attendance";
  if (rate >= 60) return "attendance that needs improving";
  return "irregular attendance that we must address together";
}

/** Grades the school would be happy to see; used to name a strength. */
const STRONG = new Set(["D1", "D2", "C3", "C4"]);

export function suggestClassTeacherRemark(facts: RemarkFacts): string {
  const parts: string[] = [];
  const who = firstName(facts.pupilName);

  const { attendancePresent, attendanceTotal, average, subjects } = facts;

  if (
    typeof attendancePresent === "number" &&
    typeof attendanceTotal === "number" &&
    attendanceTotal > 0
  ) {
    parts.push(
      `${who} has recorded ${attendancePresent} out of ${attendanceTotal} days this term, showing ${attendancePhrase(
        attendancePresent,
        attendanceTotal,
      )}.`,
    );
  }

  if (typeof average === "number") {
    let sentence = `The overall average is ${Math.round(average)}%, which is ${performancePhrase(average)}.`;
    if (
      typeof facts.previousAverage === "number" &&
      Number.isFinite(facts.previousAverage) &&
      facts.previousAverage > 0
    ) {
      const delta = Math.round(average - facts.previousAverage);
      if (delta >= 3) sentence += ` That is an improvement of ${delta} marks on last term.`;
      else if (delta <= -3) sentence += ` That is ${Math.abs(delta)} marks below last term and needs attention.`;
    }
    parts.push(sentence);
  }

  if (typeof facts.position === "number" && typeof facts.classSize === "number" && facts.classSize > 0) {
    parts.push(`In class, ${who} is position ${facts.position} out of ${facts.classSize}.`);
  }

  const strong = (subjects ?? []).filter((s) => typeof s.avg === "number" && STRONG.has((s.grade ?? "").toUpperCase()));
  const weak = (subjects ?? []).filter((s) => typeof s.avg === "number" && s.avg < 50);

  if (strong.length > 0) {
    parts.push(`Doing well in ${listSubjects(strong.map((s) => s.name))}.`);
  }
  if (weak.length > 0) {
    parts.push(`Needs extra support in ${listSubjects(weak.map((s) => s.name))}.`);
  }

  if (parts.length === 0) {
    return `${who} has started this term well. More marks will give a fuller picture.`;
  }

  return parts.join(" ");
}

/** Head teacher: shorter, whole-school tone, looks at effort and conduct. */
export function suggestHeadTeacherRemark(facts: RemarkFacts): string {
  const who = firstName(facts.pupilName);
  const { attendancePresent, attendanceTotal, average, division, position } = facts;
  const parts: string[] = [];

  if (
    typeof attendancePresent === "number" &&
    typeof attendanceTotal === "number" &&
    attendanceTotal > 0
  ) {
    parts.push(`${who} attended ${attendancePresent} of ${attendanceTotal} days.`);
  }

  if (typeof average === "number") {
    const target = average >= 70 ? "met" : average >= 60 ? "nearly met" : "has not yet met";
    parts.push(
      `${who} ${target} the expectation for this class, averaging ${Math.round(average)}%${
        division ? ` in ${division}` : ""
      }.`,
    );
  }

  if (typeof position === "number" && position <= 10) {
    parts.push("Keep up the good work.");
  } else {
    parts.push("Continued effort at home will make a real difference.");
  }

  return parts.join(" ");
}

function listSubjects(names: string[]): string {
  const unique = [...new Set(names)].slice(0, 3);
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
}