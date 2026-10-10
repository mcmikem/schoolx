import * as fs from "node:fs";
import * as path from "node:path";

// Flat + tight visual direction: no gradient washes, small radii. These
// tests pin the direction so new gradients cannot creep back in unnoticed.
// Deliberate exceptions (documented below): the ID-card barcode, the kente
// identity stripe, empty-chart hatch, and the loading shimmer — all
// functional textures/motion, not decorative washes.

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

describe("flat design: tight radius scale", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

  it("retunes card radii down through one override block", () => {
    expect(css).toContain(".rounded-xl { border-radius: 8px; }");
    expect(css).toContain(".rounded-2xl { border-radius: 8px; }");
    expect(css).toContain(".rounded-3xl { border-radius: 10px; }");
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
