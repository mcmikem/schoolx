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
    // Two stub questions fall below the review line the same way; whatever
    // findings the parser emits, a finding must reach the report once, not
    // once per stub. Calibration-dependent fixtures would rot as penalties
    // are tuned, so the fixture is minimal and the assertion is universal.
    const stubs = "5. Hello\nfig. 1\n\n6. Hello\nfig. 1\n";
    const { warnings } = parsePaper(stubs, { ocr: true });
    expect(new Set(warnings).size).toBe(warnings.length);
  });

  it("opens a question whose number is printed alone on its line", () => {
    // The real paper's questions 35 and 57 print "NN." with the body on the
    // next visual line, because the typesetter broke the text runs. Requiring
    // the stem to share the line left those questions invisible.
    const { paper } = parsePaper(
      "34. Normal question text with a full stem before it.\n" +
        "35.\n" +
        "years, releasing untreated smoke and wastewater into the surrounding community.\n" +
        "Task:\n" +
        "(a) Propose sustainable strategies to reduce cancer risk.\n",
      { subject: "Biology" },
    );
    const q35 = paper.questions.find((q) => q.number === 35);
    expect(q35).toBeDefined();
    expect(q35!.text).toContain("untreated smoke and wastewater");
    expect(q35!.kind).toBe("long_answer");
  });

  it("keeps Task and sub-prompt on the same visual line as one essay", () => {
    // Layout reconstruction can join "Task:" with the first sub-prompt when
    // they sit close together. The merged line must still open a task run, or
    // the later (b) is read as the first option of a two-choice quiz.
    const { paper } = parsePaper(
      "2. Medical students at Mulago Hospital examined epithelial samples from\n" +
        "residents living near a polluted zone.\n" +
        "Task: (a) Explain how enzyme activity changes impair lung function.\n" +
        "(b) Suggest physiologically supported strategies to prevent such damage.\n",
      { subject: "Biology" },
    );
    expect(paper.questions.length).toBe(1);
    const q = paper.questions[0];
    expect(q.kind).toBe("long_answer");
    expect(q.choices.length).toBe(0);
    expect(q.text).toContain("(a) Explain how enzyme activity changes impair lung function.");
  });

  it("reads lettered table rows as table geometry, not as multiple-choice options", () => {
    // Data-table questions label their rows A/B/C -- site A, site B. Those
    // labels sat before the Task block and were being collected as an option
    // run, which reclassified seven questions of the real paper as quiz items.
    const { paper } = parsePaper(
      "50. A community near River Katonga reported poor maize yields. Samples of\n" +
        "irrigation water and soil were collected from three farms.\n" +
        "Site Water Source Dissolved Oxygen (mg/L) Germination Rate (%)\n" +
        "A Forest stream 8.5 92\n" +
        "B Factory outlet 3.2 48\n" +
        "C Wetland outlet 5.1 70\n" +
        "Task:\n" +
        "(a) Analyse how water quality parameters affect germination.\n" +
        "(b) Suggest community-based strategies to ensure clean irrigation water.\n",
      { subject: "Biology" },
    );
    expect(paper.questions.length).toBe(1);
    const q = paper.questions[0];
    expect(q.kind).toBe("long_answer");
    expect(q.choices.length).toBe(0);
    // The rows still belong to the question, as data.
    expect(q.text).toContain("A Forest stream 8.5 92");
  });
});
