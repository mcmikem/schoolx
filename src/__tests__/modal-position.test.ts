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

  it("never retains a transform/filter animation fill that would trap fixed dialogs", () => {
    // A `forwards`/`both` fill keeps the final keyframe's transform/filter on
    // the element forever, and any non-none transform/filter makes it a
    // containing block for position:fixed descendants. `pageEnter` retained
    // translateY(0)/blur(0) on <main>, so every inline dialog rendered against
    // the document (mid-page) instead of the viewport. View-transition
    // pseudo-element snapshots are exempt: they are transient overlays, never
    // ancestors of dialogs.
    const cssFiles = walk(path.join(SRC, "app")).filter((f) => f.endsWith(".css"));
    const offenders: string[] = [];
    for (const file of cssFiles) {
      const rel = path.relative(ROOT, file);
      const src = fs.readFileSync(file, "utf8");
      const keyframes = new Map<string, string>();
      for (const m of src.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
        keyframes.set(m[1], m[2]);
      }
      for (const m of src.matchAll(/animation\s*:[^;]*?([\w-]+)[^;]*?\b(forwards|both)\b[^;]*;/g)) {
        const name = m[1];
        if (name === "none" || name === "inherit" || name === "initial" || name === "unset") continue;
        const frames = keyframes.get(name);
        if (!frames) continue;
        if (/::view-transition/.test(src.slice(Math.max(0, (m.index ?? 0) - 120), m.index ?? 0))) continue;
        if (/transform|filter/.test(frames)) {
          const line = src.slice(0, m.index).split("\n").length;
          offenders.push(`${rel}:${line} (animation retains ${name} with transform/filter)`);
        }
      }
    }
    expect(offenders).toEqual([]);
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
