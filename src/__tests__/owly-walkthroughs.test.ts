import { existsSync } from "node:fs";
import { join } from "node:path";
import { getNavigationForRoles } from "@/lib/navigation";
import { FALLBACK_WALKTHROUGH, pickWalkthrough, WALKTHROUGHS } from "@/lib/owly-walkthroughs";

const allowedHrefsFor = (roles: string[]) =>
  new Set(getNavigationForRoles(roles).flatMap((g) => g.items.map((i) => i.href)));

describe("walkthroughs only send people where they can go", () => {
  // The whole point of a guided tour is that it cannot become a way to discover
  // pages you have no business on. Every step with a link must resolve to a
  // destination that role's own navigation offers.
  for (const [role, tour] of Object.entries(WALKTHROUGHS)) {
    it(`${role}'s walkthrough links only to their own navigation`, () => {
      const allowed = allowedHrefsFor([role]);
      for (const step of tour.steps) {
        if (!step.href) continue;
        expect({ route: step.href, present: allowed.has(step.href) }).toEqual({ route: step.href, present: true });
      }
    });
  }
});

describe("walkthroughs are written against real routes", () => {
  const tours = [...Object.values(WALKTHROUGHS), FALLBACK_WALKTHROUGH];

  it("every linked route exists on disk", () => {
    // A walkthrough that 404s is worse than no walkthrough: it teaches the user
    // that this app is broken.
    for (const tour of tours) {
      for (const step of tour.steps) {
        if (!step.href) continue;
        expect(step.href === "/dashboard" || step.href.startsWith("/dashboard/")).toBe(true);
        expect(existsSync(join(process.cwd(), "src/app", step.href))).toBe(true);
      }
    }
  });

  it("tells the user how to tell it worked", () => {
    for (const tour of tours) {
      for (const step of tour.steps) {
        expect(step.done.length).toBeGreaterThan(0);
        expect(step.how.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("pickWalkthrough respects the full set of roles a person holds", () => {
  it("uses the walkthrough for a single role", () => {
    expect(pickWalkthrough(["teacher"])?.id).toBe("teacher");
  });

  it("prefers the senior role when someone holds several", () => {
    // A headmaster who also teaches must get the school-wide tour, not the
    // classroom one -- otherwise setup is never covered for them.
    expect(pickWalkthrough(["headmaster", "teacher"])?.id).toBe("headmaster");
    expect(pickWalkthrough(["teacher", "headmaster"])?.id).toBe("headmaster");
  });

  it("skips roles with no walkthrough rather than giving up", () => {
    expect(pickWalkthrough(["librarian", "bursar"])?.id).toBe("bursar");
  });

  it("returns null when nothing matches, so the caller can fall back", () => {
    expect(pickWalkthrough(["librarian"])).toBeNull();
    expect(pickWalkthrough([])).toBeNull();
    expect(pickWalkthrough(undefined)).toBeNull();
  });
});
