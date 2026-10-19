import {
  assessmentLabel,
  assessmentTypesFor,
  getGrade,
  getStudentTotal,
  isStudentGraded,
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
