import { getNextStepForRoleForTest as getNextStepForRole } from "@/components/dashboard/TopBar";
import type { UserRole } from "@/lib/roles";

/**
 * The TopBar nudge points at the next thing worth doing.
 *
 * A previous change replaced this with a purely role-based chain, which put
 * `canAccess(role, "students")` first. That is true for teacher, DOS,
 * headmaster, admin and school_admin, so the nudge became a permanent "Add
 * students" for nearly every staff member — it stopped responding to where you
 * were in the flow, which is the only thing that made it useful.
 *
 * The nudge is path-aware again. These tests exist so it cannot quietly become
 * a constant again.
 */

const asRole = (role: string) => role as UserRole;

describe("TopBar next-step nudge", () => {
  it("walks a headmaster through the daily sequence as they move", () => {
    // headmaster has students + attendance + fees + messages, so the whole
    // chain applies. (A bursar cannot take attendance, so it skips that step —
    // see the role-gating tests below.)
    const hm = asRole("headmaster");

    expect(getNextStepForRole("/dashboard", hm)).toMatchObject({
      label: "Add students",
      href: "/dashboard/students",
    });
    expect(getNextStepForRole("/dashboard/students", hm)).toMatchObject({
      label: "Take attendance",
      href: "/dashboard/attendance",
    });
    expect(getNextStepForRole("/dashboard/attendance", hm)).toMatchObject({
      label: "Record fees",
      href: "/dashboard/fees",
    });
    expect(getNextStepForRole("/dashboard/fees", hm)).toMatchObject({
      label: "Send reminders",
      href: "/dashboard/messages",
    });
    expect(getNextStepForRole("/dashboard/messages", hm)).toMatchObject({
      label: "View notices",
      href: "/dashboard/notices",
    });
  });

  it("skips a step the role cannot perform rather than offering it", () => {
    // A bursar has fees but not attendance, so standing on the students page
    // it must not be told to "Take attendance".
    const bursar = asRole("bursar");
    expect(getNextStepForRole("/dashboard/students", bursar)).toMatchObject({
      label: "Record fees",
      href: "/dashboard/fees",
    });
  });

  it("changes with the route rather than being fixed per role", () => {
    const bursar = asRole("bursar");
    const onDashboard = getNextStepForRole("/dashboard", bursar);
    const onFees = getNextStepForRole("/dashboard/fees", bursar);

    expect(onDashboard.href).not.toBe(onFees.href);
  });

  it("skips steps a role cannot perform", () => {
    const teacher = asRole("teacher");

    // A teacher has no fees access, so from Attendance the chain must not
    // offer "Record fees"; it falls through to the next thing they can do.
    const step = getNextStepForRole("/dashboard/attendance", teacher);
    expect(step.href).not.toBe("/dashboard/fees");
  });

  it("never suggests a destination the role is barred from", () => {
    const teacher = asRole("teacher");
    for (const path of [
      "/dashboard",
      "/dashboard/students",
      "/dashboard/attendance",
      "/dashboard/grades",
      "/dashboard/messages",
    ]) {
      expect(getNextStepForRole(path, teacher).href).not.toBe("/dashboard/fees");
    }
  });

  it("sends a role-less session back to the dashboard", () => {
    expect(getNextStepForRole("/dashboard/fees", undefined)).toMatchObject({
      label: "Back to dashboard",
      href: "/dashboard",
    });
  });

  it("always returns a destination that exists", () => {
    for (const role of ["teacher", "bursar", "headmaster", "dean_of_studies", "secretary", "dorm_master"]) {
      for (const path of ["/dashboard", "/dashboard/students", "/dashboard/fees", "/dashboard/messages"]) {
        const { href } = getNextStepForRole(path, asRole(role));
        expect(href).toMatch(/^\/dashboard(\/|$)/);
        expect(href).not.toMatch(/\/$/);
      }
    }
  });
});
