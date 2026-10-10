import React from "react";
import { render, screen } from "@testing-library/react";
import GradesPage from "@/app/dashboard/grades/page";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1", name: "King's Academy" },
    user: { id: "user-1", full_name: "Jane Teacher", role: "teacher" },
    isDemo: false,
  }),
}));

jest.mock("@/lib/academic-context", () => ({
  useAcademic: () => ({ academicYear: "2026", currentTerm: 1 }),
}));

jest.mock("@/lib/hooks", () => ({
  useClasses: () => ({
    classes: [{ id: "class-1", name: "Primary 3", stream: "A", level: "Primary" }],
    loading: false,
  }),
  useSubjects: () => ({ subjects: [{ id: "subject-1", name: "Mathematics" }], loading: false }),
  useStaff: () => ({ staff: [] }),
}));

jest.mock("@/lib/offline-hooks", () => ({
  useOfflineStudents: () => ({ data: [], loading: false, error: null }),
  useOfflineGrades: () => ({ data: [], loading: false, error: null }),
}));

jest.mock("@/components/Toast", () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() }),
}));

jest.mock("@/lib/offline", () => ({
  useOnlineStatus: () => true,
  offlineDB: { save: jest.fn(), cacheFromServer: jest.fn(), getPendingSync: jest.fn() },
}));

jest.mock("@/components/MaterialIcon", () => ({
  __esModule: true,
  default: ({ icon }: { icon: string }) => <span>{icon}</span>,
}));

jest.mock("@/components/ui/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
  PageSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/Tabs", () => ({
  Tabs: ({ tabs }: { tabs: { id: string; label: string }[] }) => (
    <div>
      {tabs.map((tab) => (
        <div key={tab.id}>{tab.label}</div>
      ))}
    </div>
  ),
  TabPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/Modal", () => ({
  Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div>{children}</div> : null,
  ModalFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/Card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/index", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Input: (props: any) => <input {...props} />,
  Select: (props: any) => <select {...props} />,
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe("Grades page mobile summary", () => {
  it("shows a quick grade summary card for mobile-friendly teacher workflow", () => {
    render(<GradesPage />);

    expect(screen.getByLabelText(/grades overview/i)).toBeInTheDocument();
    expect(screen.getByText(/selected class/i)).toBeInTheDocument();
    expect(screen.getByText(/selected subject/i)).toBeInTheDocument();
    expect(screen.getByText(/graded/i)).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });
});
