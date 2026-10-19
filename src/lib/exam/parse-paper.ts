/**
 * Question parser: flat text in, structured exam out.
 *
 * Written for the worst realistic input rather than the tidiest. Papers reach
 * this from OCR, so the text arrives with misread characters, collapsed
 * whitespace, page headers repeated mid-document, and numbering that restarts.
 * A parser that only works on clean digital text is a parser that fails in
 * exactly the situation this product exists for.
 *
 * Every judgement it makes is recorded in `confidence`. The renderer shows
 * anything doubtful for a human; nothing here silently decides it is sure.
 */

import {
  type Choice,
  type DiagramRef,
  type ExamPaper,
  type ExamQuestion,
  type MarkingStrategy,
  type QuestionKind,
  strategyFor,
} from "./exam-model";

/** A question starts with its number, then a dot/bracket, then a stem. */
const QUESTION_START = /^\s*(?:question\s*)?(\d{1,2})\s*[.)]\s*(?=\S)/i;

/** "(a) ...", "(i) ...", "A. ..." -- an option, not a new question. */
const CHOICE_LINE = /^\s*(?:\(?([a-z]|[ivx]{1,4}|\d{1,2})\)?)\s*[.):]?\s+(\S.*)$/i;

/** Marks printed against a question: "(5 marks)", "[10]". */
const MARKS = /\(?\b(\d{1,2})\s*marks?\b\)?|\[(\d{1,2})\]/i;

/** Lines that are page furniture rather than questions. */
const PAGE_NOISE = /^(page\s+\d+\s*(of\s+\d+)?|\d{1,3})$/i;

const DIAGRAM_LINE = /\b(fig(?:ure)?\.?\s*[\d.]+|diagram|draw(ing)?\s+(the|below|above)|sketch)\b/i;

export interface ParseOptions {
  /** True when the text came from OCR and should be trusted less. */
  ocr?: boolean;
  page?: number;
  title?: string | null;
  classLevel?: string | null;
  subject?: string | null;
  year?: number | null;
  term?: string | null;
  totalMarks?: number | null;
}

export interface ParsedText {
  paper: ExamPaper;
  /** Plain-language notes for whoever has to check the parse. */
  warnings: string[];
}

/**
 * Normalise OCR output.
 *
 * Fixes the specific things OCR does to exam papers, and nothing else. Every
 * substitution here is reversible in spirit: the goal is that the parser sees a
 * consistent shape, not that the text is "corrected" into something else.
 */
export function normaliseOcr(text: string): string {
  return (
    text
      .replace(/\r\n?/g, "\n")
      // Split words the OCR has joined, but only across a case boundary or a
      // digit-to-letter join -- a real hyphenated word is left alone.
      .replace(/(\w)([A-Z])/g, "$1 $2")
      // The single most common OCR failure in numbered lists.
      .replace(/^(\s*)([Il|])([.)])/gm, (_m, lead: string, _glyph: string, delim: string) => `${lead}1${delim}`)
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Pull the printed header facts off the top of the paper. */
function readHeader(text: string, options: ParseOptions) {
  const head = text.slice(0, 600);
  const pick = (re: RegExp) => head.match(re)?.[1]?.trim() ?? null;

  return {
    title: options.title ?? pick(/(?:^|\n)\s*([A-Z][^\n]{6,70})\s*\n\s*-+/),
    classLevel: options.classLevel ?? pick(/\bclass\s*[:\-]?\s*([A-Za-z0-9. ]{1,12})/i),
    subject: options.subject ?? pick(/\bsubject\s*[:\-]?\s*([A-Za-z ]{3,30})/i),
    year: options.year ?? (pick(/\b(20\d{2})\b/) ? Number(pick(/\b(20\d{2})\b/)) : null),
    term: options.term ?? pick(/\bterm\s*[:\-]?\s*([A-Za-z0-9]{1,4})/i),
    totalMarks:
      options.totalMarks ??
      (pick(/\btotal\s*(?:marks?)?\s*[:\-]?\s*(\d{1,3})/i)
        ? Number(pick(/\btotal\s*(?:marks?)?\s*[:\-]?\s*(\d{1,3})/i))
        : null),
  };
}

/**
 * Whether a label continues the option run already collected.
 *
 * Recognises the three labellings that actually appear on school papers:
 * letters, arabic numerals and roman numerals. Anything that does not follow
 * on from what came before is not an option.
 */
function continuesOptionRun(choices: Choice[], label: string): boolean {
  if (choices.length === 0) {
    // The first option establishes the scheme: a letter, a digit, or roman.
    return /^[a-z]$/i.test(label) || /^\d{1,2}$/.test(label) || /^[ivx]{1,4}$/i.test(label);
  }

  const previous = choices[choices.length - 1].label;
  const last = previous[previous.length - 1];

  if (/[a-z]/i.test(last) && !/[ivx]/i.test(last)) {
    return label.toLowerCase() === String.fromCharCode(last.toLowerCase().charCodeAt(0) + 1);
  }
  if (/^[ivx]+$/i.test(previous)) {
    return nextRoman(previous) === label.toLowerCase();
  }
  return Number(label) === Number(previous) + 1;
}

function nextRoman(roman: string): string {
  const order = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
  const index = order.indexOf(roman.toLowerCase());
  return index >= 0 && index < order.length - 1 ? order[index + 1] : "";
}

function guessKind(stem: string, choices: Choice[], marks: number | null): QuestionKind {
  if (choices.length >= 2) return "multiple_choice";
  // A long stem that asks for a discussion is a long answer whatever else it
  // looks like. Marks help: papers usually give essay questions more.
  if (/\b(explain|describe|discuss|state|give reasons|outline|suggest|advise)\b/i.test(stem)) {
    return "long_answer";
  }
  if (marks !== null && marks >= 10) return "long_answer";
  // "How many...", "Calculate..." and bare numerals want a number.
  if (/\b(how many|how much|calculate|total|sum|average|factorise|evaluate)\b/i.test(stem)) {
    return "numeric";
  }
  return "short_answer";
}

/**
 * Parse a paper.
 *
 * `confidence` starts high for clean text and is reduced by the specific things
 * that make a parse doubtful: OCR input, a question with no marks and no
 * options, numbering that jumped, a diagram nobody captured.
 */
export function parsePaper(source: string, options: ParseOptions = {}): ParsedText {
  const warnings: string[] = [];
  const text = options.ocr ? normaliseOcr(source) : source;
  const lines = text.split("\n");
  const header = readHeader(text, options);
  const page = options.page ?? 1;

  interface Block {
    lines: string[];
  }
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (PAGE_NOISE.test(line.trim())) continue;

    const startsQuestion = QUESTION_START.test(line);
    if (startsQuestion) {
      current = { lines: [line] };
      blocks.push(current);
      continue;
    }
    // Text before the first numbered question is header or an instruction page.
    if (!current) continue;
    current.lines.push(line);
  }

  if (blocks.length === 0) {
    warnings.push(
      "No numbered questions were found. The paper may be scanned at poor quality, or laid out in a way this parser does not recognise.",
    );
  }

  const questions: ExamQuestion[] = blocks.map((block, index) =>
    buildQuestion(block, index, blocks, { page, ocr: Boolean(options.ocr), warnings }),
  );

  // Numbering that skips or repeats is a strong signal the OCR misread a digit.
  const numbers = questions.map((q) => q.number).filter((n): n is number => n !== null);
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] <= numbers[i - 1]) {
      warnings.push(
        `Question numbering is out of order around ${numbers[i]} (after ${numbers[i - 1]}). A digit has probably been misread.`,
      );
    }
  }

  if (options.ocr) {
    warnings.push(
      "This text came from a scan, read by OCR. Check the question numbers and any diagram before using it.",
    );
  }

  return {
    paper: {
      id: `paper-${hash(`${header.title ?? ""}${text.length}${questions.length}`)}`,
      title: header.title,
      classLevel: header.classLevel,
      subject: header.subject,
      year: header.year,
      term: header.term,
      totalMarks: header.totalMarks,
      ocrApplied: Boolean(options.ocr),
      questions,
    },
    warnings,
  };
}

