import * as fs from "node:fs";
import * as path from "node:path";

// Fees Tracker redesign pins: one hero numbers band (no duplicated stat
// grids), debtors-first list, faces on rows, plain "Payment Plans" language.

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("fees tracker redesign", () => {
  it("shows Unpaid — never Pending — on balance badges", () => {
    const table = read("src/components/fees/FeeTable.tsx");
    expect(table).toContain(">Unpaid<");
    expect(table).not.toContain(">Pending<");
  });

  it("calls payment plans by their plain name everywhere", () => {
    for (const file of ["src/app/dashboard/fees/page.tsx", "src/lib/owly-knowledge.ts"]) {
      const text = read(file);
      expect(text).not.toContain("Pay in Bits");
      expect(text).not.toContain("Paying in Bits");
    }
  });

  it("opens the balances list on debtors with a visible way back", () => {
    const page = read("src/app/dashboard/fees/page.tsx");
    expect(page).toContain("setHideCleared(true)");
    expect(page).toMatch(/Owing \(.*\)|All \(.*\)/);
  });

  it("leads fee rows with faces and keeps actions tappable", () => {
    const table = read("src/components/fees/FeeTable.tsx");
    expect(table).toContain("RollCallPhoto");
    expect(table).toContain("min-h-[44px]");
  });
});
