import { filterBulkRecipients, countUniquePhones } from "@/lib/bulk-recipients";

const PUPILS = [
  { id: "s1", parent_phone: "0701", class_id: "c1" },
  { id: "s2", parent_phone: "0701", class_id: "c1" }, // sibling, same phone
  { id: "s3", parent_phone: "0702", class_id: "c2" },
  { id: "s4", parent_phone: "", class_id: "c1" }, // no phone — never reachable
];

describe("filterBulkRecipients", () => {
  it("returns every pupil with a phone for the all audience", () => {
    const result = filterBulkRecipients(PUPILS, "all");
    expect(result.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("filters by class only when a class is chosen", () => {
    expect(filterBulkRecipients(PUPILS, "class", { classId: "c1" }).map((s) => s.id)).toEqual(["s1", "s2"]);
    // No class chosen yet: no silent narrowing, no silent widening — all.
    expect(filterBulkRecipients(PUPILS, "class", {}).map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("filters to the custom selection", () => {
    expect(filterBulkRecipients(PUPILS, "custom", { selectedIds: ["s3"] }).map((s) => s.id)).toEqual(["s3"]);
  });

  it("matches NOBODY for outstanding_fees while the debtor list is still loading", () => {
    // Regression test: the missing branch used to fall through to the whole
    // school, mass-texting every parent when only debtors were wanted.
    expect(filterBulkRecipients(PUPILS, "outstanding_fees", { debtorIds: null })).toEqual([]);
    expect(filterBulkRecipients(PUPILS, "outstanding_fees", {})).toEqual([]);
  });

  it("matches only loaded debtors for outstanding_fees", () => {
    const result = filterBulkRecipients(PUPILS, "outstanding_fees", { debtorIds: ["s1", "s3"] });
    expect(result.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("excludes phoneless pupils even when they owe fees", () => {
    const result = filterBulkRecipients(PUPILS, "outstanding_fees", { debtorIds: ["s4"] });
    expect(result).toEqual([]);
  });

  it("ignores unknown debtor ids", () => {
    const result = filterBulkRecipients(PUPILS, "outstanding_fees", { debtorIds: ["ghost"] });
    expect(result).toEqual([]);
  });
});

describe("countUniquePhones", () => {
  it("dedupes shared family numbers", () => {
    expect(countUniquePhones(PUPILS)).toBe(2);
  });
});
