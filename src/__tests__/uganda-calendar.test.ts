import {
  buildUgandaCalendarEvents,
  missingCalendarEvents,
  seedUgandaCalendarEvents,
} from "@/lib/uganda-school-calendar";

describe("buildUgandaCalendarEvents", () => {
  it("keeps term openings as single-day milestones, not term spans", () => {
    const events = buildUgandaCalendarEvents("school-1", "2026");
    const openings = events.filter((e) => e.title.endsWith(" Opens"));
    expect(openings).toHaveLength(3);
    for (const evt of openings) {
      expect(evt.end_date).toBe(evt.start_date);
    }
  });

  it("keeps real holidays spanning their windows", () => {
    const events = buildUgandaCalendarEvents("school-1", "2026");
    const holiday = events.find((e) => e.title === "Term 1 Holiday");
    expect(holiday?.start_date).toBe("2026-05-04");
    expect(holiday?.end_date).toBe("2026-05-26");
  });
});

describe("missingCalendarEvents", () => {
  const built = buildUgandaCalendarEvents("school-1", "2026");

  it("returns everything when the school has no preloaded events", () => {
    expect(missingCalendarEvents([], built)).toHaveLength(built.length);
  });

  it("returns nothing when all are already present (idempotent reseed)", () => {
    const existing = built.map((b) => ({
      title: b.title,
      start_date: b.start_date,
      end_date: b.end_date,
    }));
    expect(missingCalendarEvents(existing, built)).toEqual([]);
  });

  it("tops up only the missing ones", () => {
    const existing = [{ title: "Term 3 Opens", start_date: "2026-09-16", end_date: "2026-09-16" }];
    const missing = missingCalendarEvents(existing, built);
    expect(missing).toHaveLength(built.length - 1);
    expect(missing.some((m) => m.title === "Term 3 Opens")).toBe(false);
  });

  it("treats a retitled span as missing rather than merging", () => {
    const existing = [{ title: "Term 3 Opens", start_date: "2026-09-16", end_date: "2026-12-06" }];
    // Same title and start but a different span: still seeded (old triplicate
    // shape), while the exact triple-match above is skipped.
    const missing = missingCalendarEvents(existing, built);
    expect(missing.some((m) => m.title === "Term 3 Opens" && m.end_date === "2026-09-16")).toBe(true);
  });
});

describe("seedUgandaCalendarEvents", () => {
  it("skips the insert entirely when nothing is missing", async () => {
    const built = buildUgandaCalendarEvents("school-1", "2026");
    const calls: string[] = [];
    const client = {
      from: (table: string) => {
        calls.push(table);
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({
                data: built.map((b) => ({
                  title: b.title,
                  start_date: b.start_date,
                  end_date: b.end_date,
                })),
                error: null,
              }),
            }),
          }),
          insert: async () => {
            throw new Error("insert must not run when nothing is missing");
          },
        };
      },
    };
    await expect(seedUgandaCalendarEvents(client, "school-1", "2026")).resolves.toEqual({ inserted: 0 });
    expect(calls).toEqual(["events"]);
  });
});
