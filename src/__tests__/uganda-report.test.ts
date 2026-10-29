import {
  bucketUgandaSubject,
  sumUgandaTotals,
  orderUgandaSubjects,
  ugandaGrade,
  ugandaDivision,
} from "@/lib/uganda-report";
import { generateUgandaPrimaryBody, generateUgandaPrimaryHTML } from "@/components/reports/ugandaPrimaryReport";

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

  it("exposes progressive columns for schools recording only one exam type", () => {
    expect(
      bucketUgandaSubject([{ assessment_type: "holiday_package", score: 70, max_score: 100 }], {
        types: ["holiday_package"],
      }).assessmentBreakdown,
    ).toEqual([
      { type: "holiday_package", label: "HPG", score: 70 },
      { type: "final_average", label: "Final Average", score: 70 },
    ]);
    expect(
      bucketUgandaSubject([{ assessment_type: "mid_term", score: 62, max_score: 100 }], {
        types: ["holiday_package", "mid_term"],
      }).assessmentBreakdown,
    ).toEqual([
      { type: "holiday_package", label: "HPG", score: null },
      { type: "mid_term", label: "Midterm / Mock", score: 62 },
      { type: "final_average", label: "Final Average", score: 62 },
    ]);
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
      motto: "Learn and grow",
      logoUrl: "",
      sigClassUrl: "",
      sigHeadUrl: "",
    },
    pupil: {
      name: "Amina <b>Nakato</b>",
      studentNumber: "P3-001",
      gender: "Female",
      className: "P.3",
      photoUrl: "https://school.example/pupil.png?name=amina&size=small",
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
      // The official Ugandan form carries Class/Term/Year in the identity
      // block under the boxed title, not in a second boxed subtitle, so the
      // report matches the form an inspector expects.
      ">Term:<",
      ">2<",
      ">Year:<",
      ">2026<",
      "ACADEMIC PERFORMANCE",
      "TOTALS",
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
      "Learn and grow",
      "pupil.png?name=amina&amp;size=small",
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

  it("does not claim fees are cleared when the balance is unknown", () => {
    const html = generateUgandaPrimaryHTML({ ...baseInput, feeBalance: null });
    expect(html).toContain("Fees Balance:");
    expect(html).toContain("Not recorded");
    expect(html).not.toContain("Cleared");
  });

  describe("the BOT column follows the school's assessment setting", () => {
    it("prints BOT by default, so existing reports are unchanged", () => {
      const html = generateUgandaPrimaryHTML(baseInput);
      expect(html).toContain(">BOT<");
      // Header spans three mark columns: BOT, MOT, EOT.
      expect(html).toContain('colspan="3"');
    });

    it("drops the column entirely when the school does not run BOT", () => {
      // A blank column on a parent's copy reads as "the teacher did not record
      // it", so it must be absent rather than empty.
      const html = generateUgandaPrimaryHTML({ ...baseInput, showBot: false });
      expect(html).not.toContain(">BOT<");
      expect(html).toContain(">MOT<");
      expect(html).toContain(">EOT<");
      expect(html).toContain('colspan="2"');
    });

    it("keeps the TOTALS row spanning the full table either way", () => {
      for (const showBot of [true, false]) {
        const html = generateUgandaPrimaryBody({ ...baseInput, showBot });
        // 1 subject + N marks + avg/agg/grade/remarks. Mis-spanning here was the
        // original bug: a colspan=4 cell that shifted every column after it.
        const lead = showBot ? 4 : 3;
        expect(html).toContain(`colspan="${lead}"`);
      }
    });

    it("can print any selected combination of assessment columns", () => {
      const html = generateUgandaPrimaryBody({ ...baseInput, assessmentColumns: ["bot", "eot"] });
      expect(html).toContain(">BOT<");
      expect(html).toContain(">EOT<");
      expect(html).not.toContain(">MOT<");
      expect(html).not.toContain(">AVG %<");
    });

    it("can print averages and grades without individual exam columns", () => {
      const html = generateUgandaPrimaryBody({ ...baseInput, assessmentColumns: ["avg", "agg", "grade"] });
      expect(html).toContain(">AVG %<");
      expect(html).toContain(">AGG<");
      expect(html).not.toContain(">BOT<");
      expect(html).not.toContain(">MOT<");
      expect(html).not.toContain(">EOT<");
    });
  });
});
