import { confirmedFeePayments, isConfirmedFeePayment } from "@/lib/fee-payment-status";

describe("offline fee payment status", () => {
  it("does not count a queued payment as confirmed money", () => {
    expect(isConfirmedFeePayment({ offline_sync_status: "pending" })).toBe(false);
  });

  it("counts server payments and removes pending rows from settlement totals", () => {
    const rows = [
      { id: "confirmed", amount_paid: 12000 },
      { id: "pending", amount_paid: 5000, offline_sync_status: "pending" as const },
    ];

    expect(confirmedFeePayments(rows)).toEqual([rows[0]]);
  });
});
