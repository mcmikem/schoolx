import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import DashboardRouter from "@/app/dashboard/DashboardRouter";

/**
 * Scenario #49 — a broken role must not impersonate a teacher.
 *
 * The demo path cannot reach this: sanitizeDemoRole() coerces an unknown role
 * to "teacher" at the cookie boundary, so the demo harness always shows a real
 * teacher dashboard. Production auth is the only route that carries an
 * unsanitised role, which is why this needs a direct render test.
 */

const mockUseAuth = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: mockRefresh }),
}));

const mockRefresh = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/components/Skeletons", () => ({
  DashboardSkeleton: () => <div data-testid="dashboard-skeleton" />,
}));

jest.mock("@/app/dashboard/dashboards/TeacherDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-teacher" />,
}));
jest.mock("@/app/dashboard/dashboards/HeadmasterDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-headmaster" />,
}));
jest.mock("@/app/dashboard/dashboards/DeanDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-dean" />,
}));
jest.mock("@/app/dashboard/dashboards/BursarDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-bursar" />,
}));
jest.mock("@/app/dashboard/dashboards/SuperAdminDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-superadmin" />,
}));
jest.mock("@/app/dashboard/dashboards/MarketerDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-marketer" />,
}));

const baseAuth = {
  school: { id: "school-1", name: "King's Academy" },
  user: { id: "user-1", full_name: "Jane Teacher", role: "teacher" },
  loading: false,
  authInitialized: true,
  profileDegraded: false,
  signOut: jest.fn().mockResolvedValue(undefined),
};

function setAuth(overrides: Record<string, unknown>) {
  mockUseAuth.mockReturnValue({ ...baseAuth, ...overrides });
}

describe("DashboardRouter — unrecognised role", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuth({});
  });

  it("shows the recovery screen instead of a role dashboard", () => {
    setAuth({
      user: { id: "user-1", full_name: "Revoked User", role: "revoked_role" },
    });

    render(<DashboardRouter />);

    expect(screen.getByRole("heading", { name: /your access needs attention/i })).toBeInTheDocument();
    expect(screen.getByText("revoked_role")).toBeInTheDocument();
  });

  it("does not render teacher content for an unrecognised role", () => {
    setAuth({
      user: { id: "user-1", full_name: "Revoked User", role: "revoked_role" },
    });

    render(<DashboardRouter />);

    // A teacher dashboard greets by name and carries the day/status sections.
    // None of that may appear, or the account is still indistinguishable.
    expect(screen.queryByTestId("dashboard-teacher")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-skeleton")).not.toBeInTheDocument();
  });

  it("treats a revoked class_teacher role as broken, not as a teacher", () => {
    setAuth({
      user: { id: "user-1", full_name: "Class Teacher", role: "class_teacher" },
    });

    render(<DashboardRouter />);

    expect(screen.getByRole("heading", { name: /your access needs attention/i })).toBeInTheDocument();
  });

  it("hands the user both real ways out", () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    setAuth({
      user: { id: "user-1", full_name: "Revoked User", role: "revoked_role" },
      signOut,
    });

    render(<DashboardRouter />);

    const retry = screen.getByRole("button", { name: /check again/i });
    fireEvent.click(retry);
    expect(mockRefresh).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it("still routes a genuine teacher to the teacher dashboard", async () => {
    // Guard against over-correction: the fix must not swallow real teachers.
    setAuth({ user: { id: "user-1", full_name: "Jane Teacher", role: "teacher" } });

    render(<DashboardRouter />);

    expect(await screen.findByTestId("dashboard-teacher")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /your access needs attention/i })).not.toBeInTheDocument();
  });

  it.each([
    ["headmaster", "dashboard-headmaster"],
    ["dean_of_studies", "dashboard-dean"],
    ["bursar", "dashboard-bursar"],
    ["marketer", "dashboard-marketer"],
    ["super_admin", "dashboard-superadmin"],
    ["school_admin", "dashboard-headmaster"],
    ["secretary", null],
    ["dorm_master", null],
  ])("keeps routing %s to its own dashboard", async (role, testId) => {
    setAuth({ user: { id: "user-1", full_name: "Someone", role } });

    render(<DashboardRouter />);

    if (testId) {
      expect(await screen.findByTestId(testId)).toBeInTheDocument();
    } else {
      // secretary/dorm_master render inline inside DashboardRouter, so the
      // assertion is simply that the recovery screen did not appear.
      expect(screen.queryByRole("heading", { name: /your access needs attention/i })).not.toBeInTheDocument();
    }
  });
});
