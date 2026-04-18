const TERM_TEMPLATE = [
  { termNumber: 1, name: "Term 1", code: "T1", startMonth: 2, startDay: 5, endMonth: 5, endDay: 3 },
  { termNumber: 2, name: "Term 2", code: "T2", startMonth: 5, startDay: 27, endMonth: 8, endDay: 23 },
  { termNumber: 3, name: "Term 3", code: "T3", startMonth: 9, startDay: 16, endMonth: 12, endDay: 6 },
] as const;

const HOLIDAY_TEMPLATE = [
  {
    title: "Term 1 Holiday",
    startMonth: 5,
    startDay: 4,
    endMonth: 5,
    endDay: 26,
  },
  {
    title: "Term 2 Holiday",
    startMonth: 8,
    startDay: 24,
    endMonth: 9,
    endDay: 15,
  },
  {
    title: "End of Year Holiday",
    startMonth: 12,
    startDay: 7,
    endMonth: 2,
    endDay: 2,
    offsetYear: 1,
  },
] as const;

type HolidayTemplateEntry = (typeof HOLIDAY_TEMPLATE)[number] & {
  offsetYear?: number;
};

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isCurrentDateInRange(start: string, end: string, today = new Date()) {
  const current = today.toISOString().split("T")[0];
  return current >= start && current <= end;
}

export function buildUgandaAcademicTerms(schoolId: string, academicYear: string) {
  const year = Number(academicYear);

  return TERM_TEMPLATE.map((term, index) => {
    const startDate = formatDate(year, term.startMonth, term.startDay);
    const endDate = formatDate(year, term.endMonth, term.endDay);

    return {
      school_id: schoolId,
      name: term.name,
      code: `${term.code}-${academicYear}`,
      start_date: startDate,
      end_date: endDate,
      term_number: term.termNumber,
      academic_year: academicYear,
      is_active: true,
      is_current:
        TERM_TEMPLATE.some((candidate, candidateIndex) => {
          if (candidateIndex < index) return false;
          const candidateStart = formatDate(year, candidate.startMonth, candidate.startDay);
          const candidateEnd = formatDate(year, candidate.endMonth, candidate.endDay);
          return isCurrentDateInRange(candidateStart, candidateEnd);
        })
          ? isCurrentDateInRange(startDate, endDate)
          : index === 0,
    };
  });
}

export function buildUgandaCalendarEvents(schoolId: string, academicYear: string) {
  const year = Number(academicYear);
  const termEvents = TERM_TEMPLATE.map((term) => ({
    school_id: schoolId,
    title: `${term.name} Opens`,
    description:
      "Preloaded from the most recently published Uganda Ministry of Education academic term structure so schools can start with a familiar calendar.",
    event_type: "academic",
    start_date: formatDate(year, term.startMonth, term.startDay),
    end_date: formatDate(year, term.endMonth, term.endDay),
  }));

  const holidayEvents = HOLIDAY_TEMPLATE.map((holiday) => {
    const entry = holiday as HolidayTemplateEntry;

    return {
      school_id: schoolId,
      title: holiday.title,
      description:
        "Preloaded holiday window based on the official Uganda school term pattern. Headteachers can tweak dates later if a new circular is issued.",
      event_type: "holiday",
      start_date: formatDate(year, holiday.startMonth, holiday.startDay),
      end_date: formatDate(
        year + (entry.offsetYear || 0),
        holiday.endMonth,
        holiday.endDay,
      ),
    };
  });

  return [...termEvents, ...holidayEvents];
}
