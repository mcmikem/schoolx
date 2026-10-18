/**
 * The top bar's title must read like a page name, not like a path.
 *
 * It is derived from the route, and nested routes used to keep their slashes:
 * "/dashboard/attendance/history/" became "Attendance/History/". The top bar
 * gives the title about 69px before truncating it, so what a teacher read was
 * "Attendance/Hist...".
 *
 * Each path segment is a word now, so nested routes read as "Attendance
 * History" and "Batch Reports".
 */

import { getPageTitle } from "@/components/dashboard/AccessControlGuard";

describe("getPageTitle", () => {
  it("turns a nested route into words", () => {
    expect(getPageTitle("/dashboard/attendance/history/")).toBe("Attendance History");
  });

  it("does not leave a trailing slash on a single segment", () => {
    expect(getPageTitle("/dashboard/attendance/")).toBe("Attendance");
  });

  it("does not leave a trailing slash on a nested route", () => {
    expect(getPageTitle("/dashboard/attendance/history/")).not.toMatch(/\/$/);
    expect(getPageTitle("/dashboard/attendance/history/")).not.toContain("/");
  });

  it("keeps hyphens readable", () => {
    expect(getPageTitle("/dashboard/audit/scan-events/")).toBe("Audit Scan Events");
  });

  it("drops a record id from the end", () => {
    expect(getPageTitle("/dashboard/students/6f1c2b3a-1111-2222-3333-444455556666/")).toBe(
      "Students",
    );
  });

  it("handles the root dashboard", () => {
    // The root dashboard has a title override.
    expect(getPageTitle("/dashboard")).toBe("Dashboard Overview");
  });

  it("never returns a path-like title for a nested route", () => {
    const nested = [
      "/dashboard/attendance/history/",
      "/dashboard/automation/logs/",
      "/dashboard/batch-reports/",
      "/dashboard/fees/lookup/",
      "/dashboard/exam-timetable/",
    ];
    for (const p of nested) {
      const t = getPageTitle(p);
      expect(t).not.toContain("/");
      expect(t.trim()).not.toBe("");
    }
  });
});