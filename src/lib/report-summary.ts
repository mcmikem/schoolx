import { detectLevelFromClass, isALevel, pleAggregate, uceAggregate } from "@/lib/grading-tracks";
import {
  bucketUgandaSubject,
  type TermGradeBasis,
  type UgandaGradeRow,
  type UgandaSubjectResult,
} from "@/lib/uganda-report";

export function classicReportSubject(rows: UgandaGradeRow[], basis?: TermGradeBasis | null) {
  const uganda = bucketUgandaSubject(rows, basis);
  return { score: uganda.avg ?? 0, grade: uganda.grade, isMissing: uganda.avg === null, uganda };
}

export function summarizeClassicReport(
  subjects: { isMissing?: boolean; uganda?: UgandaSubjectResult }[],
  className = "P.1",
) {
  const recorded = subjects.filter((subject) => !subject.isMissing && subject.uganda?.avg != null);
  const totalMarks = Math.round(recorded.reduce((total, subject) => total + subject.uganda!.avg!, 0) * 10) / 10;
  const complete = subjects.length > 0 && recorded.length === subjects.length;
  const points = recorded.map((subject) => subject.uganda!.agg).filter((value): value is number => value != null);
  const level = detectLevelFromClass(className);
  const aggregate = !complete
    ? { aggregate: null, division: "Incomplete" }
    : level === "nursery" || isALevel(className)
      ? { aggregate: null, division: "Not applicable" }
      : level === "secondary"
        ? uceAggregate(points)
        : pleAggregate(points);
  return {
    totalMarks,
    maxMarks: recorded.length * 100,
    average: recorded.length ? Math.round((totalMarks / recorded.length) * 10) / 10 : 0,
    recordedSubjects: recorded.length,
    isComplete: complete,
    isRankable: complete && level !== "nursery",
    aggregate: aggregate.aggregate,
    division: aggregate.division,
  };
}

export function rankCompleteReports<
  Report extends { totalMarks: number; isComplete?: boolean; isRankable?: boolean; position: number },
>(reports: Report[]): Report[] {
  const eligible = (report: Report) => report.isComplete && report.isRankable !== false;
  const sorted = [...reports].sort(
    (left, right) =>
      Number(Boolean(eligible(right))) - Number(Boolean(eligible(left))) || right.totalMarks - left.totalMarks,
  );
  let rank = 0;
  let previousTotal: number | null = null;
  let previousPosition = 0;
  return sorted.map((report) => {
    if (!eligible(report)) return { ...report, position: 0 };
    rank++;
    const position = report.totalMarks === previousTotal ? previousPosition : rank;
    previousTotal = report.totalMarks;
    previousPosition = position;
    return { ...report, position };
  });
}
