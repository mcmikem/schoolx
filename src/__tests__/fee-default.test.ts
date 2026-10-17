/**
 * The default fee is money: it decides which charge a parent's payment is filed
 * under without anyone choosing. So the rule is pinned here, including the cases
 * that came from real data rather than from theory.
 */

import { pickDefaultFee } from "@/lib/fee-default";

const fee = (id: string, name: string, amount: number, extra = {}) => ({
  id,
  name,
  amount,
  ...extra,
});

describe("pickDefaultFee", () => {
  it("defaults to the only tuition line", () => {
    expect(pickDefaultFee([fee("t", "Tuition", 250000)])).toBe("t");
  });

  it("ignores a dirty category that files non-tuition fees under tuition", () => {
    // Live data: "Development Fund" and "app fees" both carry a tuition
    // category. Trusting that column made a development-fund payment the
    // default for an ordinary tuition payment.
    expect(
      pickDefaultFee([
        fee("dev", "Development Fund", 50000, { category: "tuition" } as never),
        fee("app", "app fees", 50000, { category: "Tuition" } as never),
        fee("t", "Tuition", 250000, { category: "Tuition" } as never),
      ]),
    ).toBe("t");
  });

  it("picks tuition even when the name differs", () => {
    expect(
      pickDefaultFee([fee("d", "Development", 50000), fee("t", "Term 1 Tuition", 250000)]),
    ).toBe("t");
  });

  it("treats identical duplicate rows as one fee", () => {
    // One school holds 18 identical Tuition rows; any of them is correct.
    const dupes = Array.from({ length: 18 }, (_, i) => fee(`t${i}`, "Tuition", 150000));
    expect(pickDefaultFee(dupes)).toBe("t0");
  });

  it("still defaults to tuition when prices differ", () => {
    // Leaving this blank put the choice back on the bursar for the common case.
    const chosen = pickDefaultFee([fee("a", "Tuition", 120000), fee("b", "Tuition", 150000)]);
    expect(chosen).toBe("b");
  });

  it("prefers the plain Tuition line over a renamed one", () => {
    const chosen = pickDefaultFee([fee("n", "Term 1 Tuition", 250000), fee("p", "Tuition", 150000)]);
    expect(chosen).toBe("p");
  });

  it("returns nothing when there is no tuition to default to", () => {
    expect(pickDefaultFee([fee("m", "Meals", 80000), fee("d", "Development", 50000)])).toBe("");
  });

  it("returns nothing for an empty list", () => {
    expect(pickDefaultFee([])).toBe("");
  });

  it("ignores retired lines", () => {
    expect(pickDefaultFee([fee("t", "Tuition", 250000, { retired: true })])).toBe("");
    expect(
      pickDefaultFee([fee("t", "Tuition", 250000, { retired: true }), fee("m", "Meals", 80000)]),
    ).toBe("");
  });

  describe("by boarding status", () => {
    it("gives a boarding pupil the boarding fee, not the day rate", () => {
      const fees = [fee("d", "Day", 150000), fee("b", "Boarding", 400000)];
      expect(pickDefaultFee(fees, "boarding")).toBe("b");
      expect(pickDefaultFee(fees, "day")).toBe("d");
    });

    it("falls back to tuition when no line is named for their status", () => {
      expect(pickDefaultFee([fee("t", "Tuition", 250000)], "boarding")).toBe("t");
    });

    it("falls back to tuition when several lines match the status", () => {
      // Two boarding lines are not a basis to choose between them, so the
      // category rule steps aside and tuition decides as it normally would.
      expect(
        pickDefaultFee(
          [fee("b1", "Boarding", 400000), fee("b2", "Boarding", 450000), fee("t", "Tuition", 150000)],
          "boarding",
        ),
      ).toBe("t");
    });

    it("returns nothing when several lines match and there is no tuition either", () => {
      // Better to ask than to file a payment against one of two boarding rates
      // that differ by 50,000.
      expect(
        pickDefaultFee([fee("b1", "Boarding", 400000), fee("b2", "Boarding", 450000)], "boarding"),
      ).toBe("");
    });
  });

  it("is deterministic for the same input", () => {
    const fees = [fee("a", "Tuition", 120000), fee("b", "Tuition", 150000), fee("c", "Tuition", 90000)];
    const first = pickDefaultFee(fees);
    expect([first, pickDefaultFee(fees), pickDefaultFee(fees)]).toEqual([first, first, first]);
  });
});