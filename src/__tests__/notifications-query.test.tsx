import { render, screen, waitFor } from "@testing-library/react";
import { NotificationsProvider, useNotifications } from "@/lib/notifications";

const mockSelect = jest.fn();
const mockEqual = jest.fn();
const mockIn = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();
let mockRole = "headmaster";
let mockDemo = false;
let mockAttendance = { data: null, error: null, count: 350, status: 200 };

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ school: { id: "school-1" }, user: { id: "user-1", role: mockRole }, isDemo: mockDemo }),
}));
jest.mock("@/lib/academic-context", () => ({
  useAcademic: () => ({ academicYear: "2026", currentTerm: 3 }),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args), rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("@/lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/lib/hooks/utils", () => ({
  ...jest.requireActual("@/lib/hooks/utils"),
  withTimeout: async (query: PromiseLike<unknown>) => await query,
}));

function Feed() {
  const { notifications, loading } = useNotifications();
  return (
    <div>
      {loading ? "Loading" : "Loaded"}
      {notifications.map((notification) => (
        <p key={notification.id}>{notification.title}</p>
      ))}
    </div>
  );
}

describe("school notification queries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockRole = "headmaster";
    mockDemo = false;
    mockAttendance = { data: null, error: null, count: 350, status: 200 };
    const chain = {
      select: mockSelect,
      eq: mockEqual,
      in: mockIn,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(mockAttendance).then(resolve),
    };
    mockSelect.mockReturnValue(chain);
    mockEqual.mockReturnValue(chain);
    mockIn.mockReturnValue(chain);
    mockFrom.mockReturnValue(chain);
    mockRpc.mockReturnValue({
      maybeSingle: () =>
        Promise.resolve({
          data: { expected_total: 100000, collected_total: 50000, overdue_balance: 25000 },
          error: null,
        }),
    });
  });

  it("counts absences through a school join without an unbounded student-ID filter", async () => {
    render(
      <NotificationsProvider>
        <Feed />
      </NotificationsProvider>,
    );
    await screen.findByText("350 students absent today");
    expect(mockFrom).toHaveBeenCalledWith("attendance");
    expect(mockFrom).not.toHaveBeenCalledWith("students");
    expect(mockSelect).toHaveBeenCalledWith("student_id, students!inner(school_id)", { count: "exact", head: true });
    expect(mockEqual).toHaveBeenCalledWith("students.school_id", "school-1");
    expect(mockIn).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("fee_summary", {
      p_school_id: "school-1",
      p_term: 3,
      p_academic_year: "2026",
    });
    await screen.findByText("UGX 25,000 outstanding fees");
  });

  it("does not fetch or display financial alerts for teachers", async () => {
    mockRole = "teacher";
    render(
      <NotificationsProvider>
        <Feed />
      </NotificationsProvider>,
    );
    await screen.findByText("350 students absent today");
    expect(mockRpc).not.toHaveBeenCalled();
    expect(screen.queryByText(/outstanding fees/)).not.toBeInTheDocument();
  });

  it("keeps demo notifications off the live database", async () => {
    mockDemo = true;
    render(
      <NotificationsProvider>
        <Feed />
      </NotificationsProvider>,
    );
    await screen.findByText("Welcome to SkoolMate OS!");
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("does not announce a zero absence count when the query times out", async () => {
    mockAttendance = { data: null, error: null, count: 0, status: 408 };
    render(
      <NotificationsProvider>
        <Feed />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(screen.getByText("Loaded")).toBeInTheDocument());
    expect(screen.queryByText(/students absent today/)).not.toBeInTheDocument();
  });
});
