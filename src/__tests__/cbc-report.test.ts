import {
  calculateCBCSubject,
  cbcIdentifierValue,
  generateCBCReportHTML,
  getCBCGrade,
  summarizeCBCSubjects,
  type CBCReportData,
  type CBCSubjectEntry,
  type CBCAssessmentRow,
} from "@/lib/cbc-report";

const subject = (rows: CBCAssessmentRow[], name = "Mathematics"): CBCSubjectEntry => ({
  name,
  teacherName: "Teacher",
  teacherRemark: "",
  teacherInitials: "MT",
  learningOutcomes: [],
  ...calculateCBCSubject(rows),
});
const completeRows: CBCAssessmentRow[] = [
  { assessment_type: "u1", identifier_score: 2.4 },
  { assessment_type: "u2", identifier_score: 2.4 },
  { assessment_type: "eot", score: 40, max_score: 50 },
];

function reportData(subjects: CBCSubjectEntry[]): CBCReportData {
  return {
    school: {
      name: "Test School",
      schoolCode: "TST",
      unebCenterNumber: "",
      phone: "",
      email: "",
      address: "",
      logoUrl: "",
      motto: "",
      primaryColor: "#17325f",
    },
    student: {
      firstName: "Test",
      lastName: "Learner",
      fullName: "Test Learner",
      studentNumber: "TEST-001",
      photoUrl: "",
      className: "S.2",
      formClass: "Form",
      gender: "F",
    },
    term: 1,
    academicYear: "2026",
    examTitle: "Term results",
    subjects,
    summary: summarizeCBCSubjects(subjects),
    gradingScheme: "",
    identifierRanges: [],
    classTeacher: { name: "Teacher", comment: "" },
    headTeacher: { name: "Head", comment: "" },
    nextTermOpens: "—",
    dateOfIssue: "15 October 2026",
  };
}

describe("CBC calculation and print consistency", () => {
  it("normalizes exam maxima and preserves the existing 20/80 calculation", () => {
    expect(calculateCBCSubject(completeRows)).toMatchObject({
      formativeScore: 16,
      eotScore: 80,
      summativeScore: 64,
      totalMark: 80,
      grade: "A",
    });
  });

  it("retains an explicit zero identifier instead of falling back to another score", () => {
    expect(cbcIdentifierValue({ assessment_type: "u1", identifier_score: 0, score: 3 })).toBe(0);
    expect(
      calculateCBCSubject([
        { assessment_type: "competency", identifier_score: 0, score: 3 },
        { assessment_type: "exam", score: 0, max_score: 100 },
      ]),
    ).toMatchObject({ averageIdentifier: 0, formativeScore: 0, totalMark: 0, grade: "G" });
  });

  it("accepts current explicit identifier assessments as well as legacy unit pairs", () => {
    expect(
      calculateCBCSubject([
        { assessment_type: "aoi", score: 2.4 },
        { assessment_type: "exam", score: 80, max_score: 100 },
      ]),
    ).toMatchObject({ totalMark: 80, grade: "A" });
  });

  it("includes project and continuous-assessment evidence without including those display fields in the total", () => {
    const result = calculateCBCSubject([
      { assessment_type: "project", score: 30, max_score: 40 },
      { assessment_type: "ca1", score: 15, max_score: 20 },
      { assessment_type: "ca2", score: 18, max_score: 20 },
      ...completeRows,
    ]);
    expect(result).toMatchObject({ projectScore: 75, continuousAssessmentScore: 82.5, totalMark: 80 });
  });

  it("does not turn missing identifiers or an absent exam into a zero or a fail grade", () => {
    expect(calculateCBCSubject([])).toMatchObject({ totalMark: null, grade: "—", u1Average: null, u2Average: null });
    expect(
      calculateCBCSubject([
        { assessment_type: "u1", score: 2 },
        { assessment_type: "eot", score: 80 },
      ]),
    ).toMatchObject({ formativeScore: null, totalMark: null, grade: "—" });
    expect(calculateCBCSubject(completeRows.slice(0, 2))).toMatchObject({
      eotScore: null,
      summativeScore: null,
      totalMark: null,
    });
  });

  it.each([
    -1,
    3.1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("treats invalid identifier %s as unknown without clamping", (value) => {
    expect(
      calculateCBCSubject([
        { assessment_type: "identifier_score", score: value },
        { assessment_type: "eot", score: 80 },
      ]).totalMark,
    ).toBeNull();
  });

  it.each([
    [101, 100],
    [-1, 100],
    [80, 0],
    [80, -100],
  ])("rejects invalid exam score/max pair %s/%s", (score, maximum) => {
    expect(
      calculateCBCSubject([
        { assessment_type: "competency", score: 2 },
        { assessment_type: "exam", score, max_score: maximum },
      ]).totalMark,
    ).toBeNull();
  });

  it("grades decimal class averages without gaps between adjacent bands", () => {
    expect([84.5, 79.5, 74.5, 69.5, 64.5, 49.5, 39.5].map(getCBCGrade)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(getCBCGrade(Number.NaN)).toBe("—");
  });

  it("excludes incomplete subjects from both the denominator and component totals", () => {
    const summary = summarizeCBCSubjects([subject(completeRows), subject([{ assessment_type: "eot", score: 100 }])]);
    expect(summary).toMatchObject({
      totalFormative: 16,
      totalEot: 80,
      totalSummative: 64,
      totalMarkSum: 80,
      overallAverage: 80,
      recordedSubjects: 1,
      averageGrade: "Incomplete",
      isComplete: false,
    });
  });

  it("prints unknown marks as dashes with aligned summary columns and no fabricated grade", () => {
    const html = generateCBCReportHTML(reportData([subject([])]));
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.querySelector(".cbc-overall-average")).toHaveTextContent("—");
    expect(container.querySelector(".cbc-provisional")).toHaveTextContent("Provisional");
    const table = container.querySelector(".cbc-summary-table")!;
    expect(table.querySelectorAll("thead th")).toHaveLength(12);
    expect(table.querySelectorAll("tbody tr:first-child td")).toHaveLength(12);
    expect(table.querySelectorAll("tfoot td")).toHaveLength(12);
    expect(table.querySelector("tbody tr")!.children[9]).toHaveTextContent("—");
    expect(table.querySelector("tbody tr")!.children[10]).toHaveTextContent("—");
    expect(html).not.toContain("NaN");
  });

  it("prints the same known average as the scoring summary and retains recorded zero", () => {
    const known = subject(completeRows);
    const zero = subject(
      [
        { assessment_type: "competency", score: 0 },
        { assessment_type: "eot", score: 0 },
      ],
      "English",
    );
    const summary = summarizeCBCSubjects([known, zero]);
    const container = document.createElement("div");
    container.innerHTML = generateCBCReportHTML(reportData([known, zero]));
    expect(summary.overallAverage).toBe(40);
    expect(container.querySelector(".cbc-overall-average")).toHaveTextContent("40.0%");
    expect(container.querySelector(".cbc-provisional")).toBeNull();
    expect(container.querySelectorAll(".cbc-summary-table tbody tr")[1].children[9]).toHaveTextContent("0");
  });

  it("prints project and continuous-assessment columns plus AOI labels", () => {
    const evidence = subject([
      { assessment_type: "aoi", score: 2 },
      { assessment_type: "project", score: 75, max_score: 100 },
      { assessment_type: "ca1", score: 80, max_score: 100 },
      ...completeRows,
    ]);
    evidence.learningOutcomes = [{ description: "Activity 1", u1Score: null, u2Score: null, identifierScore: 2, scoreLabel: "AOI level" }];
    const container = document.createElement("div");
    container.innerHTML = generateCBCReportHTML(reportData([evidence]));
    expect(container.querySelector(".cbc-summary-table thead")).toHaveTextContent("Project");
    expect(container.querySelector(".cbc-summary-table thead")).toHaveTextContent("CA");
    expect(container.querySelector(".cbc-outcome-score")).toHaveTextContent("AOI level: 2.0");
    expect(container.querySelector(".cbc-evidence")).toHaveTextContent("Project: 75.0%");
    expect(container.querySelector(".cbc-evidence")).toHaveTextContent("Continuous assessment: 80.0%");
  });
});
