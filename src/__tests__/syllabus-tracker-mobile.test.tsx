import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import SyllabusTrackerPage from "@/app/dashboard/syllabus-tracker/page";

jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ school: { id: "school-1" }, user: { id: "teacher-1" } }) }));
jest.mock("@/lib/academic-context", () => ({ useAcademic: () => ({ academicYear: "2026", currentTerm: 1 }) }));
jest.mock("@/lib/hooks", () => ({
  useClasses: () => ({ classes: [{ id: "class-1", name: "Primary 3" }] }),
  useSubjects: () => ({ subjects: [{ id: "subject-1", name: "Mathematics" }] }),
}));
jest.mock("@/lib/hooks/useSyllabusPlanner", () => ({
  useSyllabusTracker: () => ({
    syllabi: [
      {
        id: "topic-1",
        topic: "Geometry",
        subtopics: [],
        objectives: "",
        weeks_covered: null,
        resources: null,
        status: "in_progress",
        completed_date: null,
        notes: null,
        completion_percentage: 50,
        lessons_planned: 2,
        lessons_completed: 1,
        student_comprehension_rating: null,
        teacher_notes: null,
        challenges: null,
        week_number: 2,
        progress: { overall_percentage: 50, weeks_completed: 2, weeks_total: 4, on_track: true },
        timeline: [],
      },
    ],
    loading: false,
    refetch: jest.fn(),
  }),
  useTopicPerformance: () => ({ performance: [], loading: false }),
  useAutoPlannerConfig: () => ({ config: { enable_ai_generation: false }, updateConfig: jest.fn() }),
  useLessonPlanGeneration: () => ({ generating: false, generateLessonPlans: jest.fn() }),
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
  default: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
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
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));
jest.mock("@/components/ui/index", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
jest.mock("@/components/syllabus/SyllabusTimelineView", () => ({
  __esModule: true,
  default: ({ syllabus, viewMode }: { syllabus: { topic: string }; viewMode: string }) => (
    <div>
      <span>{syllabus.topic}</span>
      <span>{viewMode} mode</span>
    </div>
  ),
}));
jest.mock("@/components/syllabus/TopicPerformanceCard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/syllabus/AutoPlannerPanel", () => ({ __esModule: true, default: () => null }));

describe("Syllabus tracker mobile controls", () => {
  it("summarizes progress and exposes usable view and tab controls", () => {
    render(<SyllabusTrackerPage />);

    const overview = screen.getByLabelText(/syllabus overview/i);
    expect(within(overview).getByText("Topics")).toBeInTheDocument();
    expect(within(overview).getByText("In progress")).toBeInTheDocument();
    expect(overview).toHaveTextContent(/50\s*%/);
    expect(screen.getByText("Geometry")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /list view/i }));
    expect(screen.getByText("list mode")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /topic performance/i }));
    expect(screen.getByText(/no performance data yet/i)).toBeInTheDocument();
  });
});
