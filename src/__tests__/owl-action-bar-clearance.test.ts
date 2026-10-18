/**
 * The floating assistant must not sit on top of a page's action bar.
 *
 * The assistant is anchored to the bottom right of the viewport. A page that
 * pins a bar along the bottom -- the attendance Save bar, the one a teacher
 * presses to save the register -- would otherwise have the assistant sitting
 * on it, which is the one control on the screen that must always be reachable.
 *
 * The clearance is measured rather than guessed. A fixed 176px cleared the
 * attendance bar by 8px and would have cleared it by nothing at all on a page
 * with a taller bar.
 */

import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("the assistant clears a page action bar", () => {
  const css = read("src/app/globals.css");

  it("uses the measured clearance rather than a fixed offset", () => {
    expect(css).toContain("--action-bar-clearance");
    // The old fixed value must not come back.
    expect(css).not.toMatch(/bottom:\s*calc\(176px/);
  });

  it("still keeps the assistant above the mobile bottom nav", () => {
    expect(css).toContain("--mobile-nav-clearance");
  });

  it("publishes the clearance from the assistant", () => {
    const owl = read("src/components/OwlAssistant.tsx");
    expect(owl).toContain("--action-bar-clearance");
    expect(owl).toContain("[data-page-action-bar]");
  });

  it("re-measures when the bar appears without a navigation", () => {
    // The attendance page shows its Save bar once a class is picked, which is
    // not a route change -- measuring only on pathname left the clearance at
    // zero and the assistant back on top of the bar.
    const owl = read("src/components/OwlAssistant.tsx");
    expect(owl).toContain("MutationObserver");
  });

  it("tags every bottom action bar so it can be found", () => {
    const pages = [
      "src/app/dashboard/attendance/page.tsx",
      "src/app/dashboard/period-attendance/page.tsx",
      "src/app/dashboard/grades/page.tsx",
    ];
    for (const page of pages) {
      const text = read(page);
      // The tag is what the assistant looks for. The sticky class differs
      // between pages, so only the tag is required.
      expect(text).toContain("data-page-action-bar");
    }
  });
});
