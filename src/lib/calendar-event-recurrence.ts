export type EventRecurrence = "none" | "weekly" | "monthly";

export interface RecurringCalendarEvent {
  id: string;
  start_date: string;
  end_date?: string | null;
  recurrence_frequency?: EventRecurrence | null;
  recurrence_until?: string | null;
  occurrence_key?: string;
  [key: string]: unknown;
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonthsClamped(date: Date, months: number): Date {
  const firstOfTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)),
  );
}

export function isWithinRecurrenceLimit(startDate: string, untilDate: string): boolean {
  const start = parseDate(startDate);
  const until = parseDate(untilDate);
  return Boolean(start && until && until <= addMonthsClamped(start, 60));
}

/** Expand a bounded weekly/monthly series into date occurrences for calendar display. */
export function expandRecurringEvents<T extends RecurringCalendarEvent>(
  events: readonly T[],
): (T & { occurrence_key: string })[] {
  const occurrences: (T & { occurrence_key: string })[] = [];
  for (const event of events) {
    const start = parseDate(event.start_date);
    const until = parseDate(event.recurrence_until ?? "");
    const frequency = event.recurrence_frequency ?? "none";
    if (!start || frequency === "none" || !until || until <= start) {
      occurrences.push({ ...event, occurrence_key: event.start_date });
      continue;
    }

    const baseEnd = event.end_date ? parseDate(event.end_date) : null;
    const durationDays =
      baseEnd && baseEnd >= start ? Math.round((baseEnd.getTime() - start.getTime()) / 86_400_000) : 0;
    let occurrence = start;
    let count = 0;
    while (occurrence <= until && count < 262) {
      const occurrenceDate = occurrence.toISOString().slice(0, 10);
      const occurrenceEnd = addDays(occurrence, durationDays).toISOString().slice(0, 10);
      occurrences.push({
        ...event,
        start_date: occurrenceDate,
        end_date: durationDays ? occurrenceEnd : null,
        occurrence_key: occurrenceDate,
      });
      occurrence = frequency === "weekly" ? addDays(occurrence, 7) : addMonthsClamped(start, count + 1);
      count += 1;
    }
  }
  return occurrences;
}
