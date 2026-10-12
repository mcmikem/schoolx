// Based on the most recently published Uganda Ministry of Education term pattern
// surfaced during research on 2026-04-18 (using the official 2024 structure as the
// latest widely published baseline available to seed new schools consistently).
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
import { getLocalDateString } from "@/lib/hooks/utils";

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isCurrentDateInRange(start: string, end: string, today = new Date()) {
  const current = getLocalDateString(today);
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
      is_current: TERM_TEMPLATE.some((candidate, candidateIndex) => {
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
    // A term opening is a one-day milestone, not a season: spanning it to the
    // term end painted it on every calendar date for three months.
    end_date: formatDate(year, term.startMonth, term.startDay),
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
      end_date: formatDate(year + (entry.offsetYear || 0), holiday.endMonth, holiday.endDay),
    };
  });

  return [...termEvents, ...holidayEvents];
}

/** Rows already present, keyed by identity — re-seeds insert only the rest. */
export function missingCalendarEvents(
  existing: { title: string; start_date: string; end_date: string }[],
  built: CalendarEventSeed[],
): CalendarEventSeed[] {
  const known = new Set(existing.map((e) => `${e.title}|${e.start_date}|${e.end_date}`));
  return built.filter((b) => !known.has(`${b.title}|${b.start_date}|${b.end_date}`));
}

export interface CalendarEventSeed {
  school_id: string;
  title: string;
  description: string;
  event_type: string;
  start_date: string;
  end_date: string;
}

/** Idempotent seeder: the same blind `.insert()` ran from registration,
 * onboarding, and the super-admin reseed action, triplicating every
 * preloaded event (three "Term 3 Opens" on every date). This checks first. */
/** Supabase client subset used by the idempotent calendar seeder. */
interface SeedClient {
  from(table: string): any;
}

export async function seedUgandaCalendarEvents(
  client: SeedClient,
  schoolId: string,
  academicYear: string,
): Promise<{ inserted: number }> {
  const built = buildUgandaCalendarEvents(schoolId, academicYear);
  const { data, error } = await client
    .from("events")
    .select("title,start_date,end_date")
    .eq("school_id", schoolId)
    .in("event_type", ["academic", "holiday"]);
  if (error) throw error;
  const missing = missingCalendarEvents(
    (data ?? []) as { title: string; start_date: string; end_date: string }[],
    built,
  );
  if (missing.length === 0) return { inserted: 0 };
  const { error: insertError } = await client.from("events").insert(missing);
  if (insertError) throw insertError;
  return { inserted: missing.length };
}