function buildQuestion(
  block: { lines: string[] },
  index: number,
  all: Array<{ lines: string[] }>,
  context: { page: number; ocr: boolean; warnings: string[] },
): ExamQuestion {
  const body = block.lines.join("\n");

  const numberMatch = body.match(QUESTION_START);
  const number = numberMatch ? Number(numberMatch[1]) : null;
  const afterNumber = numberMatch ? body.slice(numberMatch[0].length) : body;

  const marksMatch = afterNumber.match(MARKS);
  const marks = marksMatch ? Number(marksMatch[1] ?? marksMatch[2]) : null;

  const choices: Choice[] = [];
  const stemLines: string[] = [];
  const diagrams: DiagramRef[] = [];
  let diagramCounter = 0;

  for (const rawLine of afterNumber.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (DIAGRAM_LINE.test(line)) {
      diagramCounter++;
      diagrams.push({
        page: context.page,
        label: `figure ${diagramCounter} on page ${context.page}`,
        // No crop: the parser reads text, it does not cut pictures. A null here
        // is honest -- the renderer shows the gap and asks for the image.
        imageDataUri: null,
      });
      continue;
    }

    const choiceMatch = line.match(CHOICE_LINE);
    // Two things must hold before a line counts as an option.
    //
    // First, there must already be a stem. Otherwise "A farmer has 240
    // oranges..." is read as option A and the whole question silently loses its
    // text -- which is how a paper goes out with an empty question nobody
    // noticed.
    //
    // Second, the labels must form a run: a, b, c or 1, 2, 3 or i, ii, iii. A
    // lone "A" mid-sentence is a word, not an option.
    if (choiceMatch && (stemLines.length > 0 || choices.length > 0)) {
      if (continuesOptionRun(choices, choiceMatch[1])) {
        choices.push({ label: choiceMatch[1], text: choiceMatch[2] });
        continue;
      }
    }
    stemLines.push(line);
  }

  const text = stemLines.join(" ").replace(MARKS, "").trim();
  const kind = guessKind(text, choices, marks);

  // Confidence, deducted for specific doubts rather than guessed at.
  let confidence = context.ocr ? 0.82 : 0.95;
  if (number === null) confidence -= 0.3;
  if (marks === null) confidence -= 0.08;
  if (kind === "multiple_choice" && choices.length < 2) confidence -= 0.25;
  if (diagrams.length > 0) confidence -= 0.1;
  if (text.length < 8) confidence -= 0.2;
  // A question whose body is mostly its own options has lost its stem.
  if (choices.length > 0 && text.length < 4) confidence -= 0.2;
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

  if (confidence < 0.5) {
    context.warnings.push(
      `Question ${number ?? index + 1} parsed poorly (confidence ${confidence}). It probably needs re-doing by hand.`,
    );
  }

  return {
    id: `q-${index + 1}`,
    number,
    kind,
    text,
    marks,
    choices,
    // Accepted answers are not invented. An empty list means a human decides,
    // which is why the strategy for short_answer also requires one.
    acceptedAnswers: [],
    diagrams,
    confidence,
    sourceText: block.lines.join("\n"),
  };
}

/** Small stable hash, so re-parsing the same paper yields the same id. */
function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export type { MarkingStrategy };
export { strategyFor };
