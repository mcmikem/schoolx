import {
  eventOverlapsRange,
  countCalendarOccurrences,
  expandRecurringEvents,
  isWithinRecurrenceLimit,
} from "@/lib/calendar-event-recurrence";

describe("calendar recurrence expansion", () => {
  it("expands a weekly event through its inclusive final date", () => {
    const occurrences = expandRecurringEvents([
      {
        id: "staff-meeting",
        start_date: "2026-11-02",
        end_date: null,
        recurrence_frequency: "weekly" as const,
        recurrence_until: "2026-11-23",
      },
    ]);

    expect(occurrences.map((event) => event.start_date)).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
    ]);
  });

  it("clamps monthly dates to the last day of short months, then returns to the anchor day", () => {
    const occurrences = expandRecurringEvents([
      {
        id: "monthly-meeting",
        start_date: "2027-01-31",
        end_date: null,
        recurrence_frequency: "monthly" as const,
        recurrence_until: "2027-04-30",
      },
    ]);

    expect(occurrences.map((event) => event.start_date)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
    ]);
  });

  it("preserves multi-day duration and does not expand a non-recurring event", () => {
    const occurrences = expandRecurringEvents([
      {
        id: "holiday",
        start_date: "2026-12-01",
        end_date: "2026-12-02",
        recurrence_frequency: "weekly" as const,
        recurrence_until: "2026-12-15",
      },
      { id: "one-off", start_date: "2026-12-03", end_date: null, recurrence_frequency: "none" as const },
    ]);

    expect(
      occurrences.filter((event) => event.id === "holiday").map((event) => [event.start_date, event.end_date]),
    ).toEqual([
      ["2026-12-01", "2026-12-02"],
      ["2026-12-08", "2026-12-09"],
      ["2026-12-15", "2026-12-16"],
    ]);
    expect(occurrences.filter((event) => event.id === "one-off")).toHaveLength(1);
  });

  it("keeps recurring events within a five-year window", () => {
    expect(isWithinRecurrenceLimit("2026-11-10", "2031-11-10")).toBe(true);
    expect(isWithinRecurrenceLimit("2026-11-10", "2031-11-11")).toBe(false);
  });
});

describe("calendar reporting periods", () => {
  it("includes a term spanning the whole month and excludes dates outside it", () => {
    const term = { start_date: "2026-09-16", end_date: "2026-12-06" };
    expect(eventOverlapsRange(term, "2026-11-01", "2026-11-30")).toBe(true);
    expect(eventOverlapsRange(term, "2027-01-01", "2027-01-31")).toBe(false);
    expect(eventOverlapsRange({ start_date: "2026-11-30" }, "2026-11-01", "2026-11-30")).toBe(true);
  });
  it("counts a multi-day event once but keeps separate recurring occurrences", () => {
    const first = { id: "meeting", start_date: "2026-11-02" };
    expect(countCalendarOccurrences([first, first, { id: "meeting", start_date: "2026-11-09" }])).toBe(2);
  });
});
