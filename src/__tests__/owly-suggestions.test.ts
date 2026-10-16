import { getSuggestions, hasSuggestion, STUCK_VISIT_THRESHOLD, type SuggestionSignals } from "@/lib/owly-suggestions";

const base: SuggestionSignals = {
  page: "/dashboard",
  role: "teacher",
  online: true,
  pendingSyncCount: 0,
  visitsThisPage: 1,
  totalVisits: 20,
  isNewUser: false,
};

const ids = (s: Partial<SuggestionSignals>) => getSuggestions({ ...base, ...s }).map((x) => x.id);

describe("Owly stays quiet by default", () => {
  it("suggests nothing to an established user doing normal work", () => {
    // The important case. A guide that always has something to say is noise.
    expect(getSuggestions(base)).toEqual([]);
    expect(hasSuggestion(base)).toBe(false);
  });

  it("says nothing on an unrelated page however often it is visited", () => {
    expect(ids({ page: "/dashboard/library", visitsThisPage: 99 })).toEqual([]);
  });

  it("every suggestion is actionable", () => {
    const signals: SuggestionSignals[] = [
      { ...base, isNewUser: true },
      { ...base, online: false, pendingSyncCount: 3 },
      { ...base, page: "/dashboard/fees", visitsThisPage: STUCK_VISIT_THRESHOLD },
      { ...base, online: false, totalVisits: 5 },
    ];
    for (const s of signals) {
      for (const suggestion of getSuggestions(s)) {
        expect(suggestion.cta.length).toBeGreaterThan(0);
        expect(suggestion.detail.length).toBeGreaterThan(0);
        expect(suggestion.title.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("unsynced work interrupts, because the user cannot see it", () => {
  it("raises the alarm offline with queued writes", () => {
    expect(ids({ online: false, pendingSyncCount: 4 })).toContain("sync-pending");
  });

  it("stays quiet when online, even with a queue still draining", () => {
    expect(ids({ online: true, pendingSyncCount: 4 })).not.toContain("sync-pending");
  });

  it("uses singular wording for a single pending change", () => {
    const [s] = getSuggestions({ ...base, online: false, pendingSyncCount: 1 });
    expect(s.title).toContain("1 change is");
  });
});

describe("first run", () => {
  it("offers the walkthrough exactly once, to a genuinely new user", () => {
    expect(ids({ isNewUser: true })).toContain("first-run");
    expect(ids({ isNewUser: false })).not.toContain("first-run");
  });

  it("does not also pile on the stuck hint", () => {
    // A new user has not been round the loop; the walkthrough is the fix.
    expect(ids({ isNewUser: true, page: "/dashboard/fees", visitsThisPage: 99 })).not.toContain("fees-first-repeat");
  });
});

describe("stuck detection", () => {
  it("waits until the third visit before assuming a problem", () => {
    const p = "/dashboard/attendance";
    expect(ids({ page: p, visitsThisPage: 1 })).not.toContain("attendance-first-repeat");
    expect(ids({ page: p, visitsThisPage: 2 })).not.toContain("attendance-first-repeat");
    expect(ids({ page: p, visitsThisPage: 3 })).toContain("attendance-first-repeat");
  });

  it("targets the page they are actually on", () => {
    const out = ids({ page: "/dashboard/grades", visitsThisPage: 5 });
    expect(out).toContain("grades-first-repeat");
    expect(out).not.toContain("attendance-first-repeat");
  });

  it("does not fire for a nested sub-route of a known page", () => {
    // "/dashboard/attendance/2026-01-02" is still attendance.
    expect(ids({ page: "/dashboard/attendance/term-3", visitsThisPage: 5 })).toContain("attendance-first-repeat");
  });
});

describe("offline without a queue", () => {
  it("explains offline work once the user is settled in", () => {
    expect(ids({ online: false, totalVisits: 2 })).not.toContain("offline-brief");
    expect(ids({ online: false, totalVisits: 3 })).toContain("offline-brief");
  });

  it("does not lecture on top of the urgent sync warning", () => {
    // Someone with writes still queued does not need the general offline
    // explainer as well; one thing, clearly.
    expect(getSuggestions({ ...base, online: false, pendingSyncCount: 2, totalVisits: 9 }).map((x) => x.id)).toEqual([
      "sync-pending",
    ]);
  });
});
