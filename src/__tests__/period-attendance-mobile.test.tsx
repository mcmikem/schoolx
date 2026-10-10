import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import PeriodAttendancePage from "@/app/dashboard/period-attendance/page";

const mockMarkAttendance = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ school: { id: "school-1" }, user: { id: "teacher-1" } }),
}));
jest.mock("@/lib/hooks", () => ({
  useClasses: () => ({ classes: [{ id: "class-1", name: "Primary 3" }] }),
  usePeriodAttendance: () => ({
    attendance: [],
    students: [{ id: "student-1", first_name: "Amina", last_name: "Nabirye", student_number: "P3-001" }],
    loading: false,
    markAttendance: mockMarkAttendance,
  }),
}));
jest.mock("@/components/Toast", () => {
  const toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
  return { useToast: () => toast };
});
jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("@/lib/hooks/utils", () => ({
  withTimeout: jest.fn((value) => value),
  timeoutFallback: jest.fn(() => ({ error: null })),
}));
jest.mock("@/components/PageErrorBoundary", () => ({
  PageErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/MaterialIcon", () => ({
  __esModule: true,
  default: ({ icon, children }: { icon?: string; children?: React.ReactNode }) => <span>{icon || children}</span>,
}));
jest.mock("@/components/ui/PageHeader", () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
jest.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));
jest.mock("@/components/ui/index", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
jest.mock("@/components/EmptyState", () => ({ EmptyState: () => null }));
jest.mock("@/components/ui/PersonInitials", () => ({
  __esModule: true,
  default: () => <span aria-hidden="true">AN</span>,
}));

describe("Period attendance mobile marking", () => {
  it("selects a class and sends a chosen status through the attendance hook", () => {
    render(<PeriodAttendancePage />);

    fireEvent.change(screen.getByRole("combobox", { name: /select class/i }), {
      target: { value: "class-1" },
    });

    expect(screen.getByText("Amina Nabirye")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Absent" }));

    expect(mockMarkAttendance).toHaveBeenCalledWith("student-1", "absent");
  });
});
