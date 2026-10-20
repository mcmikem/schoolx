import { fireEvent, render, screen, within } from "@testing-library/react";
import BursarReceiptPanel from "@/components/dashboard/BursarReceiptPanel";
import type { FeePayment, Student } from "@/types";

const students = [
  { id: "student-1", first_name: "Amina", last_name: "Nakamya", student_number: "ST001", classes: { name: "P.1" } },
  { id: "student-2", first_name: "Brian", last_name: "Ochen", student_number: "ST002", classes: { name: "P.2" } },
] as Student[];
const payments = [
  {
    id: "payment-1",
    student_id: "student-1",
    amount_paid: 150000,
    payment_method: "mobile_money",
    payment_reference: "MM-123",
    payment_date: "2026-10-14",
  },
  { id: "payment-2", student_id: "student-2", amount_paid: 0, payment_method: "cash", payment_date: "2026-10-15" },
] as FeePayment[];

function panel(overrides: Partial<Parameters<typeof BursarReceiptPanel>[0]> = {}) {
  return render(
    <BursarReceiptPanel
      payments={payments}
      students={students}
      loading={false}
      error={null}
      onRetry={jest.fn()}
      {...overrides}
    />,
  );
}

describe("bursar receipts", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 15, 12));
  });
  afterEach(() => jest.useRealTimers());

  it("sorts newest first without mutating input and preserves a recorded zero", () => {
    panel();
    const rows = within(screen.getByRole("list", { name: "Loaded receipts" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Brian Ochen");
    expect(rows[0]).toHaveTextContent("UGX 0");
    expect(rows[1]).toHaveTextContent("Mobile money");
    expect(payments[0].id).toBe("payment-1");
  });

  it.each(["amina", "ST001", "p.1", "mm-123", "  AMINA  "])("searches loaded records by %s", (query) => {
    panel();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a receipt" }), { target: { value: query } });
    expect(screen.getByText("Amina Nakamya")).toBeInTheDocument();
    expect(screen.queryByText("Brian Ochen")).not.toBeInTheDocument();
  });

  it("keeps receipt date separate from the date it was entered", () => {
    panel({ payments: [{ ...payments[0], created_at: "2026-10-15T10:00:00Z" }, payments[1]] });
    fireEvent.click(screen.getByRole("button", { name: "Dated today" }));
    expect(screen.getByRole("button", { name: "Dated today" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Brian Ochen")).toBeInTheDocument();
    expect(screen.queryByText("Amina Nakamya")).not.toBeInTheDocument();
  });

  it("recovers from empty results and clears both filters", () => {
    panel();
    fireEvent.click(screen.getByRole("button", { name: "Dated today" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a receipt" }), { target: { value: "unknown" } });
    expect(screen.getByRole("status")).toHaveTextContent("No receipts match your search");
    fireEvent.click(screen.getByRole("button", { name: "Reset receipt filters" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Latest receipts" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Amina Nakamya")).toBeInTheDocument();
  });

  it("uses joined student details when a student is outside the loaded roster", () => {
    panel({ students: [], payments: [{ ...payments[0], students: students[0] }] });
    expect(screen.getByText("Amina Nakamya")).toBeInTheDocument();
  });

  it("shows loading rather than an empty-register claim", () => {
    panel({ loading: true, payments: [] });
    expect(screen.getByRole("status")).toHaveTextContent("Loading receipts");
    expect(screen.queryByText("No receipts to show yet")).not.toBeInTheDocument();
  });

  it("shows a retryable error rather than stale receipts", () => {
    const onRetry = jest.fn();
    panel({ error: "Offline", onRetry });
    expect(screen.getByRole("alert")).toHaveTextContent("Receipts could not be loaded");
    expect(screen.queryByRole("list", { name: "Loaded receipts" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry receipts" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("states the loaded-record boundary and limits the preview to five rows", () => {
    panel({ payments: Array.from({ length: 8 }, (_, index) => ({ ...payments[0], id: `payment-${index}` })) });
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 5 of 8 matching loaded receipts");
    expect(screen.getByRole("link", { name: "Full ledger" })).toHaveAttribute("href", "/dashboard/fee-ledger");
  });
});
