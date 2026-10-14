import { readFileSync } from "fs";

/**
 * The requirements board is used standing up, at a counter, on a phone. These
 * cover the decisions that are easy to get wrong and expensive to get wrong in
 * a real school:
 *
 *   - money items and items-to-bring are settled differently
 *   - optional items must never block a pupil from being "cleared"
 *   - the board must not become an exam gate (that is an offence in Uganda)
 *   - the header must tell a bursar what the lawful position actually is
 */

const page = readFileSync("src/app/dashboard/requirements/page.tsx", "utf8");
const hook = readFileSync("src/lib/hooks/requirements.ts", "utf8");

describe("requirements settle money and items differently", () => {
  it("marks a money item paid and an item as brought", () => {
    // The tap target has to branch on the item kind, otherwise pupils are
    // recorded as having paid for things they simply brought.
    expect(page).toContain('item.is_monetary ? "paid" : "brought"');
  });

  it("only records an amount for a money item", () => {
    expect(hook).toContain("requirement.is_monetary");
    expect(hook).toMatch(/amountPaid \?\? requirement\.amount \?\? 0/);
  });
});

describe("optional items never block clearance", () => {
  it("only counts mandatory items toward cleared", () => {
    expect(hook).toContain("itemsForClass(classId).filter((i) => i.is_mandatory)");
  });

  it("disables the toggle on a settled optional item so it can be undone", () => {
    expect(page).toContain("!item.is_mandatory && settled");
  });
});

describe("the board is not an exam gate", () => {
  it("contains nothing that stops a pupil sitting an exam", () => {
    // Blocking a registered candidate over fees is an offence in Uganda.
    expect(page).not.toMatch(/blockExam|preventSit|barFromExam|withholdResult/i);
  });

  it("says so, so the next developer does not add one", () => {
    // Asserted on single-line fragments. The note lives in a doc comment and
    // spans continuation lines, so matching the whole sentence across the
    // comment asterisks is far more brittle than the fact it states.
    expect(page).toContain("Nothing here blocks an exam sitting");
    expect(page).toContain("Withholding a registered candidate's");
    expect(page).toContain("paper over fees is an offence in Uganda");
    // The lawful lever, phrased so it survives the doc-comment line wraps.
    expect(page).toContain("the lawful lever is withholding the");
    expect(page).toContain("report card, which is what the cleared count informs");
  });
});

describe("the legal position on levies is stated where it is edited", () => {
  it("warns that schools may only levy for certain things", () => {
    expect(page).toMatch(/Education\s+Regulations 2008/);
  });
});

describe("marking is idempotent, not duplicating", () => {
  it("updates an existing row when one is already present", () => {
    expect(hook).toContain("const existing = rows.find(");
    expect(hook).toContain(".update({ status, amount_paid: paid");
  });

  it("unmarks by moving back to pending rather than deleting", () => {
    // Re-tapping a settled item must be reversible; deleting the row would
    // silently discard who verified it and when.
    expect(page).toContain('settled ? "pending"');
  });
});

describe("school-wide items apply to every class", () => {
  it("treats a null class as applying everywhere", () => {
    expect(hook).toContain("i.class_id === null || i.class_id === classId");
  });
});

describe("it is usable on a phone at a counter", () => {
  it("keeps touch targets at 44px", () => {
    const minHeights = page.match(/min-h-\[44px\]/g) ?? [];
    expect(minHeights.length).toBeGreaterThanOrEqual(6);
  });

  it("uses numeric inputMode for amounts so a phone shows a keypad", () => {
    expect(page).toContain('inputMode="numeric"');
  });
});
