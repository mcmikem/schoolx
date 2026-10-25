import { parsePaper } from "@/lib/exam/parse-paper";
import { rebuildLayout } from "@/lib/exam/pdf-lines";
import { renderPaperForm } from "@/lib/exam/render-form";

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
  { str: "Reference: Original biology report", x: 40, y: 640 },
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
    expect(text).toContain("Elastic fiber content (%)\t95\t40");
    expect(text).toContain("Observation\tNon-smoker\tSmoker");
  });

  it("keeps decimals intact from separate-numbered papers", () => {
    const text = rebuildLayout(SHREDDED_PAGE);
    expect(text).toContain("4.8\t2.9");
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
    expect(paper.questions[0].text).not.toContain("Suggest physiologically supported strategies");
    expect(paper.questions[0].subTasks?.map((part) => part.text)).toEqual([
      "Explain how enzyme activity changes contribute to reduced",
      "Suggest physiologically supported strategies to prevent damage.",
    ]);
  });

  it("preserves table rows and cells as structured data, not stem prose", () => {
    const question = run().paper.questions[0];
    expect(question.tables?.[0].rows).toEqual([
      ["Observation", "Non-smoker", "Smoker"],
      ["Elastic fiber content (%)", "95", "40"],
      ["Vital capacity (L)", "4.8", "2.9"],
    ]);
    expect(question.text).not.toContain("Elastic fiber content");
    expect(question.text).toContain("Reference: Original biology report");
    expect(question.contentBlocks?.map((block) => block.type)).toEqual(["text", "table", "text"]);
  });

  it("renders reconstructed tables as accessible HTML tables", () => {
    const form = renderPaperForm(run().paper);
    expect(form).toContain('<table class="q__table"');
    expect(form).toContain("<th>Observation</th>");
    expect(form).toContain("<td>95</td>");
    expect(form.indexOf('<table class="q__table"')).toBeLessThan(form.indexOf("Reference: Original biology report"));
  });
});

describe("scan skew and prose misread as a table", () => {
  it("deskews a tilted scan before grouping words into lines", () => {
    // A one-degree tilt is enough for a word at the right margin to sit a line
    // above its neighbours. Grouping on raw y then interleaves two sentences,
    // which used to turn every paragraph into a ragged pseudo-table.
    const slope = Math.tan((1 * Math.PI) / 180);
    const line = (text: string, y: number, x: number) =>
      text.split(" ").map((word, index) => ({
        str: word,
        x: x + index * 45,
        y: y - (x + index * 45) * slope,
        width: 38,
        height: 10,
      }));
    const items = [
      ...line("During the UPDF pass-out ceremony the army band performed", 700, 40),
      ...line("using a variety of musical instruments in the parade", 686, 40),
    ];

    const text = rebuildLayout(items);
    expect(text).toContain("During the UPDF pass-out ceremony the army band performed");
    expect(text).toContain("using a variety of musical instruments in the parade");
    expect(text).not.toMatch(/ceremony\s+using/);
  });

  it("keeps columned prose as text when the run has no grid", () => {
    const { paper } = parsePaper(
      [
        "1. A space science lesson sparked a discussion.",
        "and they became eager to learn\tmore. As",
        "they conducted further\tresearch using textbooks",
        "and the internet,\tthey came across images.",
      ].join("\n"),
    );
    const question = paper.questions[0];
    expect(question.tables).toBeUndefined();
    expect(question.text).toContain("and they became eager to learn more");
  });

  it("pairs each figure reference with its own crop", () => {
    const { paper } = parsePaper("1. Compare figure 1 and figure 2 below.", {
      pageImages: { 1: "data:image/jpeg;base64,page" },
      diagramCrops: [
        { page: 1, label: "figure 1 on page 1", imageDataUri: "data:image/jpeg;base64,crop1" },
        { page: 1, label: "figure 2 on page 1", imageDataUri: "data:image/jpeg;base64,crop2" },
      ],
    });
    expect(paper.questions[0].diagrams.map((diagram) => diagram.label)).toEqual([
      "figure 1 on page 1",
      "figure 2 on page 1",
    ]);
    expect(paper.questions[0].diagrams.map((diagram) => diagram.imageKind)).toEqual(["crop", "crop"]);
    expect(paper.questions[0].diagrams.map((diagram) => diagram.imageDataUri)).toEqual([
      "data:image/jpeg;base64,crop1",
      "data:image/jpeg;base64,crop2",
    ]);
  });
});

describe("figure cropping", () => {
  const word = (text: string, x: number, y: number, width = 40, height = 10) => ({
    text,
    x0: x,
    y0: y,
    x1: x + width,
    y1: y + height,
  });

  it("keeps a diagram's own table inside the crop and stops at the paragraph", () => {
    const { findFigureCropRegions } = require("@/lib/exam/pdf-text") as typeof import("@/lib/exam/pdf-text");
    const words = [
      word("used", 40, 100),
      word("is", 100, 100),
      word("shown", 140, 100),
      word("below.", 220, 100),
      word("Primary", 300, 180),
      word("Secondary", 600, 180),
      word("Number", 300, 220),
      word("turns", 380, 220),
      word("=", 440, 220),
      word("2000", 470, 220),
      word("Figure", 500, 300),
      word("3.", 570, 300),
    ];

    const [region] = findFigureCropRegions(words, 1000, 1000, 7);
    expect(region.label).toBe("figure 3 on page 7");
    // The transformer rows sit between the prose and the caption.
    expect(region.top).toBeGreaterThanOrEqual(110);
    expect(region.top).toBeLessThanOrEqual(180);
    expect(region.top + region.height).toBeGreaterThan(310);
  });
});
