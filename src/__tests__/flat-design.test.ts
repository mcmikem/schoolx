import * as fs from "node:fs";
import * as path from "node:path";

// Visual direction: no gradient washes, and one consistent rounded scale.
//
// The gradient half of this file is unchanged and still enforced: new gradient
// washes must not creep back in unnoticed. Deliberate exceptions (documented
// below): the ID-card barcode, the kente identity stripe, empty-chart hatch,
// and the loading shimmer — all functional textures/motion, not decoration.
//
// The radius half used to pin a "flat + tight" direction that collapsed every
// corner in the app to 6-8px, including .card's own 22px. That is now inverted:
// the reference design is rounded cards on a pale field, so the scale is
// generous and every authored radius snaps onto it. Leaving the old assertions
// would have left the app free to drift back into clipped corners.

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

// [file substring, allowed pattern] pairs: the barcode is the only gradient
// permitted in component markup.
const TSX_ALLOWLIST: Array<[string, RegExp]> = [["dashboard/idcards/page.tsx", /repeating-linear-gradient/]];

describe("flat design: no gradients in markup", () => {
  it("has no gradient backgrounds outside the allowlist", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(ROOT, file);
      const text = fs.readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (!/bg-gradient-|linear-gradient|radial-gradient/.test(line)) return;
        const allowed = TSX_ALLOWLIST.some(([f, re]) => rel.endsWith(f) && re.test(line));
        if (!allowed) offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("references no retired gradient tokens", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(ROOT, file);
      if (/var\(--grad-(teal|navy|amber)\)/.test(fs.readFileSync(file, "utf8"))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

describe("design direction: rounded radius scale", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

  it("retunes radii up through one override block", () => {
    expect(css).toContain(".rounded-xl { border-radius: 14px; }");
    expect(css).toContain(".rounded-2xl { border-radius: 18px; }");
    expect(css).toContain(".rounded-3xl { border-radius: 24px; }");
  });

  it("keeps the scale monotonically increasing", () => {
    // The old block mapped 2xl and 3xl to 8px and 10px, so a "bigger" element
    // was barely more rounded than a small one.
    const px = (cls: string) =>
      Number(css.match(new RegExp(`\\.${cls} \\{ border-radius: (\\d+)px; \\}`))?.[1] ?? -1);
    const lg = px("rounded-lg");
    const xl = px("rounded-xl");
    const xxl = px("rounded-2xl");
    const xxxl = px("rounded-3xl");
    expect(lg).toBeGreaterThan(0);
    expect(xl).toBeGreaterThan(lg);
    expect(xxl).toBeGreaterThan(xl);
    expect(xxxl).toBeGreaterThan(xxl);
  });

  it("no longer collapses authored radii to a single tight value", () => {
    // Every radius collapsing to 8px is what made the app read as boxy next to
    // its own 22px .card component.
    const collapses = css.match(/border-radius: 8px; \}/g) ?? [];
    expect(collapses).toHaveLength(0);
  });

  it("gives .card a radius that matches the scale", () => {
    expect(css).toMatch(/\.card \{[^}]*rounded-\[22px\]/);
  });

  it("keeps circles and pills alone (functional shapes)", () => {
    // No override may touch rounded-full: avatars, dots, pills stay round.
    expect(css).not.toMatch(/\.rounded-full\s*\{[^}]*border-radius(?!:\s*(50%|9999px|999px|100%))/);
  });

  it("flattens the motif washes but keeps the kente identity stripe", () => {
    expect(css).toContain(".bg-motif-fade {\n  background: none;\n}");
    expect(css).toContain("motif-kente-border");
  });
});
