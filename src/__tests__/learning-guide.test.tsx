import { fireEvent, render, screen, within } from "@testing-library/react";
import LearningGuide from "@/components/onboarding/LearningGuide";
import { learningLessons, learningStorageKey, learningTracks, readLearningProgress } from "@/lib/learning-guide";

beforeEach(() => localStorage.clear());

describe("role-aware learning content", () => {
  it.each(["headmaster", "admin", "school_admin"])("gives %s the school guide", (role) => {
    expect(learningTracks({ role })).toEqual(["school"]);
  });
  it("does not infer extra jobs from a teacher role", () => {
    expect(learningTracks({ role: "teacher" })).toEqual(["teacher"]);
    expect(learningTracks({ role: "bursar" })).toEqual(["bursar"]);
    expect(learningTracks({ role: "secretary" })).toEqual(["basics"]);
  });
  it("includes separately assigned roles without widening permissions", () => {
    expect(learningTracks({ role: "headmaster", roles: ["headmaster", "teacher", "bursar"] })).toEqual([
      "school",
      "teacher",
      "bursar",
    ]);
  });
  it("keeps lesson storage separate by school, person and role", () => {
    const keys = [
      learningStorageKey("school-1", "user-1", "teacher"),
      learningStorageKey("school-2", "user-1", "teacher"),
      learningStorageKey("school-1", "user-2", "teacher"),
      learningStorageKey("school-1", "user-1", "bursar"),
    ];
    expect(new Set(keys).size).toBe(4);
  });
  it.each([
    null,
    "not json",
    "null",
    "[]",
    '{"step":900,"reviewed":true}',
  ])("recovers from invalid storage: %s", (raw) => {
    expect(readLearningProgress(raw, learningLessons("teacher"))).toEqual({
      lessonId: "phone-basics",
      step: 0,
      reviewed: [],
    });
  });
  it("ignores invented lesson IDs, duplicate completions and invalid steps", () => {
    const result = readLearningProgress(
      JSON.stringify({
        lessonId: "teacher-attendance",
        step: -1,
        reviewed: ["teacher-attendance", "teacher-attendance", "invented", null],
      }),
      learningLessons("teacher"),
    );
    expect(result).toEqual({ lessonId: "teacher-attendance", step: 0, reviewed: ["teacher-attendance"] });
  });
});

describe("learning guide interaction", () => {
  it("resumes the current instruction but never treats moving forward as completion", () => {
    const first = render(<LearningGuide schoolId="school-1" userId="teacher-1" tracks={["teacher"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("heading", { name: "Find your way back" })).toBeInTheDocument();
    expect(screen.getByText("0 of 4 lessons read")).toBeInTheDocument();
    first.unmount();
    render(<LearningGuide schoolId="school-1" userId="teacher-1" tracks={["teacher"]} />);
    expect(screen.getByRole("heading", { name: "Find your way back" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark this lesson as read" }));
    expect(screen.getByText("1 of 4 lessons read")).toBeInTheDocument();
  });
  it("lets a teacher practise absent without opening real records", () => {
    render(<LearningGuide schoolId="school-1" userId="teacher-1" tracks={["teacher"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Mark who came to school/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.click(screen.getByRole("button", { name: /^Absent$/ }));
    expect(screen.getByRole("button", { name: /^Absent$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Your school’s register has not changed/)).toBeInTheDocument();
  });
  it("validates a practice payment and does not store its amount as a school payment", () => {
    render(<LearningGuide schoolId="school-1" userId="bursar-1" tracks={["bursar"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Record a payment correctly/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.click(screen.getByRole("button", { name: "Save practice receipt" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount from 1 to 50,000");
    fireEvent.change(screen.getByLabelText("Amount paid (UGX)"), { target: { value: "20,000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save practice receipt" }));
    expect(screen.getByText(/No real payment was recorded/)).toBeInTheDocument();
    expect(screen.getByText("UGX 30,000")).toBeInTheDocument();
    expect(localStorage.getItem(learningStorageKey("school-1", "bursar-1", "bursar"))).not.toContain("20000");
  });
  it("does not leak completion between a person’s roles", () => {
    render(<LearningGuide schoolId="school-1" userId="user-1" tracks={["teacher", "bursar"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark this lesson as read" }));
    fireEvent.change(screen.getByLabelText("What would you like to learn?"), { target: { value: "bursar" } });
    expect(screen.getByText("0 of 4 lessons read")).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Learning lessons" })).queryByText("Read — tap to repeat"),
    ).not.toBeInTheDocument();
  });
  it("still works when device storage is full or blocked", () => {
    const previousWrite = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error("Quota exceeded");
    });
    try {
      render(<LearningGuide schoolId="school-1" userId="user-1" tracks={["teacher"]} />);
      expect(screen.getByText(/This phone cannot keep your place/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Next step" }));
      expect(screen.getByRole("heading", { name: "Find your way back" })).toBeInTheDocument();
    } finally {
      localStorage.setItem = previousWrite;
    }
  });
});
