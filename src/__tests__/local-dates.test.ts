import { getLocalDateString } from "../lib/hooks/utils";

// The dashboard's week / term / dropout windows and every "Fees today" figure
// are string comparisons against YYYY-MM-DD. Building those strings with
// toISOString() renders them in UTC, which in Uganda (UTC+3) files anything
// made between 00:00 and 03:00 under the previous day. getLocalDateString is
// the one function allowed to produce those strings.

function utcDay(d: Date): string {
  return d.toISOString().split("T")[0];
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("getLocalDateString", () => {
  it("reads the local calendar day, not the UTC one", () => {
    // Built from local components, so the expectation holds in any timezone.
    const justAfterMidnight = new Date(2026, 0, 1, 0, 30, 0);
    expect(getLocalDateString(justAfterMidnight)).toBe("2026-01-01");
    expect(getLocalDateString(justAfterMidnight)).toBe(localDay(justAfterMidnight));
  });

  it("stays on the same day right up to the end of the local day", () => {
    const lastMinute = new Date(2026, 11, 31, 23, 59, 59);
    expect(getLocalDateString(lastMinute)).toBe("2026-12-31");
  });

  it("does not shift when the local day and the UTC day disagree", () => {
    // This is the case the toISOString() version gets wrong. Depending on the
    // machine's offset one of the two instants below straddles midnight UTC,
    // so at least one assertion below is the UTC answer and at least one is
    // the local one — either way the function must return the local one.
    const earlyLocal = new Date(2026, 0, 1, 0, 30, 0);
    const lateLocal = new Date(2026, 0, 1, 23, 30, 0);

    expect(getLocalDateString(earlyLocal)).toBe(localDay(earlyLocal));
    expect(getLocalDateString(lateLocal)).toBe(localDay(lateLocal));

    // Document the failure mode this guards: the two disagree whenever the
    // runtime is not on UTC. Which instant straddles midnight depends on which
    // side of UTC the machine sits.
    const offsetMinutes = -new Date().getTimezoneOffset();
    if (offsetMinutes > 0) {
      expect(localDay(earlyLocal)).not.toBe(utcDay(earlyLocal));
    } else if (offsetMinutes < 0) {
      expect(localDay(lateLocal)).not.toBe(utcDay(lateLocal));
    }
  });

  it("defaults to today's local day", () => {
    expect(getLocalDateString()).toBe(localDay(new Date()));
  });
});

// The function above is correct; nothing stops the next feature from writing
// the toISOString() version again. This is the guard: these are the files that
// build a calendar date out of "now" and compare it to a stored YYYY-MM-DD —
// admission, dropout, transfer and syllabus-completion dates, the current-term
// lookup, the absence-SMS run, the parent portal's "today". One of them going
// back to UTC would put a student's admission date on the wrong day for every
// school in Uganda without anything looking broken.
describe("no UTC day-strings in date-comparing code", () => {
  const files = [
    "src/lib/hooks/attendance.ts",
    "src/lib/hooks/students.ts",
    "src/lib/hooks/useSyllabusPlanner.ts",
    "src/hooks/useStudentDropouts.ts",
    "src/hooks/useStudentTransfers.ts",
    "src/lib/academic-context.tsx",
    "src/lib/operations.ts",
    "src/lib/sms-automation.ts",
    "src/lib/automation-engine.ts",
    "src/lib/uganda-school-calendar.ts",
    "src/app/parent-portal/page.tsx",
    "src/app/parent-portal/events/page.tsx",
  ];

  const read = (rel: string) => require("fs").readFileSync(require("path").join(process.cwd(), rel), "utf8");

  it.each(files)("%s derives its date with getLocalDateString", (rel) => {
    const source = read(rel);
    expect(source).not.toContain('.toISOString().split("T")[0]');
    expect(source).toContain("getLocalDateString");
  });
});
