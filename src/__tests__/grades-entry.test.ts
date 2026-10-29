import {
  assessmentLabel,
  assessmentTypesFor,
  ASSESSMENT_MAX,
  averageOfTotals,
  columnAverage,
  getGrade,
  getStudentTotal,
  isStudentGraded,
  parseMarkKey,
  parseAssessmentMaxScores,
  readMark,
} from "@/lib/grades/entry";

describe("grade scale", () => {
  it.each([
    [100, "D1"],
    [80, "D1"],
    [79, "D2"],
    [70, "D2"],
    [65, "C3"],
    [60, "C4"],
    [55, "C5"],
    [50, "C6"],
    [45, "P7"],
    [40, "P8"],
    [39, "F9"],
    [0, "F9"],
  ])("maps %i to %s", (score, division) => {
    expect(getGrade(score).grade).toBe(division);
  });
});

describe("assessment columns", () => {
  it("shows only competency when competency mode is on", () => {
    expect(assessmentTypesFor(true, true)).toEqual(["competency"]);
  });

  it("hides BOT when the school does not use it", () => {
    expect(assessmentTypesFor(false, false)).toEqual(["mid_term", "eot"]);
  });

  it("shows BOT/MID/EOT when the school uses BOT", () => {
    expect(assessmentTypesFor(false, true)).toEqual(["bot", "mid_term", "eot"]);
  });
});

describe("school assessment maxima", () => {
  it("defaults every numeric assessment to 100", () => {
    expect(parseAssessmentMaxScores(null)).toEqual(ASSESSMENT_MAX);
  });

  it("accepts valid school-specific maxima and ignores invalid or unknown values", () => {
    expect(parseAssessmentMaxScores({ eot: 80, mid_term: 50, bot: 0, custom: 25 })).toMatchObject({
      eot: 80,
      mid_term: 50,
      bot: 100,
    });
    expect(parseAssessmentMaxScores({ eot: 80, mid_term: 50, bot: 0, custom: 25 })).not.toHaveProperty("custom");
  });

  it("uses the three-point maximum for AOI and identifier levels", () => {
    expect(parseAssessmentMaxScores(null)).toMatchObject({ aoi: 3, identifier_score: 3 });
    expect(assessmentLabel("aoi")).toBe("Activity of Integration (AOI)");
    expect(assessmentLabel("identifier_score")).toBe("Identifier Score");
    expect(parseMarkKey("student_id_identifier_score")).toEqual({
      studentId: "student_id",
      assessmentType: "identifier_score",
    });
  });
});

describe("mark reading and totals", () => {
  const marks = {
    s1_bot: 60,
    s1_mid_term: 80,
    s1_eot: null,
    s2_bot: null,
    s2_mid_term: null,
    s2_eot: null,
    s3_competency: 3,
  };

  it("reads a mark, treating a missing cell as null", () => {
    expect(readMark(marks, "s1", "bot")).toBe(60);
    expect(readMark(marks, "s1", "eot")).toBeNull();
    expect(readMark(marks, "s9", "bot")).toBeNull();
  });

  it("averages only the recorded traditional marks", () => {
    expect(getStudentTotal(marks, "s1", false)).toBe(70);
  });

  it("returns null when a pupil has no traditional marks", () => {
    expect(getStudentTotal(marks, "s2", false)).toBeNull();
  });

  it("returns the competency level in competency mode", () => {
    expect(getStudentTotal(marks, "s3", true)).toBe(3);
  });

  it("requires every expected column before counting as graded", () => {
    expect(isStudentGraded(marks, "s1", false, false)).toBe(false);
    expect(isStudentGraded({ ...marks, s1_eot: 50 }, "s1", false, false)).toBe(true);
    expect(isStudentGraded(marks, "s1", false, true)).toBe(false);
    expect(isStudentGraded(marks, "s3", true, true)).toBe(true);
  });
});

describe("assessment labels", () => {
  it("uses friendly defaults and falls back to a readable name", () => {
    expect(assessmentLabel("mid_term")).toBe("Mid Term");
    expect(assessmentLabel("ca2")).toBe("CA2");
    expect(assessmentLabel("custom_test")).toBe("CUSTOM TEST");
  });
});

describe("class averages", () => {
  const marks = {
    a_bot: 50,
    b_bot: 70,
    c_bot: null,
    a_eot: 40,
    b_eot: null,
  };

  it("averages a column across pupils, ignoring blanks", () => {
    expect(columnAverage(marks, ["a", "b", "c"], "bot")).toBe(60);
    expect(columnAverage(marks, ["c"], "bot")).toBeNull();
  });

  it("averages per-pupil totals, ignoring pupils with no marks", () => {
    // a has 50/40 -> 45; b has only bot 70 -> 70; c has nothing.
    expect(averageOfTotals(marks, ["a", "b", "c"], false)).toBe(57.5);
    expect(averageOfTotals(marks, ["c"], false)).toBeNull();
  });
});

describe("parseMarkKey", () => {
  it("keeps UUID student IDs intact when the assessment type contains an underscore", () => {
    expect(parseMarkKey("41238a22-9bde-4076-811c-a7c2309648b6_mid_term")).toEqual({
      studentId: "41238a22-9bde-4076-811c-a7c2309648b6",
      assessmentType: "mid_term",
    });
    expect(parseMarkKey("41238a22-9bde-4076-811c-a7c2309648b6_holiday_package")).toEqual({
      studentId: "41238a22-9bde-4076-811c-a7c2309648b6",
      assessmentType: "holiday_package",
    });
  });

  it("handles single-word assessment types and student IDs with underscores", () => {
    expect(parseMarkKey("41238a22-9bde-4076-811c-a7c2309648b6_bot")).toEqual({
      studentId: "41238a22-9bde-4076-811c-a7c2309648b6",
      assessmentType: "bot",
    });
    expect(parseMarkKey("demo_student_1_mid_term")).toEqual({
      studentId: "demo_student_1",
      assessmentType: "mid_term",
    });
  });
});
