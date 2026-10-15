import { isFutureDate } from "@/lib/validation";

/**
 * isFutureDate gates three everyday flows: recording a payment, taking
 * attendance, and entering a date of birth. It compared instants, so a bare
 * "2026-10-16" -- parsed by Date as UTC midnight -- counted as "after" any
 * moment later that same day. Every school was therefore told today was in the
 * future, and could not record a payment for the day they were doing it on.
 *
 * It must compare calendar days, so these pin the boundary in both directions.
 */

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("isFutureDate compares calendar days, not instants", () => {
  const today = new Date();

  it("accepts today", () => {
    expect(isFutureDate(ymd(today), today)).toBe(false);
  });

  it("accepts today even late in the day", () => {
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    expect(isFutureDate(ymd(today), endOfDay)).toBe(false);
  });

  it("accepts today at the very start of the day", () => {
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 1);
    expect(isFutureDate(ymd(today), startOfDay)).toBe(false);
  });

  it("rejects tomorrow", () => {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    expect(isFutureDate(ymd(tomorrow), today)).toBe(true);
  });

  it("accepts yesterday", () => {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    expect(isFutureDate(ymd(yesterday), today)).toBe(false);
  });

  it("does not treat an unparseable date as a future date", () => {
    // Rejecting a typo'd date silently would be worse than accepting it; the
    // caller's own validation reports the malformed input.
    expect(isFutureDate("not-a-date", today)).toBe(false);
    expect(isFutureDate("", today)).toBe(false);
  });
});