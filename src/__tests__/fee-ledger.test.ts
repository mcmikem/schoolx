import { summariseLedger } from "@/lib/fee-ledger";

describe("summariseLedger", () => {
  const fees = [{ amount: 300_000 }];

  it("keeps a plain ledger plain", () => {
    const s = summariseLedger({ fees, adjustments: [], openingBalance: 0 });
    expect(s.grossFees).toBe(300_000);
    expect(s.itemised).toBe(false);
  });

  it("itemises a discount so Expected stops looking like bad maths", () => {
    // Kikunyu: gross 300,000, discount 120,000, so Expected reads 180,000 and
    // the reader can reproduce 300 − 120 = 180 instead of doubting the balance.
    const s = summariseLedger({
      fees: [{ amount: 300_000 }],
      adjustments: [{ adjustment_type: "discount", amount: 120_000 }],
      openingBalance: 0,
    });
    expect(s.grossFees).toBe(300_000);
    expect(s.credits).toBe(120_000);
    expect(s.penalties).toBe(0);
    expect(s.itemised).toBe(true);
    // The identity the display now shows.
    expect(s.grossFees + s.openingBalance + s.penalties - s.credits).toBe(180_000);
  });

  it("separates fines from credits and ignores unknown adjustment types", () => {
    const s = summariseLedger({
      fees: [],
      adjustments: [
        { adjustment_type: "penalty", amount: 5_000 },
        { adjustment_type: "scholarship", amount: 10_000 },
        { adjustment_type: "something_else", amount: 999 },
      ],
      openingBalance: 50_000,
    });
    expect(s.penalties).toBe(5_000);
    expect(s.credits).toBe(10_000);
    expect(s.openingBalance).toBe(50_000);
    expect(s.itemised).toBe(true);
  });

  it("handles missing fee breakdowns and negatives without throwing", () => {
    const s = summariseLedger({ fees: null, adjustments: null, openingBalance: null });
    expect(s).toMatchObject({ grossFees: 0, credits: 0, penalties: 0, openingBalance: 0, itemised: false });
    expect(summariseLedger({ fees: [{ amount: -500 }], openingBalance: -1 }).grossFees).toBe(0);
  });
});
