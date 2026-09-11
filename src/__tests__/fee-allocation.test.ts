import {
  buildOutstandingItems,
  allocatePaymentOldestFirst,
  totalOutstanding,
  type ChargeInput,
} from "../lib/server/fee-logic";

const TERM_1: ChargeInput = {
  id: "fee-t1",
  name: "Tuition Term 1",
  amount: 300000,
  due_date: "2026-02-15",
  academic_year: "2026",
  term: 1,
};

const TERM_2: ChargeInput = {
  id: "fee-t2",
  name: "Tuition Term 2",
  amount: 400000,
  due_date: "2026-06-15",
  academic_year: "2026",
  term: 2,
};

const NO_DUE_DATE: ChargeInput = {
  id: "fee-nodue",
  name: "Development Levy",
  amount: 50000,
  due_date: null,
  academic_year: "2026",
  term: 1,
};

describe("buildOutstandingItems", () => {
  it("returns empty when there are no charges", () => {
    expect(buildOutstandingItems([], [{ fee_id: null, amount_paid: 1000 }])).toEqual([]);
  });

  it("returns full balances oldest-first when there are no payments", () => {
    const items = buildOutstandingItems([TERM_2, NO_DUE_DATE, TERM_1], []);
    expect(items.map((i) => i.feeStructureId)).toEqual(["fee-t1", "fee-t2", "fee-nodue"]);
    expect(items.map((i) => i.balance)).toEqual([300000, 400000, 50000]);
  });

  it("orders null due dates after dated charges", () => {
    const items = buildOutstandingItems([NO_DUE_DATE, TERM_1], []);
    expect(items[0].feeStructureId).toBe("fee-t1");
  });

  it("reduces the linked charge and drops fully-paid charges", () => {
    const items = buildOutstandingItems([TERM_1, TERM_2], [{ fee_id: "fee-t1", amount_paid: 300000 }]);
    expect(items.map((i) => i.feeStructureId)).toEqual(["fee-t2"]);
  });

  it("applies partial linked payments to the right charge", () => {
    const items = buildOutstandingItems([TERM_1, TERM_2], [{ fee_id: "fee-t2", amount_paid: 150000 }]);
    expect(items.find((i) => i.feeStructureId === "fee-t2")?.balance).toBe(250000);
    expect(items.find((i) => i.feeStructureId === "fee-t1")?.balance).toBe(300000);
  });

  it("absorbs unlinked historic payments oldest-first", () => {
    const items = buildOutstandingItems([TERM_1, TERM_2], [{ fee_id: null, amount_paid: 350000 }]);
    // 300k clears Term 1, 50k dents Term 2
    expect(items.map((i) => i.feeStructureId)).toEqual(["fee-t2"]);
    expect(items[0].balance).toBe(350000);
  });

  it("clamps over-absorbed balances at zero and drops them", () => {
    const items = buildOutstandingItems([TERM_1], [{ fee_id: null, amount_paid: 999999 }]);
    expect(items).toEqual([]);
  });

  it("ignores zero and negative payment amounts", () => {
    const items = buildOutstandingItems(
      [TERM_1],
      [
        { fee_id: null, amount_paid: 0 },
        { fee_id: "fee-t1", amount_paid: -50 },
      ],
    );
    expect(items).toHaveLength(1);
    expect(items[0].balance).toBe(300000);
  });
});

describe("allocatePaymentOldestFirst", () => {
  const outstanding = () => buildOutstandingItems([TERM_1, TERM_2], []);

  it("fills the oldest charge first on partial payment", () => {
    const { allocations, unallocated } = allocatePaymentOldestFirst(outstanding(), 100000);
    expect(allocations).toEqual([{ feeStructureId: "fee-t1", name: "Tuition Term 1", amount: 100000 }]);
    expect(unallocated).toBe(0);
  });

  it("spans multiple charges oldest-first", () => {
    const { allocations, unallocated, appliedTotal } = allocatePaymentOldestFirst(outstanding(), 500000);
    expect(allocations).toEqual([
      { feeStructureId: "fee-t1", name: "Tuition Term 1", amount: 300000 },
      { feeStructureId: "fee-t2", name: "Tuition Term 2", amount: 200000 },
    ]);
    expect(unallocated).toBe(0);
    expect(appliedTotal).toBe(500000);
  });

  it("returns the remainder as unallocated when amount exceeds outstanding", () => {
    const { allocations, unallocated, appliedTotal } = allocatePaymentOldestFirst(outstanding(), 800000);
    expect(appliedTotal).toBe(700000);
    expect(unallocated).toBe(100000);
    expect(allocations).toHaveLength(2);
  });

  it("handles exact payment and empty inputs", () => {
    expect(allocatePaymentOldestFirst(outstanding(), 700000).unallocated).toBe(0);
    expect(allocatePaymentOldestFirst([], 50000)).toEqual({ allocations: [], unallocated: 50000, appliedTotal: 0 });
    expect(allocatePaymentOldestFirst(outstanding(), 0).allocations).toEqual([]);
  });

  it("avoids float dust on awkward amounts", () => {
    const { allocations, unallocated } = allocatePaymentOldestFirst(outstanding(), 100.1);
    expect(allocations[0].amount).toBe(100.1);
    expect(unallocated).toBe(0);
  });
});

describe("totalOutstanding", () => {
  it("sums balances", () => {
    expect(totalOutstanding(buildOutstandingItems([TERM_1, TERM_2], []))).toBe(700000);
    expect(totalOutstanding([])).toBe(0);
  });
});
