import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Report cards, ID cards, staff cards and admission letters all print through a
 * pop-up window. Five of those printers used this sequence:
 *
 *   win.document.open();
 *   win.document.body.innerHTML = html;
 *
 * which silently produced a blank tab and no PDF. document.open() resets the
 * document, and Chrome leaves document.body null until something has been
 * written or the document closed -- so the assignment threw a TypeError, the
 * popup stayed on about:blank, and print() was never reached.
 *
 * These assertions are structural: they scan src/ for the pattern rather than
 * assert on one file, because the bug was copy-pasted across six call sites and
 * a per-file test would only have caught one of them.
 */

const SRC = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);

describe("print windows are populated with document.write", () => {
  it("no printer assigns to a print window's body after open()", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // A .document.body write on a window we opened ourselves.
      if (/\b[A-Za-z_$][\w$]*Window\.document\.body\.innerHTML\s*=/.test(src)) {
        offenders.push(file.replace(`${SRC}/`, ""));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every print path goes through the shared helper", () => {
    const helper = join(SRC, "lib/print-window.ts");
    expect(() => statSync(helper)).not.toThrow();

    const src = readFileSync(helper, "utf8");
    expect(src).toContain("doc.write(buildDocument");
    // The header comment quotes the old broken pattern, so only look at code.
    const code = src
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//") && !line.trim().startsWith("/*"))
      .join("\n");
    expect(code).not.toContain("document.body.innerHTML");
  });

  it("the helper opens the window synchronously so pop-up blockers allow it", () => {
    const src = readFileSync(join(SRC, "lib/print-window.ts"), "utf8");
    const fn = src.slice(src.indexOf("export function openPrintWindow"));
    expect(fn.slice(0, fn.indexOf("}"))).not.toContain("await");
    // Callers get a null back when blocked, so they can tell the user.
    expect(fn).toContain("window.open");
  });
});

describe("the known print call sites are migrated", () => {
  const migrated = [
    "app/dashboard/report-cards/page.tsx",
    "app/dashboard/reports/page.tsx",
    "app/dashboard/idcards/page.tsx",
    "app/dashboard/staff/page.tsx",
    "components/reports/ReportCard.tsx",
    "app/dashboard/students/admission-package/page.tsx",
  ];

  it.each(migrated)("%s uses writePrintDocument", (rel) => {
    const src = readFileSync(join(SRC, rel), "utf8");
    expect(src).toContain("@/lib/print-window");
  });
});