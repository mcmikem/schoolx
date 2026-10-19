/**
 * Every transaction carries when it happened and who entered it.
 *
 * The data was there all along -- fee_payments and fee_adjustments both store
 * recorded_by and created_at -- but nothing rendered them. The ledger showed
 * "Paid · 17/10/2026 · cash · KIINMP91-261017", which reads as a record of the
 * money and not at all as a record of who took it.
 *
 * For transparency that distinction matters. A bursar reconciling a till needs
 * to see who entered a figure and when, and an amount with no name against it
 * cannot be questioned, corrected or audited.
 */

import { describeWho, formatTimeOfDay } from "@/components/fees/FeeTable";

describe("formatTimeOfDay", () => {
  it("renders the clock time from the row's timestamp", () => {
    const shown = formatTimeOfDay("2026-10-17T13:54:36.255613+00:00");
    expect(shown).toMatch(/\d{1,2}:\d{2}/);
  });

  it("returns nothing when there is no timestamp, rather than inventing one", () => {
    // An imported or seeded row may carry only a date. Showing 00:00 would be a
    // fabrication that reads as "recorded at midnight".
    expect(formatTimeOfDay(null)).toBeNull();
    expect(formatTimeOfDay(undefined)).toBeNull();
    expect(formatTimeOfDay("")).toBeNull();
    expect(formatTimeOfDay("not a date")).toBeNull();
  });
});

describe("describeWho", () => {
  const names = new Map([
    ["u-1", "Grace Bursar"],
    ["u-2", "Nkalema Headmaster"],
  ]);

  it("names the person who recorded it", () => {
    expect(describeWho("u-1", names)).toBe("Grace Bursar");
    expect(describeWho("u-2", names)).toBe("Nkalema Headmaster");
  });

  it("never prints a bare Unknown", () => {
    // "Unknown" reads as suspicion, and is usually a parent-portal claim or an
    // uncredited import. Say what it actually is.
    const said = describeWho(null, names);
    expect(said).not.toMatch(/unknown/i);
    expect(said).toMatch(/parent portal|import/i);
  });

  it("says so when the staff member has left", () => {
    // Better an honest gap than a blank, and better than implying the row is
    // unattributable when the id is simply no longer in the users table.
    const said = describeWho("u-gone", names);
    expect(said).toMatch(/no longer on the account/i);
    expect(said).not.toMatch(/unknown/i);
  });

  it("still says something useful when the name map never loaded", () => {
    // Offline, or the users query timed out. The figure must still be
    // attributable to a staff account rather than blank.
    expect(describeWho("u-1", undefined)).toMatch(/staff member/i);
  });
});
