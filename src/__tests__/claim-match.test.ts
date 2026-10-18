import { matchClaimToPayments, matchClaimsToPayments, normalizeReference } from "@/lib/claim-match";

describe("normalizeReference", () => {
  it("strips punctuation, spaces and case", () => {
    expect(normalizeReference(" MP-123 456 ")).toBe("MP123456");
    expect(normalizeReference(null)).toBe("");
    expect(normalizeReference(undefined)).toBe("");
  });
});

describe("matchClaimToPayments", () => {
  const baseClaim = {
    id: "c1",
    student_id: "st1",
    amount: 50000,
    claimed_method: "mobile_money",
    reference: "MP123456",
    created_at: "2026-02-10T09:00:00Z",
  };

  it("flags a duplicate when the reference is already recorded", () => {
    const match = matchClaimToPayments(baseClaim, [
      {
        id: "p1",
        student_id: "st9",
        amount_paid: 50000,
        payment_reference: "mp-123 456",
        payment_method: "mobile_money",
        payment_date: "2026-02-10T08:00:00Z",
      },
    ]);

    expect(match.kind).toBe("duplicate_reference");
    expect(match.confidence).toBe("high");
    expect(match.alreadyRecorded).toBe(true);
    expect(match.paymentId).toBe("p1");
  });

  it("matches the same pupil, amount and method within the date window", () => {
    const match = matchClaimToPayments(baseClaim, [
      {
        id: "p2",
        student_id: "st1",
        amount_paid: 50000,
        payment_reference: null,
        payment_method: "mobile_money",
        payment_date: "2026-02-11T08:00:00Z",
      },
    ]);

    expect(match.kind).toBe("same_student_amount");
    expect(match.confidence).toBe("medium");
    expect(match.alreadyRecorded).toBe(true);
  });

  it("ignores a same-amount payment for a different pupil", () => {
    const match = matchClaimToPayments(baseClaim, [
      {
        id: "p3",
        student_id: "st2",
        amount_paid: 50000,
        payment_reference: null,
        payment_method: "mobile_money",
        payment_date: "2026-02-11T08:00:00Z",
      },
    ]);

    expect(match.kind).toBe("none");
    expect(match.alreadyRecorded).toBe(false);
  });

  it("ignores a same-amount payment outside the date window", () => {
    const match = matchClaimToPayments(baseClaim, [
      {
        id: "p4",
        student_id: "st1",
        amount_paid: 50000,
        payment_reference: null,
        payment_method: "mobile_money",
        payment_date: "2026-01-01T08:00:00Z",
      },
    ]);

    expect(match.kind).toBe("none");
  });

  it("ignores a different amount for the same pupil and method", () => {
    const match = matchClaimToPayments(baseClaim, [
      {
        id: "p5",
        student_id: "st1",
        amount_paid: 70000,
        payment_reference: null,
        payment_method: "mobile_money",
        payment_date: "2026-02-11T08:00:00Z",
      },
    ]);

    expect(match.kind).toBe("none");
  });

  it("still matches amount by pupil when dates are unknown", () => {
    const match = matchClaimToPayments({ ...baseClaim, created_at: null }, [
      {
        id: "p6",
        student_id: "st1",
        amount_paid: 50000,
        payment_reference: null,
        payment_method: "mobile_money",
        payment_date: null,
      },
    ]);

    expect(match.kind).toBe("same_student_amount");
  });
});

describe("matchClaimsToPayments", () => {
  it("returns a match per claim keyed by id", () => {
    const map = matchClaimsToPayments(
      [
        { id: "c1", student_id: "st1", amount: 10000, reference: "A1" },
        { id: "c2", student_id: "st2", amount: 20000, reference: "B2" },
      ],
      [{ id: "p1", student_id: "st1", amount_paid: 10000, payment_reference: "A1" }],
    );

    expect(map.get("c1")?.kind).toBe("duplicate_reference");
    expect(map.get("c2")?.kind).toBe("none");
  });
});
