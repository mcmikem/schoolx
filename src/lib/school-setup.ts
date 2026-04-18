import { PRIMARY_TEMPLATE, SECONDARY_TEMPLATE } from "@/lib/curriculum-templates";

export type SchoolSetupType = "primary" | "secondary" | "combined";

export function getDefaultClassTemplates(schoolType: SchoolSetupType) {
  if (schoolType === "primary") {
    return PRIMARY_TEMPLATE.classes.map((cls) => ({ ...cls, stream: "" }));
  }

  if (schoolType === "secondary") {
    return SECONDARY_TEMPLATE.classes.map((cls) => ({ ...cls, stream: "" }));
  }

  return [...PRIMARY_TEMPLATE.classes, ...SECONDARY_TEMPLATE.classes].map(
    (cls) => ({ ...cls, stream: "" }),
  );
}

export function inferClassLevel(
  className: string,
  schoolType: SchoolSetupType = "primary",
) {
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

export function buildDefaultClasses(
  schoolId: string,
  schoolType: SchoolSetupType,
  academicYear: string,
) {
  return getDefaultClassTemplates(schoolType).map((cls) => ({
    school_id: schoolId,
    name: cls.name,
    level: cls.level || inferClassLevel(cls.name, schoolType),
    stream: null,
    academic_year: academicYear,
    max_students: 60,
  }));
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
