import * as fs from "node:fs";
import * as path from "node:path";

/**
 * B1-04: the teacher and dean dashboards had no <h1> at all.
 *
 * SchoolHero rendered the greeting — visually the page title at 20px bold Sora —
 * in a <p>. Teacher and dean are the only two dashboards with no other h1, so
 * their pages started at h2: a heading-hierarchy break and a screen-reader
 * navigation dead end.
 *
 * The greeting is now a heading. Dashboards that already own an h1 demote the
 * greeting to h2 so it stays a greeting rather than competing with the page
 * title.
 *
 * These are structural assertions over the component graph the router dispatches
 * to, pinned per role. A rendering check would need a full session per role;
 * this catches the specific way the bug returns — a hero left as a <p>, or a
 * demoted hero with nothing owning the h1.
 */

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

type H1Source = "own" | "hero" | "pageheader" | "roleheader";

const CASES: Array<{ role: string; file: string; h1: H1Source }> = [
  {
    role: "headmaster / school_admin / admin / board",
    file: "src/app/dashboard/dashboards/HeadmasterDashboard.tsx",
    h1: "pageheader",
  },
  { role: "dean_of_studies", file: "src/app/dashboard/dashboards/DeanDashboard.tsx", h1: "hero" },
  { role: "bursar", file: "src/app/dashboard/dashboards/BursarDashboard.tsx", h1: "pageheader" },
  { role: "teacher", file: "src/app/dashboard/dashboards/TeacherDashboard.tsx", h1: "hero" },
  { role: "secretary", file: "src/app/dashboard/DashboardRouter.tsx", h1: "roleheader" },
  { role: "dorm_master", file: "src/app/dashboard/DashboardRouter.tsx", h1: "roleheader" },
  { role: "marketer", file: "src/app/dashboard/dashboards/MarketerDashboard.tsx", h1: "own" },
  { role: "super_admin", file: "src/app/dashboard/dashboards/SuperAdminDashboard.tsx", h1: "pageheader" },
];

describe("every role dashboard has exactly one page h1", () => {
  it.each(CASES)("%s", ({ file, h1 }) => {
    const src = read(file);
    const hasH1 = /<h1[\s>]/.test(src);
    const hasHero = /<SchoolHero[\s>]/.test(src);
    const hasPageHeader = /<PageHeader[\s>]/.test(src);
    const heroDemoted = /headingLevel="h2"/.test(src);

    switch (h1) {
      case "own":
        expect(hasH1).toBe(true);
        expect(hasHero).toBe(false);
        break;
      case "hero":
        // The greeting is the page title, and nothing else provides an h1.
        expect(hasHero).toBe(true);
        expect(hasH1).toBe(false);
        expect(hasPageHeader).toBe(false);
        expect(heroDemoted).toBe(false);
        break;
      case "pageheader":
        // PageHeader owns the h1, so the greeting must step down.
        expect(hasPageHeader).toBe(true);
        if (hasHero) expect(heroDemoted).toBe(true);
        expect(hasH1).toBe(false);
        break;
      case "roleheader":
        // RoleDashboardHeader renders <h1>{greeting}, {name}</h1>
        expect(/<h1[\s\S]*?\{greeting\}, \{name\}/.test(src)).toBe(true);
        expect(hasHero).toBe(false);
        break;
    }
  });

  it("SchoolHero renders the greeting as a heading, not a paragraph", () => {
    const hero = read("src/components/dashboard/SchoolHero.tsx");
    expect(hero).toMatch(/headingLevel = "h1"/);
    expect(hero).toMatch(/<h1[^>]*>\s*\{resolvedGreeting\}/);
    expect(hero).toMatch(/<h2[^>]*>\s*\{resolvedGreeting\}/);
    expect(hero).not.toMatch(/<p[^>]*>\s*\{resolvedGreeting\}/);
  });

  it("RoleDashboardHeader keeps its h1 for the office dashboards", () => {
    expect(read("src/app/dashboard/DashboardRouter.tsx")).toMatch(/<h1[\s\S]*?\{greeting\}, \{name\}/);
  });
});
