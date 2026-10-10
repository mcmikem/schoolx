import React from "react";
import { render, screen, within } from "@testing-library/react";
import HeadmasterDashboard from "@/app/dashboard/dashboards/HeadmasterDashboard";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1", name: "King's Academy" },
    user: { id: "head-1", full_name: "Sam Head" },
  }),
}));
jest.mock("@/lib/academic-context", () => ({ useAcademic: () => ({ academicYear: "2026", currentTerm: 1 }) }));
jest.mock("@/lib/hooks", () => ({
  useDashboardStats: () => ({
    stats: {
      totalStudents: 20,
      activeStudents: 18,
      maleStudents: 10,
      femaleStudents: 10,
      presentToday: 10,
      feesCollected: 2_500_000,
      feesBalance: 2_500_000,
    },
    loading: false,
  }),
  useAllStudents: () => ({ students: [{ id: "student-1" }], ready: true }),
  useFeeStructure: () => ({ feeStructure: [] }),
  useClasses: () => ({ classes: [{ id: "class-1", class_teacher_id: "teacher-1" }] }),
}));
jest.mock("@/lib/hooks/useDashboardExtraData", () => ({
  useDashboardExtraData: () => ({
    pendingExpenses: 0,
    pendingLeave: 0,
    overdueFeeCount: 3,
    lowAttendanceClasses: 0,
    atRiskStudents: [],
    dropoutRiskCount: 0,
    loading: false,
    timedOut: false,
  }),
}));
jest.mock("@/lib/utils", () => ({
  formatNumber: (value: number) => String(value),
  greetingFor: () => "Good morning",
  todayLabelFor: () => "Saturday, 10 October",
}));
jest.mock("@/components/brand/OwlMascot", () => () => <div />);
jest.mock("@/components/dashboard/SchoolCalendar", () => () => <div>School calendar</div>);
jest.mock("@/components/dashboard/TaskManager", () => () => <div>Task manager</div>);
jest.mock("@/components/dashboard/TeamPreview", () => () => <div>Team preview</div>);
jest.mock("@/components/dashboard/UpNextCard", () => ({ task }: any) => <div>{task?.label || "All caught up"}</div>);
jest.mock("@/components/ErrorBoundary", () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock("@/components/MaterialIcon", () => ({ icon }: { icon: string }) => <span>{icon}</span>);
jest.mock("@/components/onboarding/SetupChecklist", () => () => null);
jest.mock("@/components/ui/CollapsibleSection", () => ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
));
jest.mock("@/components/ui/Skeleton", () => ({ TopLoadingBar: () => null, StuckLoadingOverlay: () => null }));
jest.mock("@/components/dashboard/StatCard", () => ({
  __esModule: true,
  default: ({ label, value, subValue }: { label: string; value: string; subValue?: string }) => (
    <div data-testid={`stat-${label}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subValue && <small>{subValue}</small>}
    </div>
  ),
}));

describe("Headmaster dashboard metrics", () => {
  it("shows the collected fee amount and its collection rate as separate information", () => {
    render(<HeadmasterDashboard />);

    const feeCard = screen.getByTestId("stat-Fees collected");
    expect(within(feeCard).getByText(/UGX/)).toBeInTheDocument();
    expect(feeCard).toHaveTextContent(/50% of expected/);
    expect(feeCard).toHaveTextContent(/3 overdue/);

    const commonActions = screen.getByRole("navigation", { name: /headmaster common actions/i });
    expect(within(commonActions).getByRole("link", { name: /add student/i })).toBeInTheDocument();
  });
});
