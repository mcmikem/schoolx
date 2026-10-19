import { feeMatchesClass, filterFeeStructure } from "@/lib/fee-structure";
import type { FeeStructure } from "@/types";

const fee = (overrides: Partial<FeeStructure>): FeeStructure =>
  ({ id: "1", name: "Tuition", amount: 1000, ...overrides }) as FeeStructure;

describe("feeMatchesClass", () => {
  it("shows everything when no class is chosen", () => {
    expect(feeMatchesClass(fee({ class_id: "p1" }), "")).toBe(true);
  });

  it("keeps whole-school fees when a class is chosen", () => {
    expect(feeMatchesClass(fee({ class_id: undefined }), "p1")).toBe(true);
  });

  it("keeps only the chosen class", () => {
    expect(feeMatchesClass(fee({ class_id: "p1" }), "p1")).toBe(true);
    expect(feeMatchesClass(fee({ class_id: "p2" }), "p1")).toBe(false);
  });
});

describe("filterFeeStructure", () => {
  const fees = [
    fee({ id: "1", name: "Tuition", class_id: "p1" }),
    fee({ id: "2", name: "Boarding", class_id: "p2" }),
    fee({ id: "3", name: "Transport", class_id: undefined }),
  ];

  it("combines the class and search filters", () => {
    expect(filterFeeStructure(fees, { classId: "p1" }).map((f) => f.id)).toEqual(["1", "3"]);
    expect(filterFeeStructure(fees, { q: "board" }).map((f) => f.id)).toEqual(["2"]);
    expect(filterFeeStructure(fees, { q: "  BOARD  ", classId: "p1" }).map((f) => f.id)).toEqual([]);
  });

  it("returns everything with no filters", () => {
    expect(filterFeeStructure(fees)).toHaveLength(3);
  });
});
