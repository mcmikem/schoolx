import { act, fireEvent, render, screen, within } from "@testing-library/react";
import BursarDashboard from "@/app/dashboard/dashboards/BursarDashboard";
import { useFeePayments, useFeeStructure, useFeeSummary, useStudents } from "@/lib/hooks";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1", name: "Test school" },
    user: { full_name: "James Bursar" },
    isDemo: false,
  }),
}));
jest.mock("@/lib/academic-context", () => ({ useAcademic: () => ({ academicYear: "2026", currentTerm: 1 }) }));
jest.mock("@/lib/hooks", () => ({
  useStudents: jest.fn(),
  useFeePayments: jest.fn(),
  useFeeStructure: jest.fn(),
  useFeeSummary: jest.fn(),
  HIGH_RISK_ARREARS_THRESHOLD: 300000,
  MAX_RETURNED_DEFAULTERS: 5,
}));
jest.mock("@/components/dashboard/MoneyPositionStrip", () => ({
  __esModule: true,
  default: () => <div>Money position</div>,
}));
jest.mock("@/components/dashboard/SchoolCalendar", () => ({ __esModule: true, default: () => <div>Calendar</div> }));

describe("bursar dashboard data states", () => {
  beforeEach(() => {
    (useStudents as jest.Mock).mockReturnValue({ students: [], loading: false, error: null });
    (useFeePayments as jest.Mock).mockReturnValue({ payments: [], loading: false, error: null, refetch: jest.fn() });
    (useFeeStructure as jest.Mock).mockReturnValue({ feeStructure: [], loading: false, error: null });
    (useFeeSummary as jest.Mock).mockReturnValue({ summary: null, loading: false, error: null });
  });

  it("does not turn failed receipt requests into zero daily collections or weekly inactivity", () => {
    (useFeePayments as jest.Mock).mockReturnValue({
      payments: [],
      loading: false,
      error: "Offline",
      refetch: jest.fn(),
    });
    render(<BursarDashboard />);
    const daily = screen.getByRole("region", { name: "Collections" });
    expect(daily).toHaveTextContent("Receipts could not be loaded");
    expect(daily).not.toHaveTextContent("UGX 0");
    expect(screen.queryByRole("img", { name: /collections, total/i })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Fee summary" })).not.toHaveTextContent("UGX 0");
  });

  it("keeps a school-wide summary visible if the receipt preview fails", () => {
    (useFeePayments as jest.Mock).mockReturnValue({
      payments: [],
      loading: false,
      error: "Offline",
      refetch: jest.fn(),
    });
    (useFeeSummary as jest.Mock).mockReturnValue({
      summary: {
        expectedTotal: 1000000,
        collectedTotal: 500000,
        studentsCount: 10,
        overdueCount: 2,
        highRiskCount: 1,
        defaulters: [],
      },
      loading: false,
      error: null,
    });
    render(<BursarDashboard />);
    const summary = screen.getByRole("region", { name: "Fee summary" });
    expect(summary).toHaveTextContent("School-wide summary");
    expect(summary).toHaveTextContent("UGX 1.0M");
    expect(summary).toHaveTextContent("50%");
    expect(screen.getByRole("progressbar", { name: "Fee collection progress" })).toHaveAttribute("aria-valuenow", "50");
  });

  it("labels fallback estimates and sends fee setup to its real page", () => {
    render(<BursarDashboard />);
    expect(screen.getByText("Loaded-record estimate")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Fee setup needed" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Set fees" })).toHaveAttribute("href", "/dashboard/fee-structure");
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });

  it("answers today, this week and this month from the same receipts", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 15, 12));
    try {
      (useFeePayments as jest.Mock).mockReturnValue({
        payments: [
          { student_id: "s1", amount_paid: 100000, payment_method: "cash", payment_date: "2026-10-15" },
          { student_id: "s2", amount_paid: 50000, payment_method: "mobile_money", payment_date: "2026-10-13" },
          { student_id: "s3", amount_paid: 30000, payment_method: "bank", payment_date: "2026-10-08" },
          { student_id: "s4", amount_paid: 20000, payment_method: "cash", payment_date: "2026-09-30" },
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      render(<BursarDashboard />);
      const daily = screen.getByRole("region", { name: "Collections" });
      expect(daily).toHaveTextContent("UGX 150,000");
      fireEvent.click(within(daily).getByRole("button", { name: "This month" }));
      expect(daily).toHaveTextContent("UGX 180,000");
      fireEvent.click(within(daily).getByRole("button", { name: "Today" }));
      expect(daily).toHaveTextContent("UGX 100,000");
      expect(daily).toHaveTextContent("Cash");
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not claim fees are missing when the fee request failed", () => {
    (useFeeStructure as jest.Mock).mockReturnValue({ feeStructure: [], loading: false, error: "Timed out" });
    render(<BursarDashboard />);
    expect(screen.queryByRole("region", { name: "Fee setup needed" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Some finance records could not be loaded, so these totals are unknown."),
    ).toBeInTheDocument();
  });

  it("shows unknown rather than false zeroes after the initial loading deadline", () => {
    jest.useFakeTimers();
    try {
      (useStudents as jest.Mock).mockReturnValue({ students: [], loading: true, error: null });
      (useFeePayments as jest.Mock).mockReturnValue({ payments: [], loading: true, error: null, refetch: jest.fn() });
      render(<BursarDashboard />);
      act(() => jest.advanceTimersByTime(3000));
      const summary = screen.getByRole("region", { name: "Fee summary" });
      expect(within(summary).getByText("Loading summary…")).toBeInTheDocument();
      expect(summary).not.toHaveTextContent("UGX 0");
    } finally {
      jest.useRealTimers();
    }
  });
});
