import { parsePaper } from "@/lib/exam/parse-paper";
import { needsHuman } from "@/lib/exam/exam-model";
import { BIOLOGY_SLICE } from "./fixtures/biology-slice";

describe("parser against a real data-table biology paper", () => {
  const run = () => parsePaper(BIOLOGY_SLICE, { ocr: false, subject: "Biology" });

  it("finds the 3 real questions, not the table decimals", () => {
    const { paper, warnings } = run();
    expect(paper.questions.map((q) => q.number)).toEqual([1, 2, 35]);
    // Every decimal the tables contain used to spawn a phantom question
    // ("4.8" -> question 4 stem "8", "2.9" -> question 2, ...) plus a false
    // out-of-order warning for the pair. The paper has none left.
    expect(warnings.filter((w) => w.includes("out of order"))).toEqual([]);
  });

  it("classifies the tasks as long answer and keeps their sub-parts", () => {
    const { paper } = run();
    for (const q of paper.questions) {
      expect(q.kind).toBe("long_answer");
      // (a)/(b) are sub-tasks of the question, not stray choices, and the
      // roman (i)/(ii) inside (a) belong to (a), not to a fourth question.
      expect(q.text).not.toMatch(/^\s*\(?[ab]\)/);
    }
    expect(paper.questions[2].number).toBe(35);
  });

  it("marks every essay task as needing a teacher", () => {
    const { paper } = run();
    // Nothing in this paper is machine-markable: no options carry a single
    // right answer and no stem asks for a number. All of it goes to a human.
    expect(paper.questions.length).toBe(3);
    expect(needsHuman(paper).length).toBe(3);
  });

  it("never says the same thing twice", () => {
    // Two stub questions with identical bodies each fall below the review
    // line the same way; the report should carry that finding once.
    const stubs = "5. Hello\nfig. 1\n\n6. Hello\nfig. 1\n";
    const { warnings } = parsePaper(stubs, { ocr: true });
    const poorly = warnings.filter((w) => w.startsWith("Question 5 parsed poorly"));
    const duplicated = warnings.filter((w) => w.startsWith("Question 6 parsed poorly"));
    expect(poorly.length).toBe(1);
    expect(duplicated.length).toBe(1);
  });
});
