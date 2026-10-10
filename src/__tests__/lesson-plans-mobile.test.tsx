import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import LessonPlansPage from "@/app/dashboard/lesson-plans/page";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1" },
    user: { id: "teacher-1" },
  }),
}));

jest.mock("@/lib/academic-context", () => ({
  useAcademic: () => ({ academicYear: "2026", currentTerm: 1 }),
}));

jest.mock("@/lib/hooks", () => ({
  useClasses: () => ({ classes: [{ id: "class-1", name: "Primary 3" }] }),
  useSubjects: () => ({ subjects: [{ id: "subject-1", name: "Mathematics" }] }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => {
      const query: Record<string, jest.Mock> = {};
      query.select = jest.fn(() => query);
      query.eq = jest.fn(() => query);
      query.order = jest.fn(() => query);
      query.limit = jest.fn().mockResolvedValue({ data: [], error: null });
      return query;
    }),
  },
}));

jest.mock("@/components/Toast", () => {
  const toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
  return { useToast: () => toast };
});

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
  Card: ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
    <div className={className} onClick={onClick}>
      {children}
    </div>
  ),
}));
jest.mock("@/components/ui/index", () => ({
  Button: ({ children, onClick, type, disabled }: any) => (
    <button type={type || "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
jest.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));

describe("Lesson plans mobile layout", () => {
  it("shows the current-term overview and opens the lesson editor", async () => {
    render(<LessonPlansPage />);

    expect(await screen.findByLabelText(/lesson plan overview/i)).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new lesson plan/i }));

    expect(screen.getByRole("heading", { name: /new lesson plan/i })).toBeInTheDocument();
    expect(screen.getByText("Class *")).toBeInTheDocument();
    expect(screen.getByLabelText("Topic *")).toBeRequired();
  });
});
