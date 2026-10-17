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

  it("rejects whitespace-only mobile-money transaction references", () => {
    render(<Form />);
    const search = screen.getByRole("combobox", { name: "Student" });
    fireEvent.change(search, { target: { value: "STU-001" } });
    fireEvent.keyDown(search, { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Amount (UGX)"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.change(screen.getByLabelText("Method"), { target: { value: "mobile_money" } });
    fireEvent.change(screen.getByLabelText("Transaction ID"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Record UGX 1,000" })).toBeDisabled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("shows the overpayment error before blur and enables explicit credit acknowledgement", () => {
    render(<Form />);
    const search = screen.getByRole("combobox", { name: "Student" });
    fireEvent.change(search, { target: { value: "STU-001" } });
    fireEvent.keyDown(search, { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Amount (UGX)"), { target: { value: "400000" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/Amount exceeds student balance/);
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Record excess as credit/ }));
    expect(screen.getByRole("checkbox", { name: /Record excess as credit/ })).toBeChecked();
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled();
  });
});

/**
 * "Paid By" fills itself from the parent on file.
 *
 * The hint that says where the name came from was unreachable: it was gated on
 * the field being EMPTY, and the autofill had already filled it by the time
 * anything rendered. So the name appeared with no explanation -- which is worse
 * than no autofill at all, because the bursar cannot tell a suggestion from a
 * value someone else entered.
 */
function FormWithParents({ parents }: { parents: Record<string, string[]> }) {
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
      parentNamesByStudent={parents}
      newPayment={payment}
      saving={false}
      onPaymentChange={(updates) => setPayment((previous) => ({ ...previous, ...updates }))}
      onSubmit={() => mockSave(payment)}
    />
  );
}

function chooseFirstStudent() {
  const search = screen.getByRole("combobox", { name: "Student" });
  fireEvent.change(search, { target: { value: "STU-001" } });
  fireEvent.keyDown(search, { key: "Enter" });
  fireEvent.change(screen.getByLabelText("Amount (UGX)"), { target: { value: "50000" } });
  fireEvent.click(screen.getByRole("button", { name: /Next/ }));
}

describe("paid by fills from the parent on file", () => {
  beforeEach(() => mockSave.mockClear());

  it("puts the parent's name in the field", () => {
    render(<FormWithParents parents={{ "student-1": ["Nakato Sarah"] }} />);
    chooseFirstStudent();
    expect(screen.getByLabelText("Paid By")).toHaveValue("Nakato Sarah");
  });

  it("says where the name came from", () => {
    // The bug: this hint never rendered, so the name just appeared.
    render(<FormWithParents parents={{ "student-1": ["Nakato Sarah"] }} />);
    chooseFirstStudent();
    expect(screen.getByText(/Filled from the parent on file/i)).toBeInTheDocument();
  });

  it("stops claiming that once someone types their own name", () => {
    render(<FormWithParents parents={{ "student-1": ["Nakato Sarah"] }} />);
    chooseFirstStudent();
    fireEvent.change(screen.getByLabelText("Paid By"), { target: { value: "Grandma Awo" } });
    expect(screen.getByLabelText("Paid By")).toHaveValue("Grandma Awo");
    expect(screen.queryByText(/Filled from the parent on file/i)).toBeNull();
  });

  it("leaves the field empty when no parent is on file", () => {
    render(<FormWithParents parents={{}} />);
    chooseFirstStudent();
    expect(screen.getByLabelText("Paid By")).toHaveValue("");
    expect(screen.queryByText(/Filled from the parent on file/i)).toBeNull();
  });

  it("offers both parents rather than guessing when there are two", () => {
    render(<FormWithParents parents={{ "student-1": ["Nakato Sarah", "Nakato Peter"] }} />);
    chooseFirstStudent();
    expect(screen.getByRole("button", { name: "Nakato Sarah" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nakato Peter" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nakato Peter" }));
    expect(screen.getByLabelText("Paid By")).toHaveValue("Nakato Peter");
  });

  it("never overwrites a name someone already typed", () => {
    function PreTyped() {
      const [payment, setPayment] = useState({
        student_id: "",
        amount_paid: "",
        payment_date: getLocalDateString(),
        payment_method: "cash",
        payment_reference: "",
        momo_provider: "mtn" as const,
        momo_transaction_id: "",
        paid_by: "Sponsor X",
        notes: "",
        allow_overpayment: false,
      });
      return (
        <PaymentModal
          isOpen
          onClose={() => {}}
          students={students}
          parentNamesByStudent={{ "student-1": ["Nakato Sarah"] }}
          newPayment={payment}
          saving={false}
          onPaymentChange={(u) => setPayment((p) => ({ ...p, ...u }))}
          onSubmit={() => mockSave(payment)}
        />
      );
    }
    render(<PreTyped />);
    chooseFirstStudent();
    expect(screen.getByLabelText("Paid By")).toHaveValue("Sponsor X");
  });
});
