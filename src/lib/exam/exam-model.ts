/**
 * The structured exam model.
 *
 * This is step 6's real substance, and the part worth selling. Telegram is a
 * way to receive papers; the parser is a way to read them; neither is the
 * product. What a school pays for is turning a paper into something it can
 * teach from, hand out, and mark -- and that lives entirely in this model and
 * the renderer that consumes it.
 *
 * Kept free of framework, DOM and Node so it can be lifted into a standalone
 * service without dragging a Next.js app along with it.
 *
 * ## Why an explicit model at all
 *
 * A past paper is a flat run of text. Anything downstream -- a web form, a
 * printable sheet, a marking queue -- needs to know where one question stops and
 * the next begins, which of its parts are answerable, and whether the answer can
 * be checked without a human. Guessing that at render time means guessing it
 * again for every consumer, and getting it slightly differently each time.
 *
 * So parsing produces this, once, explicitly. Consumers read what was found.
 *
 * ## On confidence
 *
 * `confidence` is not decoration. Parsing an exam paper is pattern matching on
 * imperfect text, and it will be wrong sometimes -- a misread "3." as "5.", a
 * diagram caption mistaken for a question. A wrong question that looks identical
 * to a right one is the dangerous kind: a teacher trusts it. So every question
 * carries how sure the parser was, and the renderer is expected to surface the
 * unsure ones for a human to check rather than quietly presenting them.
 */

export type QuestionKind =
  /** Single best answer. Safest to auto-mark. */
  | "multiple_choice"
  /** Free number. Auto-markable with a tolerance. */
  | "numeric"
  /** Short answer judged by exact match after normalisation. */
  | "short_answer"
  /** Needs a human. Never auto-marked. */
  | "long_answer"
  /** Picture the text cannot describe. Needs its own crop from the page. */
  | "diagram";

/**
 * How the answer should be judged.
 *
 * `never` is the default and is deliberately sticky: a question type not
 * explicitly given a marking strategy gets none. A new question kind shows up
 * queued for a teacher rather than being auto-marked by a default nobody chose.
 */
export type MarkingStrategy = "exact" | "numeric" | "never";

export interface Choice {
  /** The label as printed: "A", "B", "(i)", "1", ... */
  label: string;
  text: string;
}

export interface SubTask extends Choice {}

export interface ExamTable {
  /** Cell content in its original row and column order. */
  rows: string[][];
  /** Number of leading rows treated as column headings. */
  headerRows: number;
}

export type ExamContentBlock = { type: "text"; text: string } | { type: "table"; tableIndex: number };

export interface ExamQuestion {
  id: string;
  /** 1-based, as printed. Kept separate from array order. */
  number: number | null;
  kind: QuestionKind;

  /** The question stem, with diagram captions removed into `diagrams`. */
  text: string;
  /** Marks printed on the paper. Null when not stated, never guessed. */
  marks: number | null;

  /** Present for multiple_choice. */
  choices: Choice[];
  /** Present for numeric and short_answer. */
  acceptedAnswers: string[];

  /** Table cells reconstructed from positioned text in the source PDF. */
  tables?: ExamTable[];
  /** Original reading order for stem text and reconstructed tables. */
  contentBlocks?: ExamContentBlock[];

  /**
   * Essay sub-prompts captured in a Task block: (a) …, (b) …, i., ii. … Each
   * part is answered and marked on its own, so the renderer gives every one
   * its own space instead of one box for the whole question. Absent when the
   * question has no task block.
   */
  subTasks?: SubTask[];

  /**
   * Images found inside the question, described by position on the page rather
   * than by content. A diagram is a picture, not a sentence; anything claiming
   * to have converted one into text has invented it.
   */
  diagrams: DiagramRef[];

  /** 0-1. Below REVIEW_THRESHOLD this question is shown for human checking. */
  confidence: number;

  /** Raw text the parser saw, so a teacher can see what it was working from. */
  sourceText: string;
  /** Original PDF page numbers containing this question. */
  sourcePages?: number[];
}

export interface DiagramRef {
  /** 1-based page. */
  page: number;
  /** Human description, e.g. "figure on page 3". Never a fabricated caption. */
  label: string;
  /**
   * Crop of the image, as a data URI, when the source could provide one.
   * Null when the paper was scanned and the crop was not taken -- better an
   * honest gap than a wrong picture.
   */
  imageDataUri: string | null;
}

export interface ExamPaper {
  /** Stable id derived from the source, so re-running does not duplicate. */
  id: string;
  title: string | null;
  /** As printed. Null when the paper does not state it. */
  classLevel: string | null;
  subject: string | null;
  year: number | null;
  term: string | null;
  totalMarks: number | null;
  /** Set when the source was scanned and OCR was used. */
  ocrApplied: boolean;
  questions: ExamQuestion[];
}

/** Below this, a question is offered for review rather than presented as fact. */
export const REVIEW_THRESHOLD = 0.75;

/** Which questions may be marked without a human. */
export function markableByMachine(paper: ExamPaper): ExamQuestion[] {
  return paper.questions.filter((q) => strategyFor(q) !== "never");
}

/** The questions that genuinely need a teacher. */
export function needsHuman(paper: ExamPaper): ExamQuestion[] {
  return paper.questions.filter((q) => strategyFor(q) === "never");
}

/** Questions the parser was unsure enough about to warrant a look. */
export function needsReview(paper: ExamPaper): ExamQuestion[] {
  return paper.questions.filter((q) => q.confidence < REVIEW_THRESHOLD);
}

export function strategyFor(question: ExamQuestion): MarkingStrategy {
  switch (question.kind) {
    case "multiple_choice":
      // Only safe when options were actually found. A question parsed as MCQ
      // with no choices cannot be auto-marked by definition.
      return question.choices.length >= 2 ? "exact" : "never";
    case "numeric":
      return "numeric";
    case "short_answer":
      // "Short answer" is a shape, not a promise. Without accepted answers
      // there is nothing to compare against, so a human decides.
      return question.acceptedAnswers.length > 0 ? "exact" : "never";
    case "long_answer":
    case "diagram":
      return "never";
  }
}

/**
 * Total marks the paper accounts for, or null when it does not add up.
 *
 * Returning null rather than a wrong total matters: a teacher comparing this
 * against the printed total is the only cross-check the parser will ever get.
 */
export function reconcile(paper: ExamPaper): {
  counted: number | null;
  stated: number | null;
  agrees: boolean;
} {
  const withMarks = paper.questions.filter((q) => q.marks !== null);
  const counted =
    withMarks.length === paper.questions.length ? withMarks.reduce((sum, q) => sum + (q.marks ?? 0), 0) : null;
  return {
    counted,
    stated: paper.totalMarks,
    agrees: counted !== null && paper.totalMarks !== null ? counted === paper.totalMarks : false,
  };
}
