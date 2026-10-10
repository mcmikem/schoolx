import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import HomeworkPage from "@/app/dashboard/homework/page";

const mockHomeworkData: Record<string, unknown>[] = [];
let mockHomeworkError: Error | null = null;
let mockHomeworkPending = false;

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1", name: "King's Academy" },
    user: { id: "teacher-1", full_name: "Jane Teacher", role: "teacher" },
  }),
}));

jest.mock("@/lib/academic-context", () => ({
  useAcademic: () => ({ academicYear: "2026", currentTerm: 1 }),
}));

jest.mock("@/lib/hooks", () => ({
  useClasses: () => ({ classes: [{ id: "class-1", name: "Primary 3", stream: "A" }] }),
  useSubjects: () => ({ subjects: [{ id: "subject-1", name: "Mathematics" }] }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest
        .fn()
        .mockImplementation(() =>
          mockHomeworkPending
            ? new Promise(() => {})
            : Promise.resolve({ data: mockHomeworkData, error: mockHomeworkError }),
        ),
      insert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockReturnThis(),
    })),
  },
}));

jest.mock("@/lib/useAutoSave", () => ({
  useFormDraft: () => ({
    updateData: jest.fn(),
    clearSaved: jest.fn(),
    showRestoreDialog: false,
    savedDraft: null,
    discardDraft: jest.fn(),
    restoreDraft: jest.fn(),
  }),
}));

jest.mock("@/components/Toast", () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() }),
}));

jest.mock("@/components/ui/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

jest.mock("@/components/ui/Card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/MaterialIcon", () => ({
  __esModule: true,
  default: ({ icon }: { icon: string }) => <span>{icon}</span>,
}));

describe("Homework page mobile summary", () => {
  afterEach(() => {
    jest.useRealTimers();
    mockHomeworkData.length = 0;
    mockHomeworkError = null;
    mockHomeworkPending = false;
  });

  it("shows a compact class test overview card for teacher workflows", async () => {
    render(<HomeworkPage />);

    await waitFor(() => {
      expect(screen.getByText(/quick class test summary/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/class tests overview/i)).toBeInTheDocument();
    });
  });

  it("marks required class test fields in the assignment form", () => {
    render(<HomeworkPage />);
    fireEvent.click(screen.getByRole("button", { name: /add class test/i }));

    expect(screen.getByLabelText("Title *")).toBeRequired();
    expect(screen.getByLabelText("Description *")).toBeRequired();
    expect(screen.getByLabelText("Class *")).toBeRequired();
    expect(screen.getByLabelText("Subject *")).toBeRequired();
    expect(screen.getByLabelText("Due Date *")).toBeRequired();
  });

  it("keeps date-only homework due today active for the full local day", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 10, 12));
    mockHomeworkData.push({
      id: "homework-today",
      title: "Fractions practice",
      description: "Complete the exercises",
      subject_id: "subject-1",
      class_id: "class-1",
      due_date: "2026-10-10",
      marks: 10,
      status: "active",
      created_by: "teacher-1",
      created_at: "2026-10-01T00:00:00.000Z",
      subjects: { name: "Mathematics", code: "MTH" },
      classes: { name: "Primary 3" },
    });

    await act(async () => {
      render(<HomeworkPage />);
    });

    expect(screen.getByText("Due today")).toBeInTheDocument();
    const overview = screen.getByLabelText(/class tests overview/i);
    expect(within(overview).getByText("Due soon")).toBeInTheDocument();
    expect(overview).toHaveTextContent(/Due soon\s*1/);
    expect(overview).toHaveTextContent(/Overdue\s*0/);
  });

  it("shows a retry state instead of claiming there are no class tests when loading fails", async () => {
    mockHomeworkError = new Error("network unavailable");
    render(<HomeworkPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/class tests unavailable/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/no class tests/i)).not.toBeInTheDocument();
  });

  it("shows visible, announced placeholders while class tests are loading", () => {
    mockHomeworkPending = true;
    const { container } = render(<HomeworkPage />);

    const loadingState = screen.getByRole("status", { name: /loading class tests/i });
    expect(loadingState.querySelectorAll(".animate-pulse")).toHaveLength(12);
    expect(container.querySelector(".skeleton")).not.toBeInTheDocument();
  });
});
