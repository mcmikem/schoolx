/**
 * The balance has to say WHICH fee is owed, not only how much.
 *
 * These are the real numbers from the reported case: Kikunyu, P.2, pupil paid
 * 100,000 against a bill of 235,000 and the screen said "135,000 owing" with
 * nothing to explain it. The truth was that tuition was cleared and uniform was
 * untouched -- and the uniform is only owed on joining, which is the rule that
 * now lives behind students.is_new_admission.
 */

import { allocateAcrossFees, outstandingFees, poolCapacity, totalSettled } from "@/lib/fee-allocation";

/** The reported bill: P.2 tuition 100,000 and a school-wide uniform 135,000. */
const KIKUNYU = [
  { id: "f-tuition", name: "Tuition", amount: 100000, category: "tuition" },
  { id: "f-uniform", name: "Uniform", amount: 135000, category: "uniform" },
];

describe("allocateAcrossFees", () => {
  it("says tuition is cleared and uniform is not, instead of a bare 135,000 owing", () => {
    const result = allocateAcrossFees(KIKUNYU, [{ id: "p1", amount_paid: 100000, fee_id: null }]);

    expect(result).toEqual([
      {
        id: "f-tuition",
        name: "Tuition",
        category: "tuition",
        term: null,
        amount: 100000,
        settled: 100000,
        remaining: 0,
        status: "paid",
        progress: 100,
      },
      {
        id: "f-uniform",
        name: "Uniform",
        category: "uniform",
        term: null,
        amount: 135000,
        settled: 0,
        remaining: 135000,
        status: "unpaid",
        progress: 0,
      },
    ]);
    expect(totalSettled(result)).toBe(100000);
    expect(outstandingFees(result).map((f) => f.name)).toEqual(["Uniform"]);
  });

  it("splits one pooled payment across the lines it covers", () => {
    const result = allocateAcrossFees(KIKUNYU, [{ id: "p1", amount_paid: 150000, fee_id: null }]);

    expect(result[0]).toMatchObject({ settled: 100000, remaining: 0, status: "paid", progress: 100 });
    expect(result[1]).toMatchObject({ settled: 50000, remaining: 85000, status: "partial", progress: 37 });
  });

  it("reports a line as partial, not unpaid, when some of it is settled", () => {
    const result = allocateAcrossFees(
      [{ id: "a", name: "Tuition", amount: 200000 }],
      [{ id: "p1", amount_paid: 50000, fee_id: null }],
    );
    expect(result[0].status).toBe("partial");
    expect(result[0].progress).toBe(25);
  });

  it("sends a payment that names a fee straight to that fee", () => {
    // Paid against uniform specifically, so tuition is untouched even though it
    // sorts first.
    const result = allocateAcrossFees(KIKUNYU, [{ id: "p1", amount_paid: 135000, fee_id: "f-uniform" }]);
    expect(result[0]).toMatchObject({ settled: 0, status: "unpaid" });
    expect(result[1]).toMatchObject({ settled: 135000, status: "paid" });
  });

  it("never settles the same fee twice when several payments name it", () => {
    const result = allocateAcrossFees(
      [{ id: "a", name: "Tuition", amount: 100000 }],
      [
        { id: "p1", amount_paid: 60000, fee_id: "a" },
        { id: "p2", amount_paid: 60000, fee_id: "a" },
      ],
    );
    expect(result[0]).toMatchObject({ settled: 100000, remaining: 0, status: "paid" });
  });

  it("lets a credit settle a line just as a payment does", () => {
    const result = allocateAcrossFees(
      KIKUNYU,
      [],
      [{ id: "a1", adjustment_type: "discount", amount: 100000, fee_id: null }],
    );
    expect(result[0].status).toBe("paid");
    expect(result[1].remaining).toBe(135000);
  });

  it("ignores a debit adjustment, because it grows the bill rather than settling it", () => {
    const result = allocateAcrossFees(
      KIKUNYU,
      [],
      [{ id: "a1", adjustment_type: "penalty", amount: 50000, fee_id: null }],
    );
    expect(result[0].remaining).toBe(100000);
    expect(poolCapacity([], [{ id: "a1", adjustment_type: "penalty", amount: 50000 }])).toBe(0);
  });

  it("treats a payment larger than the bill as clearing it, not as a negative", () => {
    const result = allocateAcrossFees(KIKUNYU, [{ id: "p1", amount_paid: 500000, fee_id: null }]);
    expect(result.every((f) => f.remaining === 0)).toBe(true);
    expect(result.every((f) => f.progress === 100)).toBe(true);
  });

  it("handles a pupil with nothing owed", () => {
    expect(allocateAcrossFees([], [{ id: "p1", amount_paid: 100 }])).toEqual([]);
    const zero = allocateAcrossFees([{ id: "a", name: "Tuition", amount: 0 }]);
    expect(zero[0]).toMatchObject({ remaining: 0, status: "paid", progress: 100 });
  });

  it("ignores payments of zero and negative amounts", () => {
    const result = allocateAcrossFees(KIKUNYU, [
      { id: "p1", amount_paid: 0, fee_id: null },
      { id: "p2", amount_paid: -5000, fee_id: null },
    ]);
    expect(result[0].settled).toBe(0);
    expect(result[1].remaining).toBe(135000);
  });

  it("keeps the order the bursar sees, because that decides where the remainder lands", () => {
    const reversed = [KIKUNYU[1], KIKUNYU[0]];
    const result = allocateAcrossFees(reversed, [{ id: "p1", amount_paid: 100000, fee_id: null }]);
    expect(result[0].name).toBe("Uniform");
    expect(result[0]).toMatchObject({ settled: 100000, remaining: 35000, status: "partial" });
    expect(result[1].name).toBe("Tuition");
    expect(result[1].status).toBe("unpaid");
  });
});
