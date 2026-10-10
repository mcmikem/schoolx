import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import HomeworkSubmissionsPage from "@/app/dashboard/homework-submissions/page";

jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ school: { id: "school-1" } }) }));
jest.mock("@/lib/academic-context", () => ({
  useAcademic: () => ({ academicYear: "2026", currentTerm: 1 }),
}));
jest.mock("@/lib/offline-hooks", () => ({
  useOfflineClasses: () => ({ data: [{ id: "class-1", name: "Primary 3" }], loading: false }),
  useOfflineHomework: () => ({
    data: [
      {
        id: "homework-1",
        class_id: "class-1",
        due_date: "2026-10-12",
        marks: 10,
        subjects: { name: "Mathematics" },
        classes: { name: "Primary 3" },
      },
    ],
    loading: false,
    refetch: jest.fn(),
  }),
  useOfflineHomeworkSubmissions: () => ({
    data: [
      {
        id: "submission-1",
        student_id: "student-1",
        submitted_at: "2026-10-10T10:00:00.000Z",
        marks_obtained: 8,
        status: "graded",
      },
    ],
    loading: false,
    refetch: jest.fn(),
  }),
  useOfflineClassStudentsFull: () => ({
    data: [{ id: "student-1", first_name: "Amina", last_name: "Nabirye" }],
    loading: false,
  }),
}));
jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("@/components/Toast", () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() }),
}));
jest.mock("@/components/PageErrorBoundary", () => ({
  PageErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/MaterialIcon", () => ({
  __esModule: true,
  default: ({ icon, children }: { icon?: string; children?: React.ReactNode }) => <span>{icon || children}</span>,
}));
jest.mock("@/components/ui/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));
jest.mock("@/components/ui/index", () => ({
  Button: ({ children, onClick, type }: any) => (
    <button type={type || "button"} onClick={onClick}>
      {children}
    </button>
  ),
}));

describe("Homework submissions mobile review", () => {
  it("selects an assignment and shows graded work in the compact status overview", () => {
    render(<HomeworkSubmissionsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Mathematics/ }));

    const overview = screen.getByLabelText(/submission overview/i);
    expect(within(overview).getByText("1")).toBeInTheDocument();
    expect(screen.getAllByText("Amina Nabirye").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /change homework/i })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Grade" })[0]);
    expect(screen.getByLabelText("Marks (out of 10)")).toBeInTheDocument();
    expect(screen.getByLabelText("Feedback")).toBeInTheDocument();
  });
});
