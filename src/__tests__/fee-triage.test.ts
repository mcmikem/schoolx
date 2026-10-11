import { bucketTriageBalances, splitBalance, TRIAGE_BANDS } from "@/lib/fee-triage";

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
