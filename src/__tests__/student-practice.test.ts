import type { ExamQuestion } from "@/lib/exam/exam-model";
import { answerKey, isQuestionAnswered, questionNeedsOriginalPage, questionStem } from "@/lib/exam/student-practice";

function makeQuestion(overrides: Partial<ExamQuestion> = {}): ExamQuestion {
  return {
    id: "q-1",
    number: 1,
    kind: "short_answer",
    text: "What is 2 + 2?",
    marks: null,
    choices: [],
    acceptedAnswers: [],
    diagrams: [],
    confidence: 1,
    sourceText: "1. What is 2 + 2?",
    ...overrides,
  };
}

describe("student practice question helpers", () => {
  it("requires every task part to have an answer before marking the question complete", () => {
    const question = makeQuestion({
      subTasks: [
        { label: "a", text: "State one cause." },
        { label: "b", text: "Explain your answer." },
      ],
    });
    expect(answerKey("q-1", "a")).toBe("q-1:a");
    expect(isQuestionAnswered(question, { "q-1:a": "Rain" })).toBe(false);
    expect(isQuestionAnswered(question, { "q-1:a": "Rain", "q-1:b": "It fills the river." })).toBe(true);
  });

  it("flags diagrams, visual references, and table-like measurement data", () => {
    expect(
      questionNeedsOriginalPage(makeQuestion({ diagrams: [{ page: 2, label: "Figure 1", imageDataUri: null }] })),
    ).toBe(true);
    expect(questionNeedsOriginalPage(makeQuestion({ text: "Use the graph below." }))).toBe(true);
    expect(questionNeedsOriginalPage(makeQuestion({ text: "Observation A B Height (cm) 12 18 Weight (kg) 2 3" }))).toBe(
      true,
    );
    expect(questionNeedsOriginalPage(makeQuestion())).toBe(false);
  });

  it("shows a clean stem when parsed sub-prompts are answered separately", () => {
    const question = makeQuestion({
      text: "Task: (a) State one cause. (b) Explain your answer.",
      subTasks: [
        { label: "a", text: "State one cause." },
        { label: "b", text: "Explain your answer." },
      ],
    });
    expect(questionStem(question)).toBe("Answer each part below.");
  });
});
