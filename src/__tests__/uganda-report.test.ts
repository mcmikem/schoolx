import {
  bucketUgandaSubject,
  sumUgandaTotals,
  orderUgandaSubjects,
  ugandaGrade,
  ugandaDivision,
} from "@/lib/uganda-report";
import { generateUgandaPrimaryHTML } from "@/components/reports/ugandaPrimaryReport";

describe("bucketUgandaSubject", () => {
  it("reports BOT, MOT and EOT separately and prefers explicit EOT over legacy exam", () => {
    const result = bucketUgandaSubject([
      { assessment_type: "bot", score: 70, max_score: 100 },
      { assessment_type: "mid_term", score: 80, max_score: 100 },
      { assessment_type: "exam", score: 60, max_score: 100 },
      { assessment_type: "eot", score: 10, max_score: 100 },
    ]);
    expect(result.mid).toBe(70);
    expect(result.mot).toBe(80);
    expect(result.end).toBe(10);
    expect(result.avg).toBe(53);
    expect(result.grade).toBe("P7");
    expect(result.agg).toBe(7);
  });

  it("uses a legacy exam as EOT only when an explicit EOT mark is absent", () => {
    expect(bucketUgandaSubject([{ assessment_type: "exam", score: 76, max_score: 100 }])).toMatchObject({
      end: 76,
      avg: 76,
    });
  });

  it("falls back to eot when no exam row exists", () => {
    const result = bucketUgandaSubject([{ assessment_type: "eot", score: 55, max_score: 100 }]);
    expect(result).toMatchObject({ mid: null, end: 55, avg: 55, grade: "C6", agg: 6 });
  });

  it("falls back to percent-of-possible for CA-only schools", () => {
    const result = bucketUgandaSubject([
      { assessment_type: "ca1", score: 8, max_score: 10 },
      { assessment_type: "ca2", score: 7, max_score: 10 },
      { assessment_type: "exam", score: 0, max_score: 100 },
    ]);
    // exam row exists (0 is a recorded mark, not missing) so END is real;
    // MID has nothing recorded.
    expect(result.mid).toBeNull();
    expect(result.end).toBe(0);
    expect(result.avg).toBe(0);
    expect(result.grade).toBe("F9");
  });

  it("computes percent-of-possible when no exams exist at all", () => {
    const result = bucketUgandaSubject([
      { assessment_type: "ca1", score: 8, max_score: 10 },
      { assessment_type: "ca2", score: 7, max_score: 10 },
      { assessment_type: "project", score: 15, max_score: 20 },
    ]);
    // 30/40 = 75% — same band as a 75 exam, honestly derived.
    expect(result).toMatchObject({ mid: null, end: null, avg: 75, grade: "D2", agg: 2 });
  });

  it("returns nulls — never zeros — for a subject with no rows", () => {
    expect(bucketUgandaSubject([])).toEqual({ mid: null, mot: null, end: null, avg: null, agg: null, grade: "—" });
  });
});

describe("ugandaGrade + ugandaDivision", () => {
  it("matches the printed UNEB legend exactly", () => {
    expect([80, 75, 70, 65, 60, 55, 50, 45, 44].map(ugandaGrade)).toEqual([
      "D1",
      "D2",
      "C3",
      "C4",
      "C5",
      "C6",
      "P7",
      "P8",
      "F9",
    ]);
  });

  it("divides aggregates per UNEB bands", () => {
    expect([12, 13, 23, 24, 29, 30, 34, 35].map(ugandaDivision)).toEqual([
      "DIV I",
      "DIV II",
      "DIV II",
      "DIV III",
      "DIV III",
      "DIV IV",
      "DIV IV",
      "U",
    ]);
    expect(ugandaDivision(null)).toBe("—");
  });
});

describe("sumUgandaTotals", () => {
  it("sums displayed buckets and divides the aggregate", () => {
    const totals = sumUgandaTotals([
      { mid: 70, end: 60, avg: 65, agg: 4 },
      { mid: null, end: 80, avg: 80, agg: 1 },
      { mid: null, end: null, avg: null, agg: null },
    ]);
    expect(totals).toMatchObject({ midTotal: 70, endTotal: 140, avgMean: 72.5, aggSum: 5, division: "DIV I" });
  });

  it("renders dashes when nothing is marked anywhere", () => {
    expect(sumUgandaTotals([])).toMatchObject({ midTotal: null, endTotal: null, avgMean: null });
    expect(sumUgandaTotals([]).division).toBe("—");
  });
});

describe("orderUgandaSubjects", () => {
  it("orders canonical primary subjects, unknown names last and stable", () => {
    const ordered = orderUgandaSubjects([
      { name: "Kiswahili" },
      { name: "Mathematics" },
      { name: "English" },
      { name: "Art" },
    ]).map((s) => s.name);
    expect(ordered).toEqual(["English", "Mathematics", "Kiswahili", "Art"]);
  });
});

describe("generateUgandaPrimaryHTML", () => {
  const baseInput = {
    school: {
      name: "Kikunyu Infant PS",
      address: "Kampala",
      phone: "0700",
      logoUrl: "",
      sigClassUrl: "",
      sigHeadUrl: "",
    },
    pupil: {
      name: "Amina <b>Nakato</b>",
      studentNumber: "P3-001",
      gender: "Female",
      className: "P.3",
      term: 2,
      year: "2026",
      attendancePresent: 58,
      attendanceTotal: 62,
    },
    subjects: [
      { name: "English", bot: 70, mot: 75, eot: 80, avg: 75, agg: 2, grade: "D2", remarks: "" },
      { name: "Mathematics", bot: null, mot: null, eot: null, avg: null, agg: null, grade: "—", remarks: "" },
    ],
    totals: { midTotal: 70, endTotal: 80, avgMean: 75, aggSum: 2, division: "DIV I" },
    comments: { classTeacher: "Good progress", hm: "" },
    feeBalance: 45000,
    nextTermBegins: "08/02/2027",
  };

  it("renders every reference section with real data", () => {
    const html = generateUgandaPrimaryHTML(baseInput);
    for (const needle of [
      "PRIMARY PUPIL'S PROGRESS REPORT",
      "TERM ACADEMIC REPORT",
      "ACADEMIC PERFORMANCE",
      "BOT",
      "MOT",
      "EOT",
      "MARKS (EACH OUT OF 100)",
      "GRADING SYSTEM",
      "0-44: F9 (Fail) | X: Absent",
      "BEHAVIOUR",
      "Class Teacher's Remarks",
      "Head Teacher's Remarks",
      "SCHOOL",
      "STAMP",
      "DIV I",
      "UGX 45,000",
      "58",
      "Good progress",
    ]) {
      expect(html).toContain(needle);
    }
  });

  it("escapes pupil-controlled strings (XSS through names/comments)", () => {
    const html = generateUgandaPrimaryHTML(baseInput);
    expect(html).not.toContain("<b>Nakato</b>");
    expect(html).toContain("Amina &lt;b&gt;Nakato&lt;/b&gt;");
  });

  it("renders dashes — never zeros — for missing marks", () => {
    const html = generateUgandaPrimaryHTML({
      ...baseInput,
      subjects: [{ name: "English", bot: null, mot: null, eot: null, avg: null, agg: null, grade: "—", remarks: "" }],
      totals: { midTotal: null, endTotal: null, avgMean: null, aggSum: null, division: "—" },
    });
    expect(html).toContain(">—<");
    expect(html).not.toContain(">0<");
  });
});
