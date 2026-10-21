import * as fs from "node:fs";
import * as path from "node:path";
import { hasAnyRole } from "@/lib/roles";

/**
 * The hats a person wears.
 *
 * In a peri-urban or rural school, one job per person is the exception, not
 * the rule: the headmaster teaches, the director of studies teaches, and a
 * teacher is often a parent in the same school.
 *
 * The machinery for this has been in the app since the multi-role migration
 * -- `user_roles` holds every hat, the nav merges them, `canAccessAny` asks
 * "does this person hold the teaching hat at all". But nothing ever WROTE a
 * second hat, so everybody was still on one role, and the staff page offered
 * a single role dropdown.
 *
 * These tests pin the three things that were missing: a way to give a person
 * a second hat, a way to choose which screen they land on, and the parent
 * portal opening for a teacher whose own children are in the school.
 */

const ROOT = path.join(__dirname, "..", "..");
const staffPage = fs.readFileSync(path.join(ROOT, "src/app/dashboard/staff/page.tsx"), "utf8");
const guard = fs.readFileSync(path.join(ROOT, "src/lib/hooks/useParentPortalGuard.ts"), "utf8");
const topBar = fs.readFileSync(path.join(ROOT, "src/components/dashboard/TopBar.tsx"), "utf8");
const rolesRoute = fs.readFileSync(path.join(ROOT, "src/app/api/staff/roles/route.ts"), "utf8");

describe("a person can wear more than one hat", () => {
  it("offers every hat, not one dropdown", () => {
    expect(staffPage).toContain("STAFF_ROLE_OPTIONS");
    // The old single-role select is gone.
    expect(staffPage).not.toMatch(/<select\s+value=\{editForm\.role\}/);
    // The first hat is the main job.
    expect(staffPage).toContain("The first hat is the main job");
  });

  it("writes the hats through one route that keeps both tables in step", () => {
    expect(staffPage).toContain('fetch("/api/staff/roles/"');
    // The route replaces the set, so a hat that was taken away really goes.
    expect(rolesRoute).toContain('from("user_roles")');
    expect(rolesRoute).toContain(".delete()");
    expect(rolesRoute).toContain(".insert(");
    // The primary role stays on the profile, because everything else reads it.
    expect(rolesRoute).toContain("role: primary");
  });

  it("lets teaching follow the teaching hat, not the main job", () => {
    // A headmaster who also teaches must still be able to enter marks and
    // to be set as the class teacher.
    expect(staffPage).toContain('editForm.roles.includes("teacher")');
    expect(staffPage).not.toContain('editForm.role === "teacher"');
  });

  it("shows the other hats in the staff list", () => {
    expect(staffPage).toContain("member.roles || []");
  });
});

describe("a person with two hats chooses the screen they open", () => {
  it("offers the switcher to anyone wearing more than one hat", () => {
    expect(topBar).toContain("Open as");
    expect(topBar).toContain("preferred_dashboard");
    expect(topBar).toContain("switchScreen");
  });

  it("asks the server to write it, so the choice survives a new device", () => {
    expect(topBar).toContain('from("users").update({ preferred_dashboard: role })');
  });
});

describe("a teacher whose children are in the school", () => {
  it("counts the parent hat, not just the main job", () => {
    // The guard read the PRIMARY role, so a teacher-parent was told they were
    // not a parent in a school where they plainly were.
    expect(guard).toContain("hasAnyRole");
    expect(guard).not.toContain('user.role !== "parent"');
    expect(guard).not.toContain('user?.role === "parent"');
  });

  it("opens the portal for a teacher who also holds the parent hat", () => {
    expect(hasAnyRole(["teacher", "parent"], ["parent"])).toBe(true);
    expect(hasAnyRole(["teacher"], ["parent"])).toBe(false);
    expect(hasAnyRole("parent", ["parent"])).toBe(true);
  });
});
