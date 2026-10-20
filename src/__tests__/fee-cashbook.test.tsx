import React from "react";
import { render, screen } from "@testing-library/react";
import FeeCashbook from "@/components/fees/FeeCashbook";

const summary = { total: 65000, cash: 15000, momo: 50000, bank: 0, count: 2 };
const payments = [
  {
    id: "pay-1",
    payment_date: "2026-10-01T09:00:00.000Z",
    student_id: "stu-1",
    amount_paid: 50000,
    payment_method: "mobile_money",
    payment_reference: "MOMO-1",
    students: { first_name: "Amina", last_name: "Nakato" },
  },
  {
    id: "pay-2",
    payment_date: "2026-10-03T09:00:00.000Z",
    student_id: "stu-2",
    amount_paid: 15000,
    payment_method: "cash",
    students: { first_name: "Brian", last_name: "Okello" },
  },
];

function renderBook(overrides: Partial<Parameters<typeof FeeCashbook>[0]> = {}) {
  return render(
    <FeeCashbook
      cashbookSummary={summary}
      formatCurrency={(amount) => `UGX ${amount.toLocaleString()}`}
      cashbookDateFilter="today"
      setCashbookDateFilter={() => {}}
      exportCashbookCSV={() => {}}
      filteredCashbookPayments={payments}
      {...overrides}
    />,
  );
}

describe("FeeCashbook", () => {
  it("shows the method totals and readable labels", () => {
    renderBook();
    expect(screen.getByText("Total Collected")).toBeInTheDocument();
    expect(screen.getAllByText("Mobile Money").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Amina Nakato/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cash").length).toBeGreaterThan(0);
    expect(screen.getByText(/2 transactions · Today/)).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    renderBook({ filteredCashbookPayments: [], cashbookSummary: { ...summary, count: 0 } });
    expect(screen.getByText("No transactions found")).toBeInTheDocument();
  });
});
