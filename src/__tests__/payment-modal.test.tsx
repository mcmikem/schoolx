import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import PaymentModal from "@/components/fees/PaymentModal";
import { getLocalDateString } from "@/lib/hooks/utils";

jest.mock("@/components/ui/Modal", () => ({
  Modal: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}));
const students = [
  { id: "student-1", name: "Amina Nakamya", balance: 350000, student_number: "STU-001", class_name: "P.3" },
  { id: "student-2", name: "Amina Nakato", balance: 200000, student_number: "STU-002", class_name: "P.7" },
];
const mockSave = jest.fn();
function Form() {
  const [payment, setPayment] = useState({
    student_id: "",
    amount_paid: "",
    payment_date: getLocalDateString(),
    payment_method: "cash",
    payment_reference: "",
    momo_provider: "mtn" as const,
    momo_transaction_id: "",
    paid_by: "",
    notes: "",
    allow_overpayment: false,
  });
  return (
    <PaymentModal
      isOpen
      onClose={() => {}}
      students={students}
      newPayment={payment}
      saving={false}
      onPaymentChange={(updates) => setPayment((previous) => ({ ...previous, ...updates }))}
      onSubmit={() => mockSave(payment)}
    />
  );
}

describe("record payment form", () => {
  beforeEach(() => {
    mockSave.mockClear();
  });

  it("finds students by number and saves the chosen payment date", () => {
    render(<Form />);
    const search = screen.getByRole("combobox", { name: "Student" });
    fireEvent.change(search, { target: { value: "STU-002" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(mockSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Amount (UGX)"), { target: { value: "50000" } });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.change(screen.getByLabelText("Payment date"), { target: { value: "2026-02-05" } });
    fireEvent.click(screen.getByRole("button", { name: "Record UGX 50,000" }));
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: "student-2", payment_date: "2026-02-05", amount_paid: "50000" }),
    );
  });

  it("requires choosing a result instead of accepting a typed name", () => {
    render(<Form />);
    fireEvent.change(screen.getByRole("combobox", { name: "Student" }), { target: { value: "Amina" } });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Amount (UGX)"), { target: { value: "50000" } });
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("does not allow recording a future-dated payment", () => {
    render(<Form />);
    const search = screen.getByRole("combobox", { name: "Student" });
    fireEvent.change(search, { target: { value: "STU-001" } });
    fireEvent.keyDown(search, { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Amount (UGX)"), { target: { value: "50000" } });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    fireEvent.change(screen.getByLabelText("Payment date"), { target: { value: getLocalDateString(tomorrow) } });
    expect(screen.getByRole("button", { name: "Record UGX 50,000" })).toBeDisabled();
    expect(mockSave).not.toHaveBeenCalled();
  });
});
