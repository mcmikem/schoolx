import { getKampalaDate } from "@/lib/kampala-date";

describe("Uganda school calendar date", () => {
  it("uses Kampala's date when the UTC server is still on the prior day", () => {
    expect(getKampalaDate(new Date("2026-11-08T22:30:00.000Z"))).toBe("2026-11-09");
  });

  it("formats dates consistently throughout the day", () => {
    expect(getKampalaDate(new Date("2026-11-09T10:00:00.000Z"))).toBe("2026-11-09");
  });
});
