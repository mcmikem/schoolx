/**
 * The fee picker must never claim a class has no fees when it does.
 *
 * This was a real, live bug: "This class has no fees set up" appeared on classes
 * that carried fees, while the pupil was owed money on them. The picker filtered
 * fee lines to the current term, and only 3 of the 8 schools with fees had a
 * current term marked at all -- so currentTerm fell back to 1, and one school
 * sets its fees for term 3 only. The filter matched nothing and reported an
 * empty class.
 *
 * Term and academic year must therefore ORDER the list, never exclude from it. A
 * pupil can be owed a fee for a term the app does not treat as current: balances
 * come from what was billed, not from today's date.
 *
 * feesForClass is defined inside the fees page, so it is pinned here against the
 * source rather than reimplemented, to keep the assertions honest.
 */

import { readFileSync } from "fs";
import { join } from "path";

const page = readFileSync(
  join(process.cwd(), "src/app/dashboard/fees/page.tsx"),
  "utf8",
);

const feesForClass = page.slice(
  page.indexOf("const feesForClass"),
  page.indexOf("const paymentStudent"),
);

describe("fees are ordered by term, not filtered by it", () => {
  it("keeps a fee whose term is not the current term", () => {
    // The exclusion that caused the bug.
    expect(feesForClass).not.toMatch(/return false;\s*\}\s*\)\s*;?\s*$/);
    expect(feesForClass).not.toMatch(/f\.term\s*!==\s*term\s*\)\s*return false/);
  });

  it("does not exclude on academic year either", () => {
    expect(feesForClass).not.toMatch(/f\.academic_year\s*!==\s*academicYear\s*\)\s*return false/);
  });

  it("still excludes the three things that genuinely cannot apply", () => {
    expect(feesForClass).toMatch(/f\.deleted_at\)\s*return false/);
    expect(feesForClass).toMatch(/f\.class_id\s*!==\s*classId\)\s*return false/);
    expect(feesForClass).toMatch(/f\.boarding_status\s*!==\s*boardingStatus/);
  });

  it("sorts the current term first rather than removing the others", () => {
    expect(feesForClass).toMatch(/\.sort\(/);
    expect(feesForClass).toMatch(/a\.term\s*===\s*term\s*\?\s*0\s*:\s*1/);
  });
});

describe("the empty state only appears when there is genuinely nothing", () => {
  const picker = readFileSync(join(process.cwd(), "src/components/fees/FeePicker.tsx"), "utf8");

  it("is gated on having no live fees, not on the list being empty for another reason", () => {
    expect(picker).toMatch(/!live\.length\s*&&\s*\(/);
  });

  it("tells the bursar what to do rather than showing an empty box", () => {
    expect(picker).toMatch(/no fees set up/i);
    expect(picker).toMatch(/Fee Structure/);
  });
});