import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import TimetablePage from "@/app/dashboard/timetable/page";

// Mutable so each test can pick the role it needs. Editing a timetable is
// gated to admin/dean/headmaster: `teacher_timetable` had `FOR ALL` RLS for any
// authenticated user in the school, so a teacher could otherwise rewrite the
// whole timetable from the "+ Add lesson" cells.
let mockRole = "headmaster";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1" },
    user: { id: "user-1", role: mockRole },
    isDemo: true,
  }),
}));

jest.mock("@/lib/hooks", () => ({
  useClasses: () => ({ classes: [{ id: "class-1", name: "Primary 3" }] }),
  useSubjects: () => ({ subjects: [{ id: "subject-1", name: "Mathematics" }] }),
  useTimetableManager: () => ({
    slots: [
      { id: "period-1", name: "Period 1", start_time: "08:00", end_time: "08:40", order_number: 1, is_lesson: true },
      { id: "break-1", name: "Break", start_time: "08:40", end_time: "09:00", order_number: 2, is_break: true },
    ],
    loading: false,
  }),
  useStaff: () => ({ staff: [] }),
}));

jest.mock("@/components/Toast", () => {
  const toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
  return { useToast: () => toast };
});

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("@/components/PageErrorBoundary", () => ({
  PageErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/MaterialIcon", () => ({
  __esModule: true,
  default: ({ icon }: { icon: string }) => <span>{icon}</span>,
}));
jest.mock("@/components/ui/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock("@/components/ui/Tabs", () => ({
  Tabs: ({ tabs, onChange }: { tabs: { id: string; label: string }[]; onChange: (id: string) => void }) => (
    <div>
      {tabs.map((tab) => (
        <button key={tab.id} type="button" onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
  TabPanel: ({ activeTab, tabId, children }: { activeTab: string; tabId: string; children: React.ReactNode }) =>
    activeTab === tabId ? <div>{children}</div> : null,
}));
jest.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));
jest.mock("@/components/ui/index", () => ({
  Button: ({
    children,
    onClick,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
  }) => (
    <button type={type || "button"} onClick={onClick}>
      {children}
    </button>
  ),
}));
jest.mock("@/components/ui/Skeleton", () => ({ TableSkeleton: () => <div>Loading</div> }));
jest.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
jest.mock("@/components/timetable/GenerateTimetableModal", () => () => null);

describe("Timetable mobile agenda", () => {
  beforeEach(() => {
    mockRole = "headmaster";
  });

  it("shows the selected class overview and opens the assignment form from an open period", () => {
    render(<TimetablePage />);

    // The agenda now opens on today's weekday rather than always Monday, so
    // pick the day explicitly instead of assuming the default. Otherwise this
    // assertion passes on Mondays only. Tabs is mocked to plain buttons here,
    // hence the button role rather than tab.
    fireEvent.click(screen.getByRole("button", { name: "Monday" }));

    expect(screen.getByLabelText(/timetable overview/i)).toHaveTextContent("Primary 3");
    expect(screen.getByLabelText(/timetable overview/i)).toHaveTextContent("Monday");

    fireEvent.click(screen.getByRole("button", { name: /add lesson/i }));

    expect(screen.getByRole("heading", { name: /assign lesson/i })).toBeInTheDocument();
    expect(screen.getByText(/Monday · Period 1/)).toBeInTheDocument();
  });

  // Pins the privilege-escalation fix in 63100745. Without this the gate can
  // silently drop back to showing teachers a school-wide structural control.
  it.each([
    "teacher",
    "secretary",
    "bursar",
    "dorm_master",
  ])("does not offer the add-lesson control to a non-timetable-admin role: %s", (role) => {
    mockRole = role;
    render(<TimetablePage />);

    expect(screen.queryByRole("button", { name: /add lesson/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove /i })).not.toBeInTheDocument();
  });

  it.each([
    "headmaster",
    "school_admin",
    "dean_of_studies",
  ])("keeps the add-lesson control for timetable admin roles: %s", (role) => {
    mockRole = role;
    render(<TimetablePage />);

    expect(screen.getByRole("button", { name: /add lesson/i })).toBeInTheDocument();
  });
});
