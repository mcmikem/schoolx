/**
 * The exam parser has to survive the paper it will actually receive.
 *
 * Papers reach this from a scan. So the input here is deliberately poor: OCR
 * mistakes on question numbers, page furniture in the middle of the document,
 * options misread as questions, diagrams described only by a caption. A parser
 * that passes on clean text and fails on scanned text has missed the point.
 *
 * The other half of these tests is about honesty. The parser is allowed to be
 * unsure, but it is not allowed to be silently confident while being wrong,
 * because a teacher reads a confident question as a fact.
 */

import { needsHuman, needsReview, reconcile, strategyFor } from "@/lib/exam/exam-model";
import { normaliseOcr, parsePaper } from "@/lib/exam/parse-paper";
import { renderPaperForm } from "@/lib/exam/render-form";

/** A plausible digital paper: clean text, real questions. */
const CLEAN = `
MATHEMATICS END OF TERM TEST
Subject: Mathematics
Class: P.7
Term: 2
Year: 2026

Total marks: 14

1. What is the value of 45 multiplied by 12? (2 marks)
2. Which of the following is the greatest prime number? (2 marks)
   (a) 21
   (b) 27
   (c) 29
   (d) 33
3. A farmer has 240 oranges. He sold 3/4 of them. How many oranges are left? (3 marks)
4. Explain why the sum of two even numbers is even. (5 marks)
5. Calculate the area of a rectangle whose length is 12 cm and width is 5 cm. (2 marks)
`;

/** What the same paper tends to look like after OCR. */
const OCR_MESSY = `
MATHEMATICS END OF TERM TEST
Subject: Mathematics
Class: P.7
Total marks: 20

l. What is the value of 45 multiplied by 12? (2 marks)

Page 2

2. Which of the following is the greatest prime number?
(a) 21
(b) 27
(c) 29
(d) 33

3. A farmer has 240 oranges. He sold 3/4 of them. How many
oranges are left? (3 marks)
4. Explain why the sum of two even numbers is even. (5 marks)
5. Sketch the diagram below and label it. (2 marks)
6. Calculate the area of a rectangle of length 12 cm. (2 marks)
`;

