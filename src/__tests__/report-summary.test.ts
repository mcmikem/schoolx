import { classicReportSubject, rankCompleteReports, summarizeClassicReport } from "@/lib/report-summary";
import { sumUgandaTotals } from "@/lib/uganda-report";

const exam = (score: number, maximum = 100) =>
  classicReportSubject([{ assessment_type: "exam", score, max_score: maximum }]);

describe("classical report calculations", () => {
  it("normalizes assessment maxima instead of adding raw assessment marks", () => {
    const subject = classicReportSubject([
      { assessment_type: "ca1", score: 90, max_score: 100 },
      { assessment_type: "ca2", score: 90, max_score: 100 },
      { assessment_type: "exam", score: 45, max_score: 50 },
    ]);
    expect(subject).toMatchObject({ score: 90, grade: "D1", isMissing: false });
    expect(subject.score).toBe(subject.uganda.avg);
  });

  it("keeps a recorded zero distinct from missing assessments", () => {
    expect(exam(0)).toMatchObject({ score: 0, isMissing: false, grade: "F9" });
    expect(classicReportSubject([])).toMatchObject({ isMissing: true, uganda: { avg: null, agg: null } });
  });

  it.each([
    [101, 100],
    [-1, 100],
    [80, 0],
    [80, -100],
    [Number.NaN, 100],
    [Number.POSITIVE_INFINITY, 100],
  ])("rejects invalid score/max pair %s/%s without clamping it", (score, maximum) => {
    expect(exam(score, maximum)).toMatchObject({ isMissing: true, uganda: { avg: null, grade: "—" } });
  });

  it("uses each student's recorded subject count and excludes missing subjects from the average", () => {
    const summary = summarizeClassicReport([exam(80), exam(60), classicReportSubject([])]);
    expect(summary).toMatchObject({
      totalMarks: 140,
      maxMarks: 200,
      average: 70,
      recordedSubjects: 2,
      isComplete: false,
      aggregate: null,
      division: "Incomplete",
    });
  });

  it("does not invent averages or a ranking for an entirely unmarked report", () => {
    const summary = summarizeClassicReport([classicReportSubject([])]);
    expect(summary).toMatchObject({ maxMarks: 0, recordedSubjects: 0, isComplete: false, aggregate: null });
    expect(rankCompleteReports([{ ...summary, position: 9 }])[0].position).toBe(0);
  });

  it("agrees with printed bucket averages and uses existing primary aggregate points", () => {
    const subjects = [exam(80), exam(75), exam(70), exam(65)];
    const summary = summarizeClassicReport(subjects, "P.7");
    expect(summary.average).toBe(sumUgandaTotals(subjects.map((subject) => subject.uganda)).avgMean);
    expect(summary).toMatchObject({
      totalMarks: 290,
      maxMarks: 400,
      average: 72.5,
      aggregate: 10,
      division: "Division I",
      isComplete: true,
    });
  });

  it("does not award a primary division to nursery or an incomplete old-secondary subject set", () => {
    expect(summarizeClassicReport([exam(80)], "Baby Class")).toMatchObject({
      division: "Not applicable",
      isRankable: false,
    });
    expect(summarizeClassicReport([exam(80), exam(75), exam(70), exam(65)], "S.2")).toMatchObject({
      aggregate: null,
      division: "Ungraded",
    });
  });

  it("ranks only comparable complete reports, with competition ties and stable input", () => {
    const reports = [
      { id: "partial", isComplete: false, totalMarks: 399, position: 7 },
      { id: "one", isComplete: true, totalMarks: 300, position: 0 },
      { id: "two", isComplete: true, totalMarks: 300, position: 0 },
      { id: "three", isComplete: true, totalMarks: 290, position: 0 },
    ];
    expect(rankCompleteReports(reports).map((report) => [report.id, report.position])).toEqual([
      ["one", 1],
      ["two", 1],
      ["three", 3],
      ["partial", 0],
    ]);
    expect(reports[0].position).toBe(7);
  });
});
