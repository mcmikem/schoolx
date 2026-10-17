import { generatePaymentReference } from "@/lib/hooks/fees";

/**
 * Every payment gets a reference, so there is nothing left to clash with.
 *
 * The constraint that makes this safe rather than dangerous: a reference is the
 * idempotency key. If it were regenerated per submit attempt, a retry after a
 * timeout would carry a different value, the duplicate guard would not see it,
 * and the payment would be recorded twice -- the exact thing the reference
 * exists to prevent. So it is generated once per opening of the form.
 */

describe("generatePaymentReference", () => {
  const when = new Date("2026-10-17T09:30:00");

  it("reads as school, date and a tail", () => {
    expect(generatePaymentReference("KIK001", when)).toMatch(/^KIK001-261017-[A-Z0-9]+$/);
  });

  it("falls back to PAY when the school has no code", () => {
    expect(generatePaymentReference(null, when)).toMatch(/^PAY-261017-/);
    expect(generatePaymentReference(undefined, when)).toMatch(/^PAY-261017-/);
  });

  it("sanitises a school code a person could have typed", () => {
    // Not just defensive: the code is echoed back to parents over the phone.
    expect(generatePaymentReference("St Mary's / P1", when)).toMatch(/^STMARYSP-261017-/);
    expect(generatePaymentReference("", when)).toMatch(/^PAY-/);
  });

  it("never returns an empty tail", () => {
    for (let i = 0; i < 200; i += 1) {
      const ref = generatePaymentReference("KIK", when);
      const tail = ref.split("-")[2];
      expect(tail).toBeTruthy();
      expect(tail.length).toBeGreaterThan(0);
    }
  });

  it("gives the tail enough entropy to be safe", () => {
    // Six base-36 characters. The first attempt was five of three bytes, which
    // clipped the last byte to one character and left ~46k possibilities --
    // 2000 draws in one second produced five collisions. Asserted on the width
    // rather than on a large sample, because a uniqueness assertion over many
    // draws is itself a flaky test at any entropy that is actually usable.
    expect(generatePaymentReference("KIK", when).split("-")[2]).toHaveLength(6);
  });

  it("does not repeat within a burst a school could plausibly record", () => {
    // The whole point: no clashes for a bursar to resolve.
    const refs = new Set<string>();
    for (let i = 0; i < 500; i += 1) refs.add(generatePaymentReference("KIK", when));
    expect(refs.size).toBe(500);
  });

  it("caps the school-code prefix so the tail is never truncated away", () => {
    const ref = generatePaymentReference("A-VERY-LONG-SCHOOL-CODE-INDEED", when);
    expect(ref.split("-")[0].length).toBeLessThanOrEqual(8);
    expect(ref.split("-")[2]).toBeTruthy();
  });
});
