import React from "react";
import { render, screen } from "@testing-library/react";
import FeePaymentHistory from "@/components/fees/FeePaymentHistory";

const payments = [
  {
    id: "pay-1",
    student_id: "stu-1",
    amount_paid: 50000,
    payment_method: "mobile_money",
    payment_reference: "MOMO-1",
    payment_date: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "pay-2",
    student_id: "stu-2",
    amount_paid: 15000,
    payment_method: "cash",
    payment_date: "2026-10-03T09:00:00.000Z",
  },
];

const students = [
  { id: "stu-1", first_name: "Amina", last_name: "Nakato" },
  { id: "stu-2", first_name: "Brian", last_name: "Okello" },
];

describe("FeePaymentHistory", () => {
  it("shows a total and readable payment methods", () => {
    render(
      <FeePaymentHistory
        payments={payments}
        students={students}
        formatCurrency={(amount) => `UGX ${amount.toLocaleString()}`}
        onDeletePayment={() => {}}
        onRecordPayment={() => {}}
      />,
    );

    expect(screen.getByText(/2 payments · UGX 65,000/)).toBeInTheDocument();
    expect(screen.getAllByText("Mobile Money").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cash").length).toBeGreaterThan(0);
    expect(screen.queryByText("Unknown student")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no payments", () => {
    render(
      <FeePaymentHistory
        payments={[]}
        students={students}
        formatCurrency={(amount) => `UGX ${amount}`}
        onDeletePayment={() => {}}
        onRecordPayment={() => {}}
      />,
    );
    expect(screen.getByText("No payments recorded")).toBeInTheDocument();
  });
});
