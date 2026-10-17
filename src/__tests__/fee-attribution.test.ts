/**
 * A payment or a discount has to be able to name the fee it applies to.
 *
 * These pin the two things that had to be true for that to be possible at all,
 * and that a refactor could quietly undo:
 *
 * 1. normalizePaymentInput used to return a fixed set of fields and fee_id was
 *    not among them, so the fee was stripped on every write no matter what the
 *    form sent. The column exists in fee_payments and existing rows already use
 *    it; only the app dropped it.
 *
 * 2. An adjustment dropped on the pupil's whole bill cannot be attributed to a
 *    fee, so a bursar discounting meals had nowhere to record it.
 */

import { normalizePaymentInput } from "@/lib/validation";

describe("normalizePaymentInput keeps fee_id", () => {
  const base = {
    student_id: "11111111-1111-1111-1111-111111111111",
    amount_paid: "50000",
    payment_method: "cash",
    payment_date: "2026-03-01",
  };
  const meals = "22222222-2222-2222-2222-222222222222";

  it("carries a chosen fee through to the database row", () => {
    const result = normalizePaymentInput({ ...base, fee_id: meals });
    expect(result).toHaveProperty("fee_id", meals);
  });

  it("does not invent a fee when none was chosen", () => {
    // The whole bill is a real answer, so the field must be absent rather than
    // an empty string: fee_payments.fee_id is a nullable UUID and "" is not
    // null.
    const result = normalizePaymentInput({ ...base });
    expect(result.fee_id).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result, "fee_id")).toBe(false);
  });

  it("treats a blank fee as no fee rather than as \"\"", () => {
    for (const blank of ["", "   ", "\t"]) {
      const result = normalizePaymentInput({ ...base, fee_id: blank });
      expect(result.fee_id).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(result, "fee_id")).toBe(false);
    }
  });

  it("trims the fee id", () => {
    const result = normalizePaymentInput({ ...base, fee_id: `  ${meals}  ` });
    expect(result.fee_id).toBe(meals);
  });

  it("does not let a non-string fee id become the string \"null\"", () => {
    // A truthiness-only check would let undefined/null through as a value.
    const result = normalizePaymentInput({
      ...base,
      fee_id: undefined as unknown as string,
    });
    expect(result.fee_id).toBeUndefined();
  });

  it("leaves the rest of the payment intact", () => {
    const result = normalizePaymentInput({ ...base, fee_id: meals, notes: "Term 1" });
    expect(result.amount_paid).toBe(50000);
    expect(result.payment_method).toBe("cash");
    expect(result.notes).toBe("Term 1");
  });
});