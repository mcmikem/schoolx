import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import StudentPractice from "@/app/student-portal/StudentPractice";

const mockInsert = jest.fn();
const mockCreateSignedUrl = jest.fn();
const mockPdfViewer = jest.fn(({ initialPage }: { initialPage: number }) => <div>Source page {initialPage}</div>);

const mockPaper = {
  id: "paper-1",
  name: "P.6 Science practice",
  exam_date: "2026-10-30",
  max_score: 10,
  paper_model: {
    id: "model-1",
    title: "Science practice",
    classLevel: "P.6",
    subject: "Science",
    year: 2026,
    term: "3",
    totalMarks: 10,
    ocrApplied: false,
    assignment: { published: true, due_date: "2026-10-30", source_path: "school/paper.pdf" },
    questions: [
      {
        id: "q1",
        number: 1,
        kind: "multiple_choice",
        text: "Use the graph below. Which plant grew tallest?",
        marks: 2,
        choices: [
          { label: "A", text: "Plant A" },
          { label: "B", text: "Plant B" },
        ],
        acceptedAnswers: [],
        diagrams: [],
        confidence: 1,
        sourceText: "Use the graph below.",
        sourcePages: [2],
      },
      {
        id: "q2",
        number: 2,
        kind: "short_answer",
        text: "Name one source of clean water.",
        marks: 1,
        choices: [],
        acceptedAnswers: [],
        diagrams: [],
        confidence: 1,
        sourceText: "Name one source of clean water.",
        sourcePages: [3],
      },
    ],
  },
};

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(() => Promise.resolve({ data: table === "exams" ? [mockPaper] : [], error: null })),
      in: jest.fn(() => Promise.resolve({ data: [], error: null })),
      insert: (...args: unknown[]) => mockInsert(...args),
    }),
    storage: {
      from: () => ({ createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args) }),
    },
  },
}));

jest.mock("@/components/exam/PdfSourceViewer", () => ({
  __esModule: true,
  default: (props: { initialPage: number }) => mockPdfViewer(props),
}));

describe("student practice flow", () => {
  beforeEach(() => {
    localStorage.clear();
    mockInsert.mockReset().mockResolvedValue({ error: null });
    mockCreateSignedUrl
      .mockReset()
      .mockResolvedValue({ data: { signedUrl: "https://example.test/paper.pdf" }, error: null });
    mockPdfViewer.mockClear();
  });

  it("shows the relevant original page, saves answers, reviews, and hands in only after confirmation", async () => {
    render(<StudentPractice schoolId="school-1" classId="class-1" studentId="student-1" isDemo={false} />);

    fireEvent.click(await screen.findByRole("button", { name: /start paper/i }));
    expect(await screen.findByText("Question 1 of 2")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "View original page 2" }));
    expect(await screen.findByText("Source page 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /B.*Plant B/ }));
    fireEvent.click(screen.getByRole("button", { name: /next question/i }));
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "A protected spring" } });
    await waitFor(() =>
      expect(localStorage.getItem("skoolmate-exam-draft-student-1-paper-1")).toContain("A protected spring"),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /review answers/i }).at(-1)!);
    const review = screen.getByText("Check your answers").closest("section");
    expect(review).toHaveTextContent("0 questions still unanswered");
    expect(within(review as HTMLElement).getAllByText("Answer saved")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /hand in paper/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("You have answered every question");
    expect(mockInsert).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Yes, hand in" }));

    await waitFor(() =>
      expect(mockInsert).toHaveBeenCalledWith({
        school_id: "school-1",
        exam_id: "paper-1",
        student_id: "student-1",
        answers: { q1: "B", q2: "A protected spring" },
      }),
    );
    expect(await screen.findByText("Paper handed in")).toBeInTheDocument();
    expect(localStorage.getItem("skoolmate-exam-draft-student-1-paper-1")).toBeNull();
  }, 15000);
});
