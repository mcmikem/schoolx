/**
 * Uganda school-day builder.
 *
 * The bell schedule that shipped with the app (six 40-minute periods, "lunch"
 * at 11:00, games at 13:00, day over by 14:00) does not match how Ugandan
 * schools actually run. These presets are built from:
 *
 *  - MoES Basic Requirements and Minimum Standards (BRMS), Indicator 11:
 *      the school day runs 08:00–17:00, at least eight lessons a day, a
 *      mid-morning break of at most 30 minutes, lunch of at most 60 minutes,
 *      one hour of co-curricular activities at the end of lessons, and a
 *      daily/weekly assembly.
 *  - NCDC Lower Secondary Curriculum Framework:
 *      eight 40-minute periods a day (1,600 learning minutes a week),
 *      instruction 08:00–14:40, then supervised projects/games to 16:30,
 *      with a fixed number of periods a week per subject.
 *  - Common practice in Ugandan day/boarding schools: 40-minute periods,
 *      break around 10:20–10:40, lunch 13:00–14:00, games, and evening prep
 *      for boarders.
 *
 * Everything here is pure data + arithmetic so it can be unit-tested and
 * reused by the timetable page, the setup wizard and seed data.
 */

export type SchoolLevel = "nursery" | "primary" | "lower_secondary" | "upper_secondary";

export interface SchoolDayConfig {
  level: SchoolLevel;
  /** First bell, "HH:MM" (24h). */
  startTime: string;
  /** Daily assembly/parade. MoES allows up to 40 min; 15 is the common parade. */
  assemblyMinutes: number;
  /** Length of one lesson. NCDC recommends 40. */
  lessonMinutes: number;
  /** Lessons before the mid-morning break. */
  lessonsBeforeBreak: number;
  breakMinutes: number;
  /** Lessons between break and lunch. */
  lessonsBeforeLunch: number;
  lunchMinutes: number;
  /** Lessons after lunch. */
  lessonsAfterLunch: number;
  /** Games / clubs / supervised projects. MoES requires one hour daily. */
  coCurricularMinutes: number;
  /** Evening prep for boarders. Zero for day schools. */
  prepMinutes: number;
}

export interface GeneratedSlot {
  name: string;
  /** "HH:MM" */
  start_time: string;
  /** "HH:MM" */
  end_time: string;
  is_lesson: boolean;
  order_number: number;
}

export const SCHOOL_DAY_PRESETS: Record<SchoolLevel, SchoolDayConfig> = {
  // Lower primary finishes earlier and takes a longer mid-morning porridge
  // break; the day still ends with games, per BRMS.
  nursery: {
    level: "nursery",
    startTime: "08:00",
    assemblyMinutes: 10,
    lessonMinutes: 30,
    lessonsBeforeBreak: 3,
    breakMinutes: 30,
    lessonsBeforeLunch: 2,
    lunchMinutes: 60,
    lessonsAfterLunch: 2,
    coCurricularMinutes: 60,
    prepMinutes: 0,
  },
  primary: {
    level: "primary",
    startTime: "08:00",
    assemblyMinutes: 15,
    lessonMinutes: 40,
    lessonsBeforeBreak: 3,
    breakMinutes: 30,
    lessonsBeforeLunch: 3,
    lunchMinutes: 60,
    lessonsAfterLunch: 2,
    coCurricularMinutes: 60,
    prepMinutes: 0,
  },
  // NCDC: eight 40-minute periods, instruction ends 14:40, supervised
  // creativity/games 14:40–16:30.
  lower_secondary: {
    level: "lower_secondary",
    startTime: "08:00",
    assemblyMinutes: 15,
    lessonMinutes: 40,
    lessonsBeforeBreak: 3,
    breakMinutes: 20,
    lessonsBeforeLunch: 3,
    lunchMinutes: 60,
    lessonsAfterLunch: 2,
    coCurricularMinutes: 110,
    prepMinutes: 0,
  },
  // S5–S6 carry nine periods a week per principal subject plus practicals, so
  // the class day is one lesson longer than O-level.
  upper_secondary: {
    level: "upper_secondary",
    startTime: "08:00",
    assemblyMinutes: 15,
    lessonMinutes: 40,
    lessonsBeforeBreak: 3,
    breakMinutes: 20,
    lessonsBeforeLunch: 3,
    lunchMinutes: 60,
    lessonsAfterLunch: 3,
    coCurricularMinutes: 60,
    prepMinutes: 120,
  },
};

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  nursery: "Nursery / ECD",
  primary: "Primary (P1–P7)",
  lower_secondary: "Lower secondary (S1–S4)",
  upper_secondary: "Upper secondary (S5–S6)",
};

