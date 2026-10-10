import { render, screen, within } from "@testing-library/react";
import { TeacherDashboardContent } from "@/app/dashboard/dashboards/TeacherDashboard";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/components/brand/OwlMascot", () => () => <div data-testid="owl" />);
jest.mock("@/components/dashboard/SchoolCalendar", () => () => <div>School calendar</div>);
jest.mock("@/components/dashboard/SchoolHero", () => () => <div>School hero</div>);
jest.mock("@/components/dashboard/SchoolReadinessGuide", () => ({
  TeacherQuickGuide: () => <div>Teacher quick guide</div>,
}));
jest.mock("@/components/dashboard/TaskManager", () => () => <div>Task manager</div>);
jest.mock("@/components/ErrorBoundary", () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock("@/components/MaterialIcon", () => ({ icon }: { icon: string }) => <span>{icon}</span>);
jest.mock("@/components/Toast", () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("@/components/ui/CollapsibleSection", () => ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
));
jest.mock("@/components/ui/Skeleton", () => ({
  TopLoadingBar: () => <div>Loading bar</div>,
  StuckLoadingOverlay: () => <div>Stuck loading</div>,
}));

jest.mock("@/lib/academic-context", () => ({
  useAcademic: () => ({ academicYear: "2026", currentTerm: "Term 1" }),
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1", name: "King's Academy" },
    user: { id: "user-1", full_name: "Jane Teacher", role: "teacher" },
    isDemo: false,
  }),
}));

jest.mock("@/lib/curriculum", () => ({
  getDefaultSubjects: jest.fn(),
}));

jest.mock("@/lib/hooks", () => ({
  useAllStudents: () => ({ students: [{ id: "s1", class_id: "c1" }], ready: true }),
  useClasses: () => ({ classes: [{ id: "c1", name: "Primary 3" }], loading: false }),
  useDashboardStats: () => ({ stats: { totalStudents: 1, activeStudents: 1, presentToday: 1 }, loading: false }),
  useSubjects: () => ({ subjects: [{ id: "sub1", name: "Mathematics" }], loading: false }),
}));

jest.mock("@/lib/hooks/utils", () => ({
  withTimeout: jest.fn(),
  timeoutFallback: jest.fn(),
  notifyDashboardStatsChanged: jest.fn(),
  getLocalDateString: jest.fn(),
}));

jest.mock("@/lib/roles", () => ({
  isClassScopedRole: () => true,
}));

jest.mock("@/lib/school-setup", () => ({
  buildDefaultClasses: jest.fn(),
  buildDefaultTimetableSlots: jest.fn(),
}));

jest.mock("@/lib/supabase", () => {
  const chainable: Record<string, unknown> = {};
  chainable.select = () => chainable;
  chainable.eq = () => chainable;
  chainable.order = () => chainable;
  chainable.then = (resolve: unknown, reject: unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve as never, reject as never);
  return { supabase: { from: () => chainable } };
});

jest.mock("@/lib/utils", () => ({
  greetingFor: () => "Good morning",
  todayLabelFor: () => "Monday, 10 October",
}));

describe("Teacher dashboard mobile UX", () => {
  it("uses quick action cards and a mobile-friendly section label", () => {
    render(<TeacherDashboardContent />);

    expect(screen.getByRole("heading", { name: /quick actions/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/teacher quick actions/i)).toBeInTheDocument();
    expect(screen.queryByText("Teacher quick guide")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /today overview/i })).not.toBeInTheDocument();
    const todayStatus = screen.getByRole("region", { name: /today status/i });
    expect(within(todayStatus).getByText("Attendance")).toBeInTheDocument();
    expect(within(todayStatus).getByText("Tasks")).toBeInTheDocument();
    expect(within(todayStatus).queryByText("Classes")).not.toBeInTheDocument();
    expect(within(todayStatus).queryByText("Students")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /take attendance/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /record grades/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add class test/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /open timetable/i }).length).toBeGreaterThan(0);
  });
});
