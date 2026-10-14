import * as fs from "node:fs";
import * as path from "node:path";

// The target device for this app is a budget Android — a Galaxy A03 Core-class
// handset with 2GB of RAM on Chrome. These assertions pin the viewport-unit
// choices that decide whether a page is usable on one.

const ROOT = path.join(__dirname, "..", "..");
const read = (relativePath: string): string => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const css = read("src/app/globals.css");

describe("viewport height on Android", () => {
  it("gives html/body a dynamic viewport height, not just 100vh", () => {
    const rule = css.match(/html,\s*body\s*\{[^}]*\}/)?.[0];
    expect(rule).toBeDefined();
    expect(rule).toContain("100dvh");
  });

  it("keeps the 100vh fallback ahead of dvh for WebViews without dvh", () => {
    // Order matters: a browser that does not know `dvh` drops that declaration
    // and must still get a usable height from `vh`.
    const rule = css.match(/html,\s*body\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule.indexOf("100vh")).toBeGreaterThan(-1);
    expect(rule.indexOf("100vh")).toBeLessThan(rule.indexOf("100dvh"));
  });

  it("bounds modals by the dynamic viewport so their buttons stay reachable", () => {
    // 58 call sites size themselves with calc(100vh - …). On Android `100vh`
    // is the height with the URL bar *hidden*, so a modal ends up taller than
    // the visible area and its Save/Cancel sits behind the bar — the action
    // cannot be completed on the phone at all. One global dvh override covers
    // every call site.
    const modalRule = css.match(/div\[class\*="fixed inset-0"\][^{]*\{[^}]*max-height:[^}]*\}/)?.[0];
    expect(modalRule).toBeDefined();
    expect(modalRule).toContain("dvh");
  });

  it("keeps the 100vh modal bound as a fallback too", () => {
    expect(css).toMatch(/max-height:\s*calc\(100vh/);
  });
});
