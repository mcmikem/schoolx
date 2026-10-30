import {
  SCHOOL_DAY_PRESETS,
  buildSchoolDay,
  matchWeeklyTarget,
  schoolLevelFromClassName,
  totalLessonPeriods,
  validateSchoolDay,
  weeklyPeriodTargets,
  type SchoolDayConfig,
} from "@/lib/timetable/uganda-day";

describe("Uganda school day builder", () => {
  it("gives lower secondary the NCDC eight-period day", () => {
    const config = SCHOOL_DAY_PRESETS.lower_secondary;
    expect(totalLessonPeriods(config)).toBe(8);
    expect(config.lessonMinutes).toBe(40);
    expect(config.breakMinutes).toBeLessThanOrEqual(30);
    expect(config.lunchMinutes).toBeLessThanOrEqual(60);
  });

  it("runs the lower secondary day within the MoES 08:00–17:00 window", () => {
    const slots = buildSchoolDay(SCHOOL_DAY_PRESETS.lower_secondary);
    expect(slots[0].start_time).toBe("08:00");
    const last = slots[slots.length - 1];
    expect(last.end_time <= "17:00").toBe(true);
    expect(slots.filter((slot) => slot.is_lesson)).toHaveLength(8);
  });

  it("keeps slots contiguous with no gaps or overlaps", () => {
    const slots = buildSchoolDay(SCHOOL_DAY_PRESETS.primary);
    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i].start_time).toBe(slots[i - 1].end_time);
    }
  });

  it("numbers slots in order starting at one", () => {
    const slots = buildSchoolDay(SCHOOL_DAY_PRESETS.upper_secondary);
    expect(slots.map((slot) => slot.order_number)).toEqual(slots.map((_, index) => index + 1));
  });

  it("accepts a compliant Ugandan day", () => {
    const { errors } = validateSchoolDay(SCHOOL_DAY_PRESETS.lower_secondary);
    expect(errors).toEqual([]);
  });

  it("rejects the old six-period schedule that shipped before this change", () => {
    const legacy: SchoolDayConfig = {
      level: "lower_secondary",
      startTime: "08:00",
      assemblyMinutes: 0,
      lessonMinutes: 40,
      lessonsBeforeBreak: 2,
      breakMinutes: 20,
      lessonsBeforeLunch: 2,
      lunchMinutes: 40,
      lessonsAfterLunch: 2,
      coCurricularMinutes: 60,
      prepMinutes: 0,
    };
    const { errors } = validateSchoolDay(legacy);
    expect(errors.join(" ")).toMatch(/at least 8 lessons/);
  });

  it("rejects breaks and lunches beyond the MoES limits", () => {
    const tooLong: SchoolDayConfig = {
      ...SCHOOL_DAY_PRESETS.primary,
      breakMinutes: 45,
      lunchMinutes: 90,
    };
    const { errors } = validateSchoolDay(tooLong);
    expect(errors.join(" ")).toMatch(/break must not exceed 30/i);
    expect(errors.join(" ")).toMatch(/lunch break must not exceed 60/i);
  });

  it("requires daily co-curricular time", () => {
    const noGames: SchoolDayConfig = { ...SCHOOL_DAY_PRESETS.primary, coCurricularMinutes: 0 };
    const { errors } = validateSchoolDay(noGames);
    expect(errors.join(" ")).toMatch(/co-curricular/i);
  });

  it("flags a day that runs past 17:00", () => {
    const late: SchoolDayConfig = {
      ...SCHOOL_DAY_PRESETS.lower_secondary,
      lessonsAfterLunch: 5,
    };
    const { errors } = validateSchoolDay(late);
    expect(errors.join(" ")).toMatch(/end by 17:00/);
  });

  it("warns when an upper-secondary day has no evening prep", () => {
    const dayOnly: SchoolDayConfig = { ...SCHOOL_DAY_PRESETS.upper_secondary, prepMinutes: 0 };
    const { warnings } = validateSchoolDay(dayOnly);
    expect(warnings.join(" ")).toMatch(/evening prep/i);
  });

  it("reads the level from real class names", () => {
    expect(schoolLevelFromClassName("S.1 A")).toBe("lower_secondary");
    expect(schoolLevelFromClassName("S4")).toBe("lower_secondary");
    expect(schoolLevelFromClassName("S.6 Sciences")).toBe("upper_secondary");
    expect(schoolLevelFromClassName("P.5")).toBe("primary");
    expect(schoolLevelFromClassName("Baby Class")).toBe("nursery");
  });

  it("maps school subjects onto NCDC weekly targets", () => {
    expect(matchWeeklyTarget("Mathematics")).toBe("Mathematics");
    expect(matchWeeklyTarget("ENG")).toBe("English");
    expect(matchWeeklyTarget("Physical Education")).toBe("Physical Education");
    expect(matchWeeklyTarget("Physics")).toBe("Physics");
    expect(matchWeeklyTarget("CRE")).toBe("Religious Education");
    expect(matchWeeklyTarget("General Science")).toBe("General Science");
    expect(matchWeeklyTarget("Kiswahili")).toBe("Kiswahili");
    expect(matchWeeklyTarget("Fine Art")).toBeNull();
  });

  it("gives S1/S2 and S3/S4 different science loads", () => {
    const s1 = weeklyPeriodTargets("lower_secondary", 1);
    const s3 = weeklyPeriodTargets("lower_secondary", 3);
    expect(s1.find((row) => row.subject === "Physics")?.periods).toBe(3);
    expect(s3.find((row) => row.subject === "Physics")?.periods).toBe(4);
    expect(weeklyPeriodTargets("primary")).toEqual([]);
  });
});
