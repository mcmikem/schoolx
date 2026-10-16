import { analysePupil, writeAnalysisRemark } from "@/lib/report-analysis";

/**
 * These remarks go on a document a parent keeps. The bar is that each one
 * says something specific and true about that child, and that two children
 * with the same average do not come out word-for-word identical -- which is
 * what the previous four-fixed-sentences approach produced for every child in
 * the top five.
 */

const subject = (
  name: string,
  bot: number | null,
  mot: number | null,
  eot: number | null,
  avg: number | null,
  classAverage: number | null = null,
) => ({ name, bot, mot, eot, avg, classAverage });

const pupil = {
  pupilName: "Amina Nakato",
  average: 81,
  division: "DIV 1",
  position: 2,
  classSize: 40,
  attendancePresent: 60,
  attendanceTotal: 62,
  subjects: [
    subject("English", 78, 84, 88, 83, 72),
    subject("Mathematics", 72, 69, 74, 72, 70),
    subject("Science", 80, 85, 82, 82, 68),
  ],
};

describe("analysePupil", () => {
  it("reads the direction of travel across the term, not just the endpoint", () => {
    const rising = analysePupil({
      ...pupil,
      subjects: [subject("English", 60, 72, 84, 72, 70)],
    });
    expect(rising.trend).toBe("rising");
    expect(rising.improving?.name).toBe("English");

    const falling = analysePupil({
      ...pupil,
      subjects: [subject("English", 84, 72, 60, 72, 70)],
    });
    expect(falling.trend).toBe("falling");
    expect(falling.declining?.name).toBe("English");
  });

  it("finds subjects ahead of the class, not just strong ones", () => {
    const analysis = analysePupil(pupil);
    // Science is strong AND above the class; Mathematics is strong but not.
    expect(analysis.aheadOfClass.map((s) => s.name)).toContain("Science");
    expect(analysis.aheadOfClass.map((s) => s.name)).not.toContain("Mathematics");
  });

  it("flags subjects below the pupil's own average", () => {
    const analysis = analysePupil({
      ...pupil,
      average: 80,
      subjects: [subject("English", 80, 80, 80, 80), subject("Art", 40, 44, 42, 42)],
    });
    expect(analysis.lagging.map((s) => s.name)).toEqual(["Art"]);
  });

  it("computes an attendance rate only when there is a total", () => {
    expect(analysePupil(pupil).attendanceRate).toBeCloseTo((60 / 62) * 100, 5);
    expect(analysePupil({ ...pupil, attendancePresent: 0, attendanceTotal: 0 }).attendanceRate).toBeNull();
  });

  it("tolerates a subject with nothing recorded", () => {
    const analysis = analysePupil({
      ...pupil,
      subjects: [subject("New subject", null, null, null, null), subject("English", 78, 84, 88, 83, 72)],
    });
    expect(analysis.weakest.map((s) => s.name)).toEqual(["English"]);
  });
});

describe("writeAnalysisRemark", () => {
  it("states the average, the division and the position", () => {
    const text = writeAnalysisRemark(pupil);
    expect(text).toContain("Amina");
    expect(text).toContain("81%");
    expect(text).toContain("DIV 1");
    expect(text).toContain("Position 2 of 40");
  });

  it("gives two pupils with the same average different text", () => {
    const rising = writeAnalysisRemark({
      ...pupil,
      pupilName: "Nabirye Sarah",
      subjects: [subject("English", 70, 78, 86, 78, 72)],
    });
    const falling = writeAnalysisRemark({
      ...pupil,
      pupilName: "Kato Brian",
      average: 44,
      division: "DIV 4",
      position: 38,
      attendancePresent: 34,
      subjects: [subject("English", 84, 72, 60, 72, 72)],
    });
    expect(rising).not.toBe(falling);
    expect(rising).toMatch(/moved upward/);
    expect(falling).toMatch(/moved downward/);
  });

  it("escalates poor attendance rather than softening it", () => {
    const poor = writeAnalysisRemark({ ...pupil, attendancePresent: 30, attendanceTotal: 62 });
    expect(poor).toMatch(/Attendance is 48%/);
    expect(poor).toMatch(/discussed at home/);
  });

  it("never prints null, undefined or NaN when data is missing", () => {
    const text = writeAnalysisRemark({
      pupilName: "Kato",
      average: null,
      division: null,
      position: null,
      classSize: null,
      attendancePresent: null,
      attendanceTotal: null,
      subjects: [],
    });
    expect(text).not.toMatch(/null|undefined|NaN/);
    expect(text.length).toBeGreaterThan(0);
  });

  it("does not claim a position when ranking is incomplete", () => {
    const text = writeAnalysisRemark({ ...pupil, position: 0 });
    expect(text).not.toMatch(/Position 0/);
  });
});