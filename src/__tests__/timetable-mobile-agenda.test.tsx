import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import TimetablePage from "@/app/dashboard/timetable/page";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1" },
    user: { id: "teacher-1", role: "teacher" },
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
  it("shows the selected class overview and opens the assignment form from an open period", () => {
    render(<TimetablePage />);

    expect(screen.getByLabelText(/timetable overview/i)).toHaveTextContent("Primary 3");
    expect(screen.getByLabelText(/timetable overview/i)).toHaveTextContent("Monday");

    fireEvent.click(screen.getByRole("button", { name: /add lesson/i }));

    expect(screen.getByRole("heading", { name: /assign lesson/i })).toBeInTheDocument();
    expect(screen.getByText(/Monday · Period 1/)).toBeInTheDocument();
  });
});
