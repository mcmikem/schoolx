import { bucketTriageBalances, partitionFeeRoster, splitBalance, TRIAGE_BANDS } from "@/lib/fee-triage";

describe("bucketTriageBalances", () => {
  const balances = [
    { balance: 600_000 },
    { balance: 500_000 }, // lower edge belongs to the band above
    { balance: 300_000 },
    { balance: 200_000 },
    { balance: 100_000 },
    { balance: 50_000 },
    { balance: 20_000 },
    { balance: 0 }, // cleared — never a debtor
    { balance: -5_000 }, // overpaid — never a debtor
  ];

  it("buckets every owing balance into exactly one band", () => {
    const bands = bucketTriageBalances(balances);
    const byId = Object.fromEntries(bands.map((b) => [b.id, b]));
    expect(byId.b500.count).toBe(2);
    expect(byId.b200.count).toBe(2);
    expect(byId.b50.count).toBe(2);
    expect(byId.bSmall.count).toBe(1);
    expect(bands.reduce((sum, b) => sum + b.count, 0)).toBe(7);
  });

  it("totals each band and scales bars to the fullest", () => {
    const bands = bucketTriageBalances(balances);
    const byId = Object.fromEntries(bands.map((b) => [b.id, b]));
    expect(byId.b500.total).toBe(1_100_000);
    expect(byId.bSmall.total).toBe(20_000);
    expect(byId.b500.widthPct).toBe(100);
    expect(byId.bSmall.widthPct).toBe(50);
  });

  it("handles an empty ledger without dividing by zero", () => {
    const bands = bucketTriageBalances([]);
    expect(bands).toHaveLength(TRIAGE_BANDS.length);
    expect(bands.every((b) => b.count === 0 && b.total === 0 && b.widthPct === 0)).toBe(true);
  });
});

describe("splitBalance", () => {
  it("splits a balance into whole-UGX installments, rounding up", () => {
    expect(splitBalance(450_000, 3)).toBe(150_000);
    expect(splitBalance(100_000, 3)).toBe(33_334);
    expect(splitBalance(0, 3)).toBe(0);
  });

  it("never returns a negative or NaN installment", () => {
    expect(splitBalance(-1_000, 2)).toBe(0);
    expect(splitBalance(10_000, 0)).toBe(10_000);
  });
});

describe("partitionFeeRoster", () => {
  // Mirrors the production report: 325 pupils, 62 of whose classes have no fee
  // structure, 201 owing, 0 partial, 62 settled. The old predicates reported
  // "62 Fully Paid" alongside "263 Unpaid" — the 62 unbilled pupils counted as
  // both, so the buckets summed to 325 and the rate read 19% off a 325 base.
  const roster = [
    ...Array.from({ length: 62 }, () => ({ expected: 0, paid: 0, balance: 0 })), // unbilled
    ...Array.from({ length: 62 }, () => ({ expected: 200_000, paid: 200_000, balance: 0 })), // cleared
    ...Array.from({ length: 33 }, () => ({ expected: 200_000, paid: 0, balance: 200_000 })), // owing
    ...Array.from({ length: 168 }, () => ({ expected: 150_000, paid: 0, balance: 150_000 })), // owing
  ];

  const p = partitionFeeRoster(roster);

  it("puts every pupil in exactly one bucket", () => {
    expect(p.owing + p.partial + p.cleared + p.unbilled).toBe(p.roster);
    expect(p.roster).toBe(325);
  });

  it("keeps unbilled pupils out of both collection buckets", () => {
    expect(p.unbilled).toBe(62);
    expect(p.cleared).toBe(62); // only the genuinely settled ones
    expect(p.owing).toBe(201);
    expect(p.partial).toBe(0);
  });

  it("reports the count that actually owes, not every pupil who never paid", () => {
    // The old "263 unpaid" counted unbilled pupils. Only 201 owe money.
    expect(p.owing + p.partial).toBe(201);
  });

  it("computes collection rate over billed pupils only", () => {
    expect(p.billed).toBe(263);
    // 62 cleared of 263 billed = 24%, not 62/325 = 19%.
    expect(p.collectionRate).toBe(24);
    expect(p.billed > 0 && p.cleared / p.billed).toBeCloseTo(0.2359, 3);
  });

  it("does not divide by zero on an empty or fully-unbilled school", () => {
    expect(partitionFeeRoster([]).collectionRate).toBe(0);
    const noFees = partitionFeeRoster([{ expected: 0, paid: 0, balance: 0 }]);
    expect(noFees.billed).toBe(0);
    expect(noFees.collectionRate).toBe(0);
    expect(noFees.realizationRate).toBe(0);
  });

  it("treats a written-off balance as cleared, not still owing", () => {
    // balance arrives already clamped to 0 by calculateStudentFeePosition
    const w = partitionFeeRoster([{ expected: 200_000, paid: 0, balance: 0 }]);
    expect(w.cleared).toBe(1);
    expect(w.owing).toBe(0);
  });
});