/** Guess the school level from a class name such as "S.2 B", "P.5" or "Baby". */
export function schoolLevelFromClassName(name?: string | null): SchoolLevel {
  const value = (name ?? "").trim().toUpperCase();
  if (/^(BABY|MIDDLE|TOP|NURSERY|ECD|KG)/.test(value)) return "nursery";
  if (/^S\s*\.?\s*[56]\b/.test(value) || /\bS\s*\.?\s*[56]\b/.test(value)) return "upper_secondary";
  if (/^S\s*\.?\s*[1-4]\b/.test(value) || /\bS\s*\.?\s*[1-4]\b/.test(value)) return "lower_secondary";
  if (/^P\s*\.?\s*[1-7]\b/.test(value) || /\bP\s*\.?\s*[1-7]\b/.test(value)) return "primary";
  return "primary";
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function toTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function formatSlotTime(time?: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

export function totalLessonPeriods(config: SchoolDayConfig): number {
  return config.lessonsBeforeBreak + config.lessonsBeforeLunch + config.lessonsAfterLunch;
}

/** Build the ordered bell schedule for the configured day. */
export function buildSchoolDay(config: SchoolDayConfig): GeneratedSlot[] {
  const slots: GeneratedSlot[] = [];
  let cursor = toMinutes(config.startTime);
  let order = 1;

  const push = (name: string, minutes: number, isLesson: boolean) => {
    if (minutes <= 0) return;
    slots.push({
      name,
      start_time: toTime(cursor),
      end_time: toTime(cursor + minutes),
      is_lesson: isLesson,
      order_number: order++,
    });
    cursor += minutes;
  };

  push("Assembly", config.assemblyMinutes, false);

  let lesson = 1;
  for (let i = 0; i < config.lessonsBeforeBreak; i += 1) {
    push(`Period ${lesson++}`, config.lessonMinutes, true);
  }
  push("Break", config.breakMinutes, false);

  for (let i = 0; i < config.lessonsBeforeLunch; i += 1) {
    push(`Period ${lesson++}`, config.lessonMinutes, true);
  }
  push("Lunch", config.lunchMinutes, false);

  for (let i = 0; i < config.lessonsAfterLunch; i += 1) {
    push(`Period ${lesson++}`, config.lessonMinutes, true);
  }

  push("Games / Clubs", config.coCurricularMinutes, false);
  push("Evening Prep", config.prepMinutes, false);

  return slots;
}

export interface SchoolDayCheck {
  errors: string[];
  warnings: string[];
}

/**
 * Check a bell schedule against the MoES minimum standards. Errors mean the
 * day cannot be applied as-is; warnings describe a choice the school may
 * deliberately make (for example a day school without evening prep).
 */
export function validateSchoolDay(config: SchoolDayConfig): SchoolDayCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lessons = totalLessonPeriods(config);
  if (lessons < 8) {
    errors.push(`MoES requires at least 8 lessons a day; this schedule has ${lessons}.`);
  }
  if (config.lessonMinutes < 30) {
    errors.push("Lessons shorter than 30 minutes fall below the curriculum minimum.");
  }
  if (config.breakMinutes > 30) {
    errors.push("The mid-morning break must not exceed 30 minutes (MoES).");
  }
  if (config.lunchMinutes > 60) {
    errors.push("The lunch break must not exceed 60 minutes (MoES).");
  }
  if (config.coCurricularMinutes < 60) {
    errors.push("Schools must set aside one hour of co-curricular activities every day (MoES).");
  }
  if (config.assemblyMinutes > 40) {
    errors.push("Assembly must not exceed 40 minutes (MoES).");
  }

  const slots = buildSchoolDay(config);
  const last = slots[slots.length - 1];
  if (last && toMinutes(last.end_time) > 17 * 60) {
    errors.push("The school day must end by 17:00 (MoES).");
  }
  const first = slots[0];
  if (first && toMinutes(first.start_time) < 7 * 60) {
    warnings.push("Starting before 07:00 is unusual; the official day begins at 08:00.");
  }
  if (config.prepMinutes === 0 && config.level === "upper_secondary") {
    warnings.push("Upper secondary is usually boarding; enable evening prep if your school has it.");
  }

  return { errors, warnings };
}

/**
 * NCDC Lower Secondary Curriculum Framework, periods per week.
 * `schoolProgramme` covers assemblies, class day, careers day and clubs.
 * `library` is the timetabled library period. Schools offer a subset of these
 * (for example either General Science or the three separate sciences), so the
 * weekly panel compares subject by subject rather than enforcing a total.
 */
export const LOWER_SECONDARY_WEEKLY_PERIODS = [
  { subject: "English", s1s2: 6, s3s4: 6 },
  { subject: "Mathematics", s1s2: 5, s3s4: 5 },
  { subject: "History & Political Education", s1s2: 3, s3s4: 3 },
  { subject: "Geography", s1s2: 3, s3s4: 3 },
  { subject: "Physics", s1s2: 3, s3s4: 4 },
  { subject: "Biology", s1s2: 3, s3s4: 4 },
  { subject: "Chemistry", s1s2: 3, s3s4: 4 },
  { subject: "General Science", s1s2: 6, s3s4: 6 },
  { subject: "Physical Education", s1s2: 2, s3s4: 4 },
  { subject: "Religious Education", s1s2: 2, s3s4: 0 },
  { subject: "Agriculture", s1s2: 2, s3s4: 0 },
  { subject: "Kiswahili", s1s2: 2, s3s4: 0 },
  { subject: "Entrepreneurship", s1s2: 2, s3s4: 0 },
  { subject: "Library", s1s2: 1, s3s4: 1 },
  { subject: "School programme", s1s2: 3, s3s4: 2 },
] as const;

/** 40 periods a week at 40 minutes each is the NCDC planning figure. */
export const LOWER_SECONDARY_WEEKLY_TOTAL = 40;

export interface WeeklyTarget {
  subject: string;
  periods: number;
}

/**
 * Recommended weekly load for a class, or an empty list when NCDC does not
 * publish a comparable allocation for that level.
 */
export function weeklyPeriodTargets(level: SchoolLevel, seniorClass?: 1 | 2 | 3 | 4): WeeklyTarget[] {
  if (level !== "lower_secondary") return [];
  const early = seniorClass === undefined || seniorClass <= 2;
  return LOWER_SECONDARY_WEEKLY_PERIODS.map((row) => ({
    subject: row.subject,
    periods: early ? row.s1s2 : row.s3s4,
  })).filter((row) => row.periods > 0);
}

/** Match a school subject name to an NCDC target row (tolerant of casing/aliases). */
export function matchWeeklyTarget(subjectName: string | null | undefined): string | null {
  const value = (subjectName ?? "").toLowerCase();
  if (!value) return null;
  const table: Array<[RegExp, string]> = [
    // Physical Education before Physics: "Physical" also starts with "phys".
    [/\b(p\.?e\.?|physical education|sports)\b/, "Physical Education"],
    [/\b(r\.?e\.?|religious|cre|ire)\b/, "Religious Education"],
    [/\bgen(eral)?\s*sci/, "General Science"],
    [/\bmath/, "Mathematics"],
    [/\beng/, "English"],
    [/\bphys/, "Physics"],
    [/\bbio/, "Biology"],
    [/\bchem/, "Chemistry"],
    [/\bgeo/, "Geography"],
    [/\bhist/, "History & Political Education"],
    [/\bagri/, "Agriculture"],
    [/\bkiswahili/, "Kiswahili"],
    [/\bentrepreneur/, "Entrepreneurship"],
    [/\blibrar/, "Library"],
  ];
  for (const [pattern, label] of table) {
    if (pattern.test(value)) return label;
  }
  return null;
}
