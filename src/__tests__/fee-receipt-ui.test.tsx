import { act, fireEvent, render, screen } from "@testing-library/react";
import ReceiptModal from "@/components/fees/ReceiptModal";
import ReceiptPrompt from "@/components/fees/ReceiptPrompt";

/**
 * Taking a payment should not stop the bursar.
 *
 * Recording a payment used to open a receipt modal over the fees list: the
 * bursar had to close it before the next parent could be served, and it
 * covered the list they were working down. The receipt itself was a table of
 * labels and values -- a debug panel, not a document a parent would be
 * handed.
 *
 * So: the payment lands and a small bar comes up offering the receipt, and
 * the receipt is a receipt.
 */

jest.useFakeTimers();

describe("the payment bar", () => {
  const setup = () => {
    const onSendWhatsApp = jest.fn();
    const onSendSms = jest.fn();
    const onViewReceipt = jest.fn();
    const onDismiss = jest.fn();
    render(
      <ReceiptPrompt
        isOpen
        studentName="Gladys Wasswa"
        amount={50000}
        parentPhone="0772123456"
        onSendWhatsApp={onSendWhatsApp}
        onSendSms={onSendSms}
        onViewReceipt={onViewReceipt}
        onDismiss={onDismiss}
      />,
    );
    return { onSendWhatsApp, onSendSms, onViewReceipt, onDismiss };
  };

  it("says what was added and offers the two ways a parent gets a receipt", () => {
    setup();

    expect(screen.getByText(/Payment added/i)).toBeInTheDocument();
    expect(screen.getByText(/Gladys Wasswa/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sms/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /receipt/i })).toBeInTheDocument();
  });

  it("sends the receipt the way the bursar chose", () => {
    const { onSendWhatsApp, onSendSms, onViewReceipt } = setup();

    fireEvent.click(screen.getByRole("button", { name: /whatsapp/i }));
    expect(onSendWhatsApp).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /sms/i }));
    expect(onSendSms).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /receipt/i }));
    expect(onViewReceipt).toHaveBeenCalledTimes(1);
  });

  it("gets out of the way when nobody is looking at it", () => {
    const { onDismiss } = setup();

    // Not yet.
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("stays up while the bursar is using the phone", () => {
    const { onDismiss } = setup();

    act(() => {
      jest.advanceTimersByTime(2500);
      window.dispatchEvent(new Event("pointerdown"));
      jest.advanceTimersByTime(2500);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("cannot send a receipt to a pupil with no parent on file", () => {
    render(
      <ReceiptPrompt
        isOpen
        studentName="Gladys Wasswa"
        amount={50000}
        parentPhone={null}
        onSendWhatsApp={jest.fn()}
        onSendSms={jest.fn()}
        onViewReceipt={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /whatsapp/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /sms/i })).toBeDisabled();
    // The receipt itself is still available -- the bursar may print it.
    expect(screen.getByRole("button", { name: /receipt/i })).not.toBeDisabled();
  });
});

describe("the receipt", () => {
  const student = { name: "Gladys Wasswa", student_number: "S5B-010", paid: 50000, balance: 0 };

  it("is a document, not a list of rows", () => {
    render(
      <ReceiptModal
        isOpen
        student={student}
        schoolName="St. Mary's Primary School"
        onClose={jest.fn()}
        onPrint={jest.fn()}
        paymentDate="2026-10-21"
        paymentAmount={50000}
        receiptNumber="RCP-000123"
        schoolDetails={{ code: "DEMO001", phone: "0412345678", color: "#0b1c39" }}
      />,
    );

    // The school, the receipt number and the pupil.
    expect(screen.getByText("St. Mary's Primary School")).toBeInTheDocument();
    expect(screen.getByText("RCP-000123")).toBeInTheDocument();
    expect(screen.getByText("Gladys Wasswa")).toBeInTheDocument();
    expect(screen.getByText("S5B-010")).toBeInTheDocument();
    // The amount, said twice: once in the list, once as the number on the slip.
    expect(screen.getAllByText(/UGX\s?50,000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Amount received/i)).toBeInTheDocument();
    // And the state of the account.
    expect(screen.getByText(/Paid in full/i)).toBeInTheDocument();
  });

  it("says when money is still owed", () => {
    render(
      <ReceiptModal
        isOpen
        student={{ ...student, paid: 50000, balance: 200000 }}
        schoolName="St. Mary's Primary School"
        onClose={jest.fn()}
        onPrint={jest.fn()}
        paymentAmount={50000}
        receiptNumber="RCP-000124"
      />,
    );

    expect(screen.getByText(/Balance outstanding/i)).toBeInTheDocument();
  });

  it("explains a missing receipt number instead of leaving a bare dash", () => {
    // Offline payments bank on the phone and get their number when the queue
    // replays; the slip must say so, not look broken.
    render(
      <ReceiptModal
        isOpen
        student={student}
        schoolName="St. Mary's Primary School"
        onClose={jest.fn()}
        onPrint={jest.fn()}
        paymentAmount={50000}
        receiptNumber={null}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/number issued when the payment syncs/i)).toBeInTheDocument();
  });
});
