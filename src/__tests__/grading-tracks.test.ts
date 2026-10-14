import {
  GRADING_TRACKS,
  CBC_GRADE_BANDS,
  IDENTIFIER_LEVELS,
  SETTING_KEYS,
  detectLevelFromClass,
  getCbcGrade,
  getCbcDescriptor,
  getIdentifierLevel,
  isALevel,
  isLowerPrimary,
  pleAggregate,
  pointsToGrade,
  resolveLayout,
  resolveTrackForClass,
  uceAggregate,
  weighNewCurriculum,
  weighOldCurriculum,
} from "@/lib/grading-tracks";

describe("old-curriculum weighting (primary + old secondary)", () => {
  it("averages every classwork mark into MID and weights 25/75", () => {
    // class tests 70/80, midterm 60, BOT 70 -> MID 70; exam 80 -> AVG 77.5
    expect(weighOldCurriculum([70, 80, 60, 70], 80)).toEqual({ mid: 70, end: 80, avg: 77.5 });
  });

  it("returns null (never 0) while MID or END is missing", () => {
    expect(weighOldCurriculum([], 80)).toEqual({ mid: null, end: 80, avg: null });
    expect(weighOldCurriculum([70], null)).toEqual({ mid: 70, end: null, avg: null });
  });
});

describe("new-curriculum weighting (NCDC 20/80)", () => {
  it("scales identifiers to /20 and summative to /80", () => {
    // identifier avg 2.4 -> 16 formative; 75% exam -> 60 summative; total 76
    expect(weighNewCurriculum(2.4, 75)).toEqual({ formative: 16, summative: 60, total: 76 });
  });

  it("returns null while either side is missing", () => {
    expect(weighNewCurriculum(null, 75).total).toBeNull();
    expect(weighNewCurriculum(2.4, null).total).toBeNull();
  });
});

describe("CBC scale + identifiers", () => {
  it("grades A*-G with descriptors", () => {
    expect(getCbcGrade(90)).toBe("A*");
    expect(getCbcGrade(82)).toBe("A");
    expect(getCbcDescriptor("A*")).toBe("Exceptional");
    expect(getCbcDescriptor("C")).toBe("Satisfactory");
  });

  it("levels identifiers L1-L3 per NCDC ranges", () => {
    expect(getIdentifierLevel(2.7)?.label).toBe("Outstanding");
    expect(getIdentifierLevel(2.0)?.label).toBe("Moderate");
    expect(getIdentifierLevel(1.0)?.label).toBe("Basic");
    expect(IDENTIFIER_LEVELS).toHaveLength(3);
    expect(CBC_GRADE_BANDS).toHaveLength(8);
  });
});

describe("aggregates (UNEB official cutoffs)", () => {
  it("PLE best-4: 4-12 I, 13-23 II, 24-29 III, 30-34 IV", () => {
    expect(pleAggregate([1, 1, 1, 1])).toMatchObject({ aggregate: 4, division: "Division I" });
    expect(pleAggregate([2, 3, 3, 4])).toMatchObject({ aggregate: 12, division: "Division I" });
    expect(pleAggregate([3, 3, 3, 4]).division).toBe("Division II");
    expect(pleAggregate([6, 6, 6, 6]).division).toBe("Division III");
    expect(pleAggregate([7, 7, 8, 8]).division).toBe("Division IV");
    expect(pleAggregate([9, 9, 9, 9]).division).toBe("Ungraded");
  });

  it("needs 4 subjects before aggregating", () => {
    expect(pleAggregate([1, 2, 3]).aggregate).toBeNull();
  });

  it("UCE best-8: I 8-32, II 33-45, III 46-58, IV 59-68", () => {
    expect(uceAggregate([1, 1, 1, 1, 1, 1, 1, 1]).division).toBe("Division I");
    expect(uceAggregate([4, 4, 4, 4, 5, 5, 5, 6]).division).toBe("Division II");
    expect(uceAggregate([9, 9, 9, 9, 9, 9, 9, 9]).division).toBe("Ungraded");
  });

  it("maps points back to grades", () => {
    expect(pointsToGrade(1)).toBe("D1");
    expect(pointsToGrade(9)).toBe("F9");
  });
});

describe("track resolution", () => {
  it("detects level from class names", () => {
    expect(detectLevelFromClass("Baby Class")).toBe("nursery");
    expect(detectLevelFromClass("P.5")).toBe("primary");
    expect(detectLevelFromClass("Primary 3")).toBe("primary");
    expect(detectLevelFromClass("S.2")).toBe("secondary");
    expect(detectLevelFromClass("Senior Four")).toBe("secondary");
  });

  it("flags lower primary and A-level", () => {
    expect(isLowerPrimary("P.2")).toBe(true);
    expect(isLowerPrimary("P.5")).toBe(false);
    expect(isALevel("S.6")).toBe(true);
    expect(isALevel("S.2")).toBe(false);
  });

  it("resolves nursery/primary directly, secondary from the school setting", () => {
    expect(resolveTrackForClass("P.5", {})).toBe("primary");
    expect(resolveTrackForClass("Top Class", {})).toBe("nursery");
    expect(resolveTrackForClass("S.2", {})).toBe("secondary_new");
    expect(resolveTrackForClass("S.2", { [SETTING_KEYS.secondaryTrack]: "old" })).toBe("secondary_old");
  });

  it("resolves the printed layout from the setting with track default", () => {
    expect(resolveLayout({}, "primary")).toBe("uganda_classic");
    expect(resolveLayout({}, "secondary_new")).toBe("ncdc_cbc");
    expect(resolveLayout({ [SETTING_KEYS.reportLayout]: "ncdc_cbc" }, "primary")).toBe("ncdc_cbc");
  });

  it("every track explains itself in plain language", () => {
    for (const track of Object.values(GRADING_TRACKS)) {
      expect(track.explain.length).toBeGreaterThan(40);
      for (const col of track.columns) {
        expect(col.explain.length).toBeGreaterThan(10);
      }
    }
  });
});
