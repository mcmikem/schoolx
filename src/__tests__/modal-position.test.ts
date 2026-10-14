import * as fs from "node:fs";
import * as path from "node:path";

// iOS Safari mispositions `position: fixed` elements that also carry
// `backdrop-filter` once the page is scrolled — modals open at document
// coordinates instead of the viewport ("scroll to find the popup").
// The fixed pattern (see ui/Modal.tsx): backdrop classes live on an inner
// absolute layer, never on the fixed container itself.

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("modal positioning", () => {
  it("never combines fixed positioning with backdrop-blur on one element", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(ROOT, file);
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (line.includes("fixed") && line.includes("backdrop-blur")) {
            offenders.push(`${rel}:${i + 1}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the reference pattern intact in ui/Modal", () => {
    const modal = fs.readFileSync(path.join(SRC, "components/ui/Modal.tsx"), "utf8");
    expect(modal).toContain("absolute inset-0 bg-black/50");
  });

  it("paints every hand-rolled dialog panel above its backdrop layer", () => {
    // CSS painting order: within one stacking context a positioned element
    // (the absolute backdrop) paints ABOVE a non-positioned (static) sibling.
    // A dialog panel without `relative` therefore renders UNDER its own
    // backdrop — the dialog looks dimmed and every click lands on the
    // backdrop, so all buttons are dead. Seen on the fees "Restore Draft?"
    // dialog and the settings payment modal.
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(ROOT, file);
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("absolute inset-0")) return;
        if (!/bg-(black|slate)/.test(line)) return;
        // The immediate sibling element carrying a className is the panel.
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const m = lines[j].match(/className="([^"]+)"/);
          if (!m) continue;
          const cls = m[1];
          const looksLikePanel = /rounded-|max-w-|shadow/.test(cls);
          const positioned = /relative|absolute|fixed|sticky/.test(cls);
          if (looksLikePanel && !positioned) {
            offenders.push(`${rel}:${j + 1}`);
          }
          break;
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
