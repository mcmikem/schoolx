import { parsePaper } from "@/lib/exam/parse-paper";
import { rebuildLayout } from "@/lib/exam/pdf-lines";

/**
 * Built from the real failure: an A-level biology scenario paper whose text
 * layer emits one run per table cell and per fragment. The naive extraction
 * (one newline per run) left "1." alone on a line, so no real question was
 * ever recognised, and the paper parsed as 122 phantom questions while the 60
 * real ones sat invisible.
 */

/** The fragmentation pattern of the real paper's page 1, positions symbolic. */
const SHREDDED_PAGE = [
  { str: "CELL BIOLOGY", x: 40, y: 780 },
  { str: "1.", x: 40, y: 750 },
  { str: "Researchers in Mbale District compared lung tissue samples", x: 60, y: 750 },
  { str: "Observation", x: 40, y: 700 },
  { str: "Non-smoker", x: 220, y: 700 },
  { str: "Smoker", x: 320, y: 700 },
  { str: "Elastic fiber content (%)", x: 40, y: 685 },
  { str: "95", x: 220, y: 685 },
  { str: "40", x: 320, y: 685 },
  { str: "Vital capacity (L)", x: 40, y: 655 },
  { str: "4.8", x: 220, y: 655 },
  { str: "2.9", x: 320, y: 655 },
  { str: "Task:", x: 40, y: 620 },
  { str: "(a) Explain how enzyme activity changes contribute to reduced", x: 40, y: 605 },
  { str: "(b) Suggest physiologically supported strategies to prevent damage.", x: 40, y: 590 },
  { str: "2.", x: 40, y: 550 },
  { str: "Medical students at Mulago Hospital examined epithelial samples", x: 60, y: 550 },
  { str: "Task:", x: 40, y: 505 },
  { str: "(a) Explain how structural changes impair its function.", x: 40, y: 490 },
  // A superscript sits slightly higher than its base text.
  { str: "CO", x: 40, y: 470 },
  { str: "2", x: 68, y: 473 },
];

describe("rebuildLayout: shredded text items rejoin into visual lines", () => {
  it("puts the question number back on the same line as its stem", () => {
    const text = rebuildLayout(SHREDDED_PAGE);
    expect(text).toContain("1. Researchers in Mbale District compared lung tissue samples");
    expect(text).toContain("2. Medical students at Mulago Hospital examined epithelial samples");
    // And the number is not stranded ("1.\n...") which the parser cannot read.
    expect(text).not.toMatch(/^1\.$/m);
  });

  it("groups a table row across its cells", () => {
    const text = rebuildLayout(SHREDDED_PAGE);
    expect(text).toContain("Elastic fiber content (%) 95 40");
    expect(text).toContain("Observation Non-smoker Smoker");
  });

  it("keeps decimals intact from separate-numbered papers", () => {
    const text = rebuildLayout(SHREDDED_PAGE);
    expect(text).toContain("4.8 2.9");
  });

  it("drops whitespace-only runs instead of manufacturing empty lines", () => {
    const text = rebuildLayout([...SHREDDED_PAGE, { str: "   ", x: 40, y: 750 }]);
    expect(text.split("\n").filter((l) => l.trim() === "")).toEqual([]);
  });
});

describe("the parsed result of a shredded page", () => {
  const run = () => parsePaper(rebuildLayout(SHREDDED_PAGE), { subject: "Biology" });

  it("finds the real questions, not the table numbers", () => {
    const { paper, warnings } = run();
    expect(paper.questions.map((q) => q.number)).toEqual([1, 2]);
    expect(warnings.filter((w) => w.includes("out of order"))).toEqual([]);
  });

  it("carries the essay tasks in the question, not as choices", () => {
    const { paper } = run();
    for (const q of paper.questions) expect(q.kind).toBe("long_answer");
    expect(paper.questions[0].text).toContain("Suggest physiologically supported strategies");
  });
});
