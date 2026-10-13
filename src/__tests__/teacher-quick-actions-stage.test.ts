import { readFileSync } from "fs";
import { getRequiredModuleForPath, isModuleInFeatureStage, type FeatureStage } from "@/lib/modules/catalog";

/**
 * Regression cover for the `core`-plan dead zone.
 *
 * A teacher on a core-stage school has the sidebar filtered down to four links
 * (filterGroupsByFeatureStage in SidebarShell), but the dashboard's quick
 * actions were hardcoded. Three of the four pointed at modules core does not
 * include, so tapping "Record grades" / "Add class test" / "Open timetable"
 * routed to /dashboard/no-access with the toast "Upgrade your package to
 * access this module".
 *
 * Both call sites now filter through the same predicate the sidebar uses. This
 * test pins the mapping and the predicate so a new tile can't reintroduce a
 * paywall link by hardcoding it.
 */

const TEACHER_TILES = [
  { href: "/dashboard/attendance" },
  { href: "/dashboard/grades" },
  { href: "/dashboard/homework" },
  { href: "/dashboard/timetable" },
] as const;

const visibleFor = (stage: FeatureStage | undefined) =>
  TEACHER_TILES.filter((tile) => {
    const mod = getRequiredModuleForPath(tile.href);
    return !mod || isModuleInFeatureStage(stage, mod);
  }).map((t) => t.href);

describe("teacher quick actions respect the feature stage", () => {
  it("maps each teacher tile to the module that actually gates it", () => {
    expect(getRequiredModuleForPath("/dashboard/attendance")).toBe("attendance");
    expect(getRequiredModuleForPath("/dashboard/grades")).toBe("marks");
    expect(getRequiredModuleForPath("/dashboard/homework")).toBe("marks");
    expect(getRequiredModuleForPath("/dashboard/timetable")).toBe("operations");
  });

  it("leaves only attendance on a core plan", () => {
    // The bug: 3 of 4 tiles dead-ended on the upgrade screen.
    expect(visibleFor("core")).toEqual(["/dashboard/attendance"]);
  });

  it("adds marks once the school is on academic", () => {
    expect(visibleFor("academic")).toEqual(
      expect.arrayContaining(["/dashboard/attendance", "/dashboard/grades", "/dashboard/homework"]),
    );
    // Timetable is operations, which core and academic still exclude.
    expect(visibleFor("academic")).not.toContain("/dashboard/timetable");
  });

  it("shows every tile on a full plan", () => {
    expect(visibleFor("full")).toHaveLength(TEACHER_TILES.length);
  });

  it("never shows a tile the predicate would reject", () => {
    for (const stage of ["core", "academic", "finance", "full"] as FeatureStage[]) {
      for (const href of visibleFor(stage)) {
        const mod = getRequiredModuleForPath(href);
        // A null module means the route is not gated by any plan, so it is
        // always visible and there is nothing to assert against the stage.
        if (mod) expect(isModuleInFeatureStage(stage, mod)).toBe(true);
      }
    }
  });
});

describe("the two call sites actually use the filtered list", () => {
  // The predicate tests above pass even if the render reverts to the raw array,
  // which is exactly how the bug came back once. Pin the render sites too.
  const read = (path: string) => readFileSync(path, "utf8");

  it("TeacherDashboard renders the filtered actions, not the hardcoded array", () => {
    const src = read("src/app/dashboard/dashboards/TeacherDashboard.tsx");
    expect(src).toContain("visibleTodayActions");
    expect(src).toMatch(/\{\s*visibleTodayActions\.map\(/);
    expect(src).not.toMatch(/\{\s*todayActions\.map\(/);
  });

  it("TeacherQuickGuide filters its steps before rendering", () => {
    const src = read("src/components/dashboard/SchoolReadinessGuide.tsx");
    expect(src).toMatch(/const steps = \[[\s\S]*?\]\.filter\(/);
    expect(src).toMatch(/\{\s*steps\.map\(/);
  });
});

describe("Support sidebar group", () => {
  it("is open by default so the sick bay is one click, not two", () => {
    // Reverted once already: Health is the urgent path (child unwell in
    // class) and must not sit behind a collapsed disclosure.
    const raw = readFileSync("src/lib/navigation.ts", "utf8");
    const support = raw.slice(raw.indexOf('label: "Support"')).replace(/\/\/[^\n]*/g, "");
    expect(support.slice(0, 120)).toContain("defaultOpen: true");
  });
});