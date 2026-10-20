import React from "react";
import { render, screen } from "@testing-library/react";
import FeeInvoiceList from "@/components/fees/FeeInvoiceList";

const invoices = [
  {
    student_id: "stu-1",
    student_name: "Amina Nakato",
    student_number: "S001",
    class_name: "P.5",
    class_id: "p5",
    fee_items: [{ name: "Tuition", amount: 300000 }],
    total_amount: 300000,
    amount_paid: 300000,
    balance: 0,
  },
  {
    student_id: "stu-2",
    student_name: "Brian Okello",
    student_number: "S002",
    class_name: "P.4",
    class_id: "p4",
    fee_items: [{ name: "Tuition", amount: 200000 }],
    total_amount: 200000,
    amount_paid: 50000,
    balance: 150000,
  },
];

const stats = {
  totalInvoiced: 500000,
  totalCollected: 350000,
  totalBalance: 150000,
  fullyPaid: 1,
  hasBalance: 1,
};

function renderList(overrides: Partial<Parameters<typeof FeeInvoiceList>[0]> = {}) {
  return render(
    <FeeInvoiceList
      invoiceStats={stats}
      formatCurrency={(amount) => `UGX ${amount.toLocaleString()}`}
      classes={[
        { id: "p5", name: "P.5" },
        { id: "p4", name: "P.4" },
      ]}
      invoiceClassFilter="all"
      setInvoiceClassFilter={() => {}}
      filteredInvoices={invoices}
      printInvoice={() => {}}
      sendInvoiceSMS={() => {}}
      {...overrides}
    />,
  );
}

describe("FeeInvoiceList", () => {
  it("shows totals and paid/unpaid states", () => {
    renderList();
    expect(screen.getByText("Total Invoiced")).toBeInTheDocument();
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unpaid").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Amina Nakato/).length).toBeGreaterThan(0);
  });

  it("shows an empty state", () => {
    renderList({ filteredInvoices: [] });
    expect(screen.getByText("No invoices")).toBeInTheDocument();
  });
});
