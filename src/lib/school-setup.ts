import { NURSERY_TEMPLATE, PRIMARY_TEMPLATE, SECONDARY_TEMPLATE } from "@/lib/curriculum-templates";

export type SchoolSetupType = "primary" | "secondary" | "combined";

export interface ClassSeedOptions {
  /**
   * Whether the school runs a pre-primary section (Baby / Middle / Top Class).
   *
   * Opt-in and defaults to false so existing primary/combined schools keep
   * seeding exactly P.1-P.7 / P.1-S.6. Ignored for a pure `secondary` school —
   * the setup UI only offers the toggle for primary and combined.
   */
  nursery?: boolean;
}

function withStream(classes: { name: string; level: string }[]) {
  return classes.map((cls) => ({ ...cls, stream: "" }));
}

export function getDefaultClassTemplates(schoolType: SchoolSetupType, options?: ClassSeedOptions) {
  const nursery = options?.nursery ? withStream(NURSERY_TEMPLATE.classes) : [];

  if (schoolType === "primary") {
    return [...nursery, ...withStream(PRIMARY_TEMPLATE.classes)];
  }

  if (schoolType === "secondary") {
    return withStream(SECONDARY_TEMPLATE.classes);
  }

  return [...nursery, ...withStream(PRIMARY_TEMPLATE.classes), ...withStream(SECONDARY_TEMPLATE.classes)];
}

/**
 * Recognises pre-primary class names. Tested first because the pre-primary
 * branch would otherwise be swallowed by the `startsWith("P")` rule
 * ("Pre-Primary" begins with P) and collapse to a generic "primary".
 */
const NURSERY_CLASS_PATTERN = /^(BABY|MIDDLE|TOP|NURSERY|PREPRIMARY|PP)/;

export function inferClassLevel(className: string, schoolType: SchoolSetupType = "primary") {
  // Letters only, so punctuation and digits don't hide the nursery name:
  // "Baby Class" -> "BABYCLASS", "PP1" -> "PP", "Pre-Primary" -> "PREPRIMARY".
  const letters = className.toUpperCase().replace(/[^A-Z]/g, "");
  if (NURSERY_CLASS_PATTERN.test(letters)) return "nursery";

  const cleaned = className.trim().toUpperCase().replace(/\s+/g, "");
  const digits = cleaned.match(/\d+/)?.[0];

  if (cleaned.startsWith("P")) {
    return digits ? `P.${digits}` : "primary";
  }

  if (cleaned.startsWith("S")) {
    return digits ? `S.${digits}` : "secondary";
  }

  if (schoolType === "secondary") return "secondary";
  if (schoolType === "combined" && digits) {
    return Number(digits) <= 7 ? `P.${digits}` : `S.${digits}`;
  }

  return "primary";
}

function toClassRow(
  schoolId: string,
  academicYear: string,
  cls: { name: string; level: string },
  schoolType: SchoolSetupType,
) {
  return {
    school_id: schoolId,
    name: cls.name,
    level: cls.level || inferClassLevel(cls.name, schoolType),
    stream: null,
    academic_year: academicYear,
    max_students: 60,
  };
}

export function buildDefaultClasses(
  schoolId: string,
  schoolType: SchoolSetupType,
  academicYear: string,
  options?: ClassSeedOptions,
) {
  return getDefaultClassTemplates(schoolType, options).map((cls) =>
    toClassRow(schoolId, academicYear, cls, schoolType),
  );
}

/**
 * The pre-primary classes on their own.
 *
 * Onboarding only seeds the full structure when a school has no classes at
 * all, so a school whose defaults were created earlier — `/register` seeds
 * them at sign-up, before onboarding runs — would otherwise silently drop the
 * nursery toggle. Callers upsert this set to add the section to classes that
 * already exist; the (school_id, name, academic_year) key means it can only
 * add missing rows, never overwrite a school's own edits.
 */
export function buildNurseryClasses(schoolId: string, academicYear: string) {
  return NURSERY_TEMPLATE.classes.map((cls) => toClassRow(schoolId, academicYear, cls, "primary"));
}

const DEFAULT_TIMETABLE_SLOTS = [
  { name: "Period 1", start_time: "08:00", end_time: "08:40", is_lesson: true },
  { name: "Period 2", start_time: "08:40", end_time: "09:20", is_lesson: true },
  { name: "Break", start_time: "09:20", end_time: "09:40", is_lesson: false },
  { name: "Period 3", start_time: "09:40", end_time: "10:20", is_lesson: true },
  { name: "Period 4", start_time: "10:20", end_time: "11:00", is_lesson: true },
  { name: "Lunch", start_time: "11:00", end_time: "11:40", is_lesson: false },
  { name: "Period 5", start_time: "11:40", end_time: "12:20", is_lesson: true },
  { name: "Period 6", start_time: "12:20", end_time: "13:00", is_lesson: true },
  { name: "Games / Clubs", start_time: "13:00", end_time: "14:00", is_lesson: true },
];

export function buildDefaultTimetableSlots(schoolId: string) {
  return DEFAULT_TIMETABLE_SLOTS.map((slot, index) => ({
    school_id: schoolId,
    name: slot.name,
    start_time: slot.start_time,
    end_time: slot.end_time,
    is_lesson: slot.is_lesson,
    order_number: index + 1,
  }));
}
