import { getLocalWeekdayIndex } from "@/lib/hooks/utils";

/**
 * The timetable opens on today's weekday. The first implementation did
 * `new Date(getLocalDateString()).getDay()`, but `new Date("YYYY-MM-DD")`
 * parses as UTC midnight — so west of UTC `.getDay()` returned the *previous*
 * day and a New York user opened on Tuesday when it was Wednesday. Saturday
 * also returned 6, which matches no day tab at all.
 *
 * These run under a deliberately negative-offset zone so the UTC parse cannot
 * pass by accident in CI, which usually runs UTC.
 */
describe("getLocalWeekdayIndex", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  const cases: Array<[string, number]> = [
    ["2026-10-12", 1], // Monday
    ["2026-10-13", 2],
    ["2026-10-14", 3],
    ["2026-10-15", 4],
    ["2026-10-16", 5], // Friday
    ["2026-10-17", 1], // Saturday — no weekend column, falls back to Monday
    ["2026-10-18", 1], // Sunday — same
  ];

  it.each(cases)("maps %s to weekday tab %i west of UTC", (iso, expected) => {
    process.env.TZ = "America/New_York";
    expect(getLocalWeekdayIndex(iso)).toBe(expected);
  });

  it.each(cases)("maps %s to weekday tab %i east of UTC", (iso, expected) => {
    process.env.TZ = "Asia/Kampala";
    expect(getLocalWeekdayIndex(iso)).toBe(expected);
  });

  it.each(cases)("maps %s to weekday tab %i in UTC", (iso, expected) => {
    process.env.TZ = "UTC";
    expect(getLocalWeekdayIndex(iso)).toBe(expected);
  });

  it("never returns a value outside the Monday-Friday tab range", () => {
    process.env.TZ = "America/Los_Angeles";
    // A fortnight spanning both weekends.
    for (let day = 1; day <= 31; day += 1) {
      const index = getLocalWeekdayIndex(`2026-10-${String(day).padStart(2, "0")}`);
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(5);
    }
  });

  it("defaults to today when no date is given", () => {
    process.env.TZ = "UTC";
    const todayIndex = new Date().getDay();
    const expected = todayIndex === 0 || todayIndex === 6 ? 1 : todayIndex;
    expect(getLocalWeekdayIndex()).toBe(expected);
  });
});
