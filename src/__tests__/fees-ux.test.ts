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

  it("does not read the pupil's name three times per row to a screen reader", () => {
    // checkbox label + photo alt + visible text. The face is decorative here:
    // the name is already rendered next to it.
    const table = read("src/components/fees/FeeTable.tsx");
    expect(table).toContain("decorative");
    expect(table).not.toMatch(/RollCallPhoto[^/]*photoUrl=\{student\.photo_url\}\s*\/>/);
  });

  it("partitions the roster from one source instead of overlapping predicates", () => {
    // balance === 0 counts an unbilled pupil as fully paid; paid === 0 counts
    // the same pupil as unpaid. That double-count shipped "62 Fully Paid"
    // beside "263 Unpaid" on a 201-pupil debtor list.
    const page = read("src/app/dashboard/fees/page.tsx");
    expect(page).toContain("partitionFeeRoster");
    expect(page).not.toMatch(/filter\(\(s\) => s\.balance === 0\)\.length/);
    expect(page).not.toMatch(/filter\(\(s\) => s\.paid === 0\)\.length/);
  });

  it("tells the money story once instead of restating it per block", () => {
    // Four blocks used to each render Expected/Collected/Outstanding with their
    // own rounding, so no two agreed.
    const page = read("src/app/dashboard/fees/page.tsx");
    expect(page).not.toMatch(/^import FinanceSummaryPulse/m);
    expect(page).not.toMatch(/<FinanceSummaryPulse/);
    const expectedCells = page.match(/>Expected</g) ?? [];
    expect(expectedCells.length).toBeLessThanOrEqual(2);
  });

  it("surfaces unbilled pupils instead of silently excluding them", () => {
    const stats = read("src/components/fees/FeeStats.tsx");
    expect(stats).toContain("unbilled");
    expect(stats).toContain("Set fees");
  });

  it("renders Add New Fee through the shared Modal, not a hand-rolled wrapper", () => {
    // Two independent causes pushed this dialog off-screen: iOS Safari resolves
    // a viewport-fixed element that also carries a backdrop blur against the
    // document once the page is scrolled, and an inline render let any ancestor
    // transform/overflow become the containing block. The shared Modal portals
    // to body and keeps the blur on a separate absolute layer.
    const feeForm = read("src/components/fees/FeeFormModal.tsx");
    expect(feeForm).toContain('from "@/components/ui/Modal"');
    expect(feeForm).toContain("<Modal");
    expect(feeForm).not.toMatch(/className="fixed inset-0/);
    // Keep the autosave indicator the header used to carry.
    expect(feeForm).toContain("headerAction");
  });

  it("lets the bursar reach the unbilled pupil the warning names", () => {
    // A count with no route to the row is a dead end: the pupil has balance 0,
    // so the debtors-first default hid exactly the child the warning pointed at.
    const page = read("src/app/dashboard/fees/page.tsx");
    const stats = read("src/components/fees/FeeStats.tsx");
    expect(page).toContain("matchesFeeStatus");
    expect(page).toContain('option value="unbilled"');
    expect(stats).toContain('onFilter?.("unbilled")');
    expect(stats).toContain("pupils cleared");
  });

  it("keeps one tab row instead of a tab bar inside a tab bar", () => {
    // Balances/Payments/Structure were a second tab bar nested under the
    // Finance tabs, so the list sat behind two "where am I" rows.
    const page = read("src/app/dashboard/fees/page.tsx");
    expect(page).toContain("FINANCE_TABS");
    expect(page).not.toMatch(/<Tabs\s/);
  });

  it("keeps one primary action and hides the rest behind a menu", () => {
    const page = read("src/app/dashboard/fees/page.tsx");
    expect(page).toContain('aria-label="More fee actions"');
    expect(page).toContain('role="menuitem"');
  });
});