describe("parsePaper on a clean digital paper", () => {
  const { paper, warnings } = parsePaper(CLEAN, { title: "Mathematics" });

  it("reads the header facts", () => {
    expect(paper.subject).toBe("Mathematics");
    expect(paper.classLevel).toBe("P.7");
    expect(paper.totalMarks).toBe(14);
  });

  it("finds every question", () => {
    expect(paper.questions).toHaveLength(5);
    expect(paper.questions.map((q) => q.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it("does not mistake a question option for a new question", () => {
    // "(a) 21" starts with a letter, but "1. What is..." starts with a digit.
    // If the option regex leaked, question 2 would spawn four more.
    const q2 = paper.questions[1];
    expect(q2.choices).toHaveLength(4);
    expect(paper.questions.filter((q) => q.number === 2)).toHaveLength(1);
  });

  it("classifies by what the question asks, not by its length", () => {
    expect(paper.questions[0].kind).toBe("short_answer");
    expect(paper.questions[1].kind).toBe("multiple_choice");
    expect(paper.questions[2].kind).toBe("numeric");
    expect(paper.questions[3].kind).toBe("long_answer");
  });

  it("reads the printed marks", () => {
    expect(paper.questions[0].marks).toBe(2);
    expect(paper.questions[3].marks).toBe(5);
  });

  it("reconciles against the printed total", () => {
    expect(reconcile(paper).agrees).toBe(true);
  });

  it("refuses to reconcile when any question has no printed marks", () => {
    // A total that silently excluded a question would be worse than no total:
    // it would agree with the paper while hiding something.
    const oneUnmarked = { ...paper, questions: paper.questions.map((q, i) => (i === 1 ? { ...q, marks: null } : q)) };
    expect(reconcile(oneUnmarked).counted).toBeNull();
    expect(reconcile(oneUnmarked).agrees).toBe(false);
  });

  it("does not invent accepted answers", () => {
    // An empty list is the honest state: the parser read the question, it did
    // not find an answer key. Without one, short answers go to a teacher.
    expect(paper.questions.every((q) => q.acceptedAnswers.length === 0)).toBe(true);
    expect(strategyFor(paper.questions[0])).toBe("never");
  });
});

describe("numbered-item exam papers", () => {
  it("recognises UMTA-style Item labels and does not absorb section headings", () => {
    const paper = parsePaper(`
SECTION A
All items in this section are compulsory
Item 1.
During a practical, calculate the lens power. (4 marks)
Item 2.
Explain the uses of a satellite. (5 marks)
SECTION B.
PART I
Attempt one item from this part.
Item 3:
Determine the density of the sample. (6 marks)
`).paper;

    expect(paper.questions.map((question) => question.number)).toEqual([1, 2, 3]);
    expect(paper.questions[1].text).not.toContain("SECTION B");
    expect(paper.questions[2].text).not.toContain("PART I");
  });

  it("does not mistake logic-gate input labels for answer parts", () => {
    const question = parsePaper(`
Item 1.
Design and explain the satellite logic circuit.
Task:
(a) Draw the circuit and construct its truth table.
(b) Explain when the satellite transmits.
(d) Transmission requires daytime (Input A) or an imaging request (Input B), and the target area condition (Input C).
`).paper.questions[0];

    expect(question.subTasks?.map((part) => part.label)).toEqual(["a", "b", "d"]);
    expect(question.subTasks?.[2].text).toContain("Input A");
    expect(question.subTasks?.[2].text).toContain("Input C");
  });

  it("recovers bare and blanked subpart labels from flattened PDF text", () => {
    const question = parsePaper(`
Item 1.
Apply the physics concepts to the situation.
a Explaining the first process in detail.
b Determine the second result.
() Identification of the final component.
`).paper.questions[0];

    expect(question.subTasks?.map((part) => part.label)).toEqual(["a", "b", "c"]);
    expect(question.subTasks?.[2].text).toContain("Identification");
  });
});

describe("page-aware question locations", () => {
  it("retains source pages, including a question that continues onto another page", () => {
    const paper = parsePaper("", {
      pageTexts: ["1. First question body", "continued question details\nSee diagram below\n2. Second question"],
    }).paper;

    expect(paper.questions[0].sourcePages).toEqual([1, 2]);
    expect(paper.questions[0].diagrams[0].page).toBe(2);
    expect(paper.questions[1].sourcePages).toEqual([2]);
  });
});

describe("parsePaper on OCR output", () => {
  const { paper, warnings } = parsePaper(OCR_MESSY, { ocr: true });

  it("recovers a question number OCR read as a letter", () => {
    // "l. What is the value..." -- the single most common numbered-list error.
    expect(paper.questions[0].number).toBe(1);
  });

  it("ignores page furniture mid-document", () => {
    expect(paper.questions.map((q) => q.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("keeps a stem wrapped across lines as one question", () => {
    expect(paper.questions[2].text).toContain("oranges are left");
  });

  it("marks itself OCR-derived and says so", () => {
    expect(paper.ocrApplied).toBe(true);
    expect(warnings.some((w) => /scan/i.test(w))).toBe(true);
  });

  it("is less confident than the same paper read digitally", () => {
    const clean = parsePaper(CLEAN).paper;
    const messyAverage = paper.questions.reduce((s, q) => s + q.confidence, 0) / paper.questions.length;
    const cleanAverage = clean.questions.reduce((s, q) => s + q.confidence, 0) / clean.questions.length;
    expect(messyAverage).toBeLessThan(cleanAverage);
  });

  it("records a diagram as an uncaptured gap, not as a described picture", () => {
    const withDiagram = paper.questions.find((q) => q.diagrams.length > 0);
    expect(withDiagram).toBeDefined();
    expect(withDiagram!.diagrams[0].imageDataUri).toBeNull();
    expect(withDiagram!.diagrams[0].label).toMatch(/figure/i);
  });

  it("flags the marked-for-review questions rather than hiding the doubt", () => {
    const flagged = needsReview(paper);
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.length).toBeLessThan(paper.questions.length);
  });

  it("never offers a long answer to a machine", () => {
    expect(needsHuman(paper).some((q) => q.kind === "long_answer")).toBe(true);
  });
});

describe("figure label debris", () => {
  it("drops the short labels printed inside a diagram but keeps the data under it", () => {
    const { paper } = parsePaper(`
1. A pupil looks at the apparatus shown below.
Support Material.
lamp normal
doctor
-
Air
Glass
Beam of light
Figure 1. Endoscopic treatment
Refractive index of the glass material is 1.47.
Height of the medical records is 2 cm.
Task:
(a) Explain why the lamp is placed there.
(b) State one use of the glass tube.
`);

    const question = paper.questions[0];
    expect(question.text).not.toMatch(/Support Material|lamp normal|Beam of light/);
    expect(question.text).not.toContain("Figure 1. Endoscopic treatment");
    expect(question.text).toContain("Refractive index of the glass material is 1.47.");
    expect(question.text).toContain("Height of the medical records is 2 cm.");
    expect(question.diagrams[0].label).toBe("figure 1 on page 1");
  });

  it("drops a caption printed without a space after the figure number", () => {
    const { paper } = parsePaper(`
1. The apparatus is shown below.
Figure2. Optical fibre.
Refractive index of the glass is 1.47.
(a) State what happens to the light.
`);

    const question = paper.questions[0];
    expect(question.text).not.toContain("Optical fibre");
    expect(question.text).toContain("Refractive index of the glass is 1.47.");
    expect(question.diagrams[0].label).toBe("figure 2 on page 1");
  });

  it("keeps a lone short line before a figure, which is usually an instruction", () => {
    const { paper } = parsePaper(`
1. Use the diagram below.
Use g = 10.
Figure 1. A falling stone.
(a) Calculate the time taken.
`);

    expect(paper.questions[0].text).toContain("Use g = 10.");
  });
});

describe("parsePaper when it cannot read the paper at all", () => {
  it("says so instead of returning nothing quietly", () => {
    const { paper, warnings } = parsePaper("~~~ unreadable ~~~ %%%", { ocr: true });
    expect(paper.questions).toHaveLength(0);
    expect(warnings.some((w) => /no numbered questions/i.test(w))).toBe(true);
  });
});

describe("normaliseOcr", () => {
  it("fixes a letter where a question number should be", () => {
    expect(normaliseOcr("l. First question")).toContain("1. First question");
    expect(normaliseOcr("I) Another")).toContain("1) Another");
  });

  it("fixes punctuation OCR misreads after a numbered question", () => {
    const source = ["Exercise 1.2", "1, lfset A = {6, 7, 8}, use this set. 2. Give four examples."].join("\n");
    const parsed = parsePaper(source, { ocr: true }).paper;

    expect(normaliseOcr(source)).toContain("1. lfset A");
    expect(parsed.questions.map((question) => question.number)).toEqual([1, 2]);
  });

  it("splits words the OCR has run together across a case boundary", () => {
    expect(normaliseOcr("multiplicationIsCommutative")).toBe("multiplication Is Commutative");
  });

  it("leaves ordinary hyphenated words alone", () => {
    expect(normaliseOcr("a well-known fact")).toBe("a well-known fact");
  });

  it("collapses runs of whitespace without losing line structure", () => {
    expect(normaliseOcr("a   b\n\n\n\nc")).toBe("a b\n\nc");
  });
});

describe("book-page filtering", () => {
  it("skips contents and preface pages and stops questions at section headings", () => {
    const { paper, warnings } = parsePaper("", {
      ocr: true,
      pageTexts: [
        ["Table of Contents", "1.1 Mappings ........ 7", "1.2 Relations ........ 9", "2.1 Sets ........ 15"].join("\n"),
        ["Preface", "This book introduces mathematics topics."].join("\n"),
        [
          "Exercise 1.1",
          "1. Given sets A and B.",
          "2. State their relation.",
          "1.2 Identifying Domain and Range of a Mapping",
          "This lesson text is not a question.",
        ].join("\n"),
      ],
    });

    expect(paper.questions.map((question) => question.number)).toEqual([1, 2]);
    expect(paper.questions[0].sourcePages).toEqual([3]);
    expect(paper.questions[1].text).not.toContain("lesson text");
    expect(warnings.some((warning) => /contents or preface pages were skipped/i.test(warning))).toBe(true);
  });

  it("attaches a scanned source page to a detected diagram in the student form", () => {
    const pageImage = "data:image/jpeg;base64,c2Nhbm5lZC1wYWdl";
    const { paper } = parsePaper("", {
      ocr: true,
      pageTexts: ["1. Explain the diagram below."],
      pageImages: { 1: pageImage },
    });
    const html = renderPaperForm(paper);

    expect(paper.questions[0].diagrams[0].imageDataUri).toBe(pageImage);
    expect(html).toContain("View original scanned page 1 (full page)");
    expect(html).toContain(pageImage);
    expect(html).not.toContain("Image not captured");
  });
});

describe("renderPaperForm", () => {
  const { paper } = parsePaper(CLEAN, { title: "Mathematics" });
  const html = renderPaperForm(paper, { includeMarking: true });

  it("is a self-contained file: no external script, style or asset", () => {
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).toContain("<style>");
  });

  it("is built for a phone", () => {
    expect(html).toContain('name="viewport"');
    expect(html).toMatch(/@media \(max-width:26rem\)/);
    expect(html).toContain("min-height:44px");
  });

  it("shows every question and every option", () => {
    expect((html.match(/class="q[ "]/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(html).toContain('value="a"');
    expect(html).toContain('value="d"');
  });

  it("marks the long answer as needing a teacher", () => {
    expect(html).toContain("Needs a teacher");
    expect(html).toContain("Marked automatically");
  });

  it("embeds a marking key that excludes everything a machine must not judge", () => {
    const json = html.match(/id="marking-key"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "";
    const key = JSON.parse(json.replace(/\\u003c/g, "<"));
    const numbers = key.map((k: { id: string }) => k.id);
    // No long answers in the key, ever.
    expect(numbers).not.toContain("q-4");
  });

  it("warns when the marks do not reconcile", () => {
    const broken = { ...paper, totalMarks: 99 };
    expect(renderPaperForm(broken)).toContain("The marks do not add up");
  });

  it("does not warn about missing marks when the source paper gives no total", () => {
    const noMarkScheme = parsePaper("Item 1. Explain the circuit.").paper;
    expect(renderPaperForm(noMarkScheme)).not.toContain("The marks do not add up");
  });

  it("does not invent an image for a diagram it never captured", () => {
    const messy = parsePaper(OCR_MESSY, { ocr: true }).paper;
    const rendered = renderPaperForm(messy);
    expect(rendered).toContain("Image not captured");
    expect(rendered).not.toMatch(/<img src="data:image/);
  });
});

describe("OCR fragment boundaries", () => {
  it("detached table numbers do not become questions", () => {
    const paper = [
      "1. Explain how enzyme activity contributes to reduced lung efficiency.",
      "Task: (a) Explain how. (b) Suggest strategies.",
      "2.",
      "16 / 14",
      "3. Analyse how data show structure function relationships.",
    ].join("\n");
    const { paper: parsed, warnings } = parsePaper(paper);
    expect(parsed.questions.map((q) => q.number)).toEqual([1, 2, 3]);
    expect(parsed.questions.some((q) => q.text.includes("16 / 14"))).toBe(true);
    expect(warnings.join("\n")).not.toMatch(/out of order/);
  });

  it("OCR-glued Task headers open the task run", () => {
    const paper = [
      "Task explanation?",
      "1. Compare the goats in the scenario.",
      "T AS K:",
      "(a) Explain how oxygen transport differs between the two goats.",
      "(b) Suggest strategies to restore productivity in the herd.",
    ].join("\n");
    const { paper: parsed } = parsePaper(paper);
    const q1 = parsed.questions.find((q) => q.number === 1);
    expect(q1?.kind).toBe("long_answer");
    expect(q1?.choices).toHaveLength(0);
    expect(q1?.text).not.toContain("Explain how oxygen transport differs");
    expect(q1?.subTasks?.[0].text).toContain("Explain how oxygen transport differs");
  });

  it("essay sub-prompts never become radio choices when Task line is lost", () => {
    const paper = [
      "1. A clinic investigated how smoking affects respiratory health. Samples were analysed.",
      "(a) Explain how structural changes in epithelial tissue impair its normal function in smokers.",
      "(b) Suggest five public-health or lifestyle strategies to reduce tissue damage and promote recovery.",
      "2. Residents living near charcoal-burning sites complain of fatigue. Parameter Control Group Exposed Residents.",
    ].join("\n");
    const { paper: parsed } = parsePaper(paper);
    const q1 = parsed.questions.find((q) => q.number === 1);
    expect(q1?.choices).toHaveLength(0);
    expect(q1?.kind).toBe("long_answer");
  });

  it("keeps nested roman subparts distinct from the next lettered part", () => {
    const paper = [
      "1. Explain the plant responses shown in the data.",
      "Task:",
      "(a) i. Explain the first response in detail.",
      "ii. Explain the second response in detail.",
      "(b) Propose a management plan for the farm.",
    ].join("\n");
    const question = parsePaper(paper).paper.questions[0];
    expect(question.subTasks?.map((part) => part.label)).toEqual(["a(i)", "a(ii)", "b"]);
    expect(new Set(question.subTasks?.map((part) => part.label)).size).toBe(question.subTasks?.length);
  });

  it("combines consecutive text fragments carrying the same printed part label", () => {
    const question = parsePaper(
      [
        "1. Explain the inheritance pattern.",
        "Task:",
        "(a) Calculate the probability of the condition.",
        "(a) Analyse why the allele remains in the population.",
        "(b) Advise the family.",
      ].join("\n"),
    ).paper.questions[0];
    expect(question.subTasks).toEqual([
      {
        label: "a",
        text: "Calculate the probability of the condition. Analyse why the allele remains in the population.",
      },
      { label: "b", text: "Advise the family." },
    ]);
  });
});
