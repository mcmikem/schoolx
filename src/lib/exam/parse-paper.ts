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
  type ExamContentBlock,
  type ExamPaper,
  type ExamQuestion,
  type ExamTable,
  type MarkingStrategy,
  type QuestionKind,
  type SubTask,
  strategyFor,
} from "./exam-model";

/**
 * A question starts with its number, then a dot/bracket.
 *
 * A dot followed by another digit is a decimal -- "4.8 L", "0.5 mM" -- not a
 * question 4 with stem "8 L?" Data-table papers are dense with these, and
 * without the guard every decimal spawns a phantom question that then makes
 * the numbering check report the paper as misread.
 *
 * The stem does not have to share the line with the number: several real
 * papers print "35." alone, with the body on the next line, because of how
 * the typesetter broke the text runs. Requiring same-line text would make
 * those questions invisible.
 */
const QUESTION_START = /^\s*(?:question\s*)?(\d{1,2})\s*(?:\.(?!\d)|[)])/i;

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
  /** Original pages, in order; when present, used to retain question locations. */
  pageTexts?: string[];
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
    // Term values are ordinals ("1", "2") or Roman numerals ("II"). A loose
    // alphanumeric match reads the sentence "long-term smokers" and prints
    // "smok" on the cover. Only ordinal and roman spellings count.
    term: options.term ?? pick(/\bterm\s*[:\-]?\s*([IVXivx]{1,4}|\d)\b(?![a-z])/i),
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
  // looks like. Marks help: papers usually give essay questions more. The verb
  // list is taken from what Ugandan papers actually print on extended tasks --
  // "propose" and "analyse" appear far more often than "discuss".
  if (
    /\b(explain|describe|discuss|state|give reasons|outline|suggest|advise|propose|analyse|analyze|assess|evaluate|justify)\b/i.test(
      stem,
    )
  ) {
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
  const pageTexts = options.pageTexts?.length ? options.pageTexts : [source];
  const text = options.ocr ? pageTexts.map(normaliseOcr).join("\n\n") : pageTexts.join("\n\n");
  const lines = pageTexts.flatMap((pageText, index) =>
    (options.ocr ? normaliseOcr(pageText) : pageText)
      .split("\n")
      .map((line) => ({ line, page: (options.page ?? 1) + index })),
  );
  const header = readHeader(text, options);
  const page = options.page ?? 1;

  interface Block {
    lines: string[];
    linePages: number[];
    pages: Set<number>;
  }
  const blocks: Block[] = [];
  let current: Block | null = null;

  // Real papers number their questions in one ascending run. OCR column runs
  // shatter tables so every cell number ("<tab>2.", "16.") arrives detached and
  // looks exactly like a question start -- which is how a 60-question paper
  // becomes 122 fragments. A start is therefore only believed when its number
  // has not been used and it does not go backwards; anything else stays with
  // the question it landed in.
  const seenNumbers = new Set<number>();
  let lastNumber: number | null = null;

  for (const entry of lines) {
    const raw = entry.line;
    const line = raw.trimEnd();
    if (PAGE_NOISE.test(line.trim())) continue;

    const startMatch = line.match(QUESTION_START);
    const number = startMatch ? Number(startMatch[1]) : null;
    const isFragment = number !== null && (seenNumbers.has(number) || (lastNumber !== null && number < lastNumber));
    if (startMatch && !isFragment) {
      if (number !== null) {
        seenNumbers.add(number);
        lastNumber = number;
      }
      current = { lines: [line], linePages: [entry.page], pages: new Set([entry.page]) };
      blocks.push(current);
      continue;
    }
    // Text before the first numbered question is header or an instruction page.
    if (!current) continue;
    current.lines.push(line);
    current.linePages.push(entry.page);
    current.pages.add(entry.page);
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

  // The same message twice carries nothing the first did not. A long paper can
  // genuinely produce identical warnings -- two tables with the same decimal,
  // two stubs with the same confidence -- and the doubled list reads as a
  // bug rather than as a finding.
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
    warnings: [...new Set(warnings)],
  };
}

function buildQuestion(
  block: { lines: string[]; linePages: number[]; pages: Set<number> },
  index: number,
  all: Array<{ lines: string[]; linePages: number[]; pages: Set<number> }>,
  context: { page: number; ocr: boolean; warnings: string[] },
): ExamQuestion {
  const body = block.lines.join("\n");

  const numberMatch = body.match(QUESTION_START);
  const number = numberMatch ? Number(numberMatch[1]) : null;
  const afterNumber = numberMatch ? body.slice(numberMatch[0].length) : body;
  const { tables, tableLineIndexes, tableStartIndexes } = extractTables(afterNumber.split("\n"));

  const marksMatch = afterNumber.match(MARKS);
  const marks = marksMatch ? Number(marksMatch[1] ?? marksMatch[2]) : null;

  const choices: Choice[] = [];
  const stemLines: string[] = [];
  const diagrams: DiagramRef[] = [];
  let diagramCounter = 0;
  // Essay questions print "Task:" before their sub-prompts, and those
  // sub-prompts are labelled (a)/(b)/(i) exactly like multiple-choice options.
  // After a Task header the labels are parts of one essay, not choices -- the
  // alternative is reading a long-answer paper as a two-choice quiz. The
  // header may also share its line with the first sub-prompt ("Task: (a)
  // Analyse ..."), because the typesetter put them close enough together that
  // layout reconstruction joins the runs; the remainder is still stem text.
  // Either "Task:"/"Tasks:" with more text after it (merged line), or the
  // bare word alone. A prose line that merely begins with the word "task" is
  // not a header.
  // OCR readers break "Task:" into letter runs ("T AS K:", "T ASK:"), so the
  // spaced spelling is matched too. The letter gaps make the loose pattern
  // safe: ordinary prose never spells the word that far apart.
  const TASK_HEADER =
    /^\s*tasks?\s*:(.*)$|^\s*tasks?\s*$|^\s*t[\s]*a[\s]*s[\s]*k[\s]*s?\s*:\s*(.*)$|^\s*t[\s]*a[\s]*s[\s]*k[\s]*s?\s*$/i;
  let inTaskRun = false;
  // Essay parts get their own answer spaces, so task text must not also remain
  // in the stem where students would see it twice.
  const subTasks: SubTask[] = [];
  let currentSub: SubTask | null = null;
  let currentMajorLabel: string | null = null;
  const normalizePartLabel = (rawLabel: string) => {
    const label = rawLabel.toLowerCase();
    if (/^[a-d]$/.test(label)) {
      currentMajorLabel = label;
      return label;
    }
    if (/^(?:i{1,3}|iv)$/.test(label) && currentMajorLabel) return `${currentMajorLabel}(${label})`;
    return label;
  };
  const appendSubTask = (part: SubTask) => {
    const previous = subTasks[subTasks.length - 1];
    if (previous?.label === part.label) previous.text = `${previous.text} ${part.text}`.trim();
    else subTasks.push(part);
  };
  const flushSub = () => {
    if (currentSub) appendSubTask(currentSub);
    currentSub = null;
  };
  // "(a)" "(b)" "i." "(ii)" "(" roman ")" ... only ever opens a new part when
  // we are inside a Task block. A mid-sentence "a)" elsewhere is a word, and
  // staying out of the task run spares the scenario text.
  const SPAN_LABEL = /\(?\s*(a|b|c|d|i{1,3}|iv)\s*\)?\s*[.):]\s+/gi;
  const captureSpan = (line: string) => {
    const matches = [...line.matchAll(SPAN_LABEL)];
    if (matches.length === 0) {
      // A label-less line inside the run continues the part it follows.
      const anchor = currentSub ?? subTasks[subTasks.length - 1];
      if (anchor) anchor.text += ` ${line.trim()}`;
      return;
    }
    flushSub();
    if (matches[0].index !== undefined && matches[0].index > 0) {
      // Prose before the first label stays in the stem; it has no part.
    }
    for (let i = 0; i < matches.length; i++) {
      const from = (matches[i].index ?? 0) + matches[i][0].length;
      const to = i + 1 < matches.length ? (matches[i + 1].index ?? line.length) : line.length;
      const text = line.slice(from, to).trim();
      const label = normalizePartLabel(matches[i][1]);
      if (text) appendSubTask({ label, text });
    }
    currentSub = null;
  };

  let afterNumberIndex = 0;
  for (const rawLine of afterNumber.split("\n")) {
    const originalPage = block.linePages[afterNumberIndex] ?? context.page;
    const lineIndex = afterNumberIndex;
    afterNumberIndex++;
    if (tableLineIndexes.has(lineIndex)) {
      const tableIndex = tableStartIndexes.get(lineIndex);
      if (tableIndex !== undefined) stemLines.push(`\u0001TABLE_${tableIndex}\u0001`);
      continue;
    }
    const line = rawLine.trim();
    if (!line) continue;

    const taskHeader = line.match(TASK_HEADER);
    if (taskHeader) {
      // Data-table questions label their rows A/B/C -- site A, site B, condition
      // A -- and those rows sit in the question before its Task block. If the
      // question turns out to be essay-structured, the lettered run was table
      // geometry, not options: an MCQ paper does not print "Task:" at all. A
      // run kept through this point would reclassify a data-table essay as a
      // two-choice quiz. The rows are not thrown away either: they are the
      // question's data, so they go back into the stem where the reader can
      // still see the table the essay argues about.
      if (choices.length > 0) {
        stemLines.push(...choices.map((choice) => `${choice.label} ${choice.text}`));
        choices.length = 0;
      }
      inTaskRun = true;
      const remainder = (taskHeader[1] ?? taskHeader[2] ?? "").trim();
      // "Task:" on its own line opens the run; merged task text belongs only
      // in the structured parts, not in the stem as well.
      if (remainder) {
        captureSpan(remainder);
      }
      continue;
    }

    if (DIAGRAM_LINE.test(line)) {
      diagramCounter++;
      diagrams.push({
        page: originalPage,
        label: `figure ${diagramCounter} on page ${originalPage}`,
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
    // lone "A" mid-sentence is a word, not an option. And inside a Task run the
    // labels are sub-prompts of one essay question, never options.
    const isTaskPrompt = inTaskRun && Boolean(choiceMatch);
    // A scanner that dropped the "Task:" line leaves the essay sub-prompts
    // looking like options: "(a) Explain how enzyme activity and connective
    // tissue changes contribute to reduced lung efficiency." Multiple-choice
    // options are short; full imperative sentences carrying a task verb are
    // parts of one essay, detected here even though the header was lost. The
    // whole run goes back into the stem, the same rescue the Task header does.
    const readsAsTaskPrompt =
      choiceMatch &&
      !isTaskPrompt &&
      choiceMatch[2].length > 60 &&
      /\b(explain|analyse|analyze|suggest|propose|justify|describe|discuss|design|relate|assess|evaluate)\b/i.test(
        choiceMatch[2],
      );
    if (readsAsTaskPrompt) {
      if (choices.length > 0) {
        stemLines.push(...choices.map((choice) => `${choice.label} ${choice.text}`));
        choices.length = 0;
      }
      inTaskRun = true;
      captureSpan(line);
      continue;
    }
    if (choiceMatch && !isTaskPrompt && (stemLines.length > 0 || choices.length > 0)) {
      if (continuesOptionRun(choices, choiceMatch[1])) {
        choices.push({ label: choiceMatch[1], text: choiceMatch[2] });
        continue;
      }
    }
    // A line that breaks the label run ends a Task run as well: the essay's
    // sub-prompts have stopped, so the next (a) belongs to a fresh judgement.
    if (choiceMatch && !isTaskPrompt) inTaskRun = false;
    if (isTaskPrompt && choiceMatch) {
      captureSpan(line);
      continue;
    } else if (inTaskRun) {
      captureSpan(line);
      continue;
    }
    stemLines.push(line);
  }
  flushSub();

  const rawStem = stemLines.join(" ").replace(MARKS, "").trim();
  const contentBlocks = buildContentBlocks(rawStem);
  const text = contentBlocks
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join(" ")
    .trim();
  const kind = subTasks.length > 0 ? "long_answer" : guessKind(text, choices, marks);
  const subTaskLabels = subTasks.map((part) => part.label);
  const hasRepeatedSubTaskLabels = new Set(subTaskLabels).size < subTaskLabels.length;

  // Confidence, deducted for specific doubts rather than guessed at.
  let confidence = context.ocr ? 0.82 : 0.95;
  if (number === null) confidence -= 0.3;
  // Missing printed marks cost only a little on a scan: the scan itself is the
  // known uncertainty, and this paper prints no marks at all, which is a fact
  // about the paper rather than a misread. Flagging every scanned question
  // would bury the real "check me" cases in noise.
  if (marks === null) confidence -= context.ocr ? 0.02 : 0.08;
  if (kind === "multiple_choice" && choices.length < 2) confidence -= 0.25;
  if (diagrams.length > 0) confidence -= 0.1;
  if (hasRepeatedSubTaskLabels) confidence -= 0.18;
  if (text.length < 8) confidence -= 0.2;
  // A question whose body is mostly its own options has lost its stem.
  if (choices.length > 0 && text.length < 4) confidence -= 0.2;
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

  if (confidence < 0.5) {
    context.warnings.push(
      `Question ${number ?? index + 1} parsed poorly (confidence ${confidence}). It probably needs re-doing by hand.`,
    );
  }
  if (hasRepeatedSubTaskLabels) {
    context.warnings.push(
      `Question ${number ?? index + 1} has repeated part labels; check them against the original paper.`,
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
    tables: tables.length > 0 ? tables : undefined,
    contentBlocks: tables.length > 0 ? contentBlocks : undefined,
    subTasks: subTasks.length > 0 ? subTasks : undefined,
    diagrams,
    confidence,
    sourceText: block.lines.join("\n"),
    sourcePages: [...block.pages].sort((left, right) => left - right),
  };
}

function buildContentBlocks(rawStem: string): ExamContentBlock[] {
  const blocks: ExamContentBlock[] = [];
  const marker = /\u0001TABLE_(\d+)\u0001/g;
  let previousIndex = 0;
  for (const match of rawStem.matchAll(marker)) {
    const start = match.index ?? 0;
    const text = rawStem.slice(previousIndex, start).trim();
    if (text) blocks.push({ type: "text", text });
    blocks.push({ type: "table", tableIndex: Number(match[1]) });
    previousIndex = start + match[0].length;
  }
  const trailingText = rawStem.slice(previousIndex).trim();
  if (trailingText) blocks.push({ type: "text", text: trailingText });
  return blocks;
}

function extractTables(lines: string[]): {
  tables: ExamTable[];
  tableLineIndexes: Set<number>;
  tableStartIndexes: Map<number, number>;
} {
  const tables: ExamTable[] = [];
  const tableLineIndexes = new Set<number>();
  const tableStartIndexes = new Map<number, number>();
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].includes("\t")) {
      index++;
      continue;
    }
    const start = index;
    const rows: string[][] = [];
    while (index < lines.length && lines[index].includes("\t")) {
      const cells = lines[index].split("\t").map((cell) => cell.trim());
      if (cells.length < 2 || (rows.length > 0 && cells.length !== rows[0].length)) break;
      rows.push(cells);
      index++;
    }
    if (rows.length >= 2 && rows.reduce((count, row) => count + row.length, 0) >= 6) {
      for (let lineIndex = start; lineIndex < start + rows.length; lineIndex++) tableLineIndexes.add(lineIndex);
      tableStartIndexes.set(start, tables.length);
      const isNumeric = (value: string) => /^[+-]?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?%?$/.test(value);
      const headerRows =
        rows.length > 1 && rows[1].filter(isNumeric).length >= Math.ceil((rows[1].length - 1) / 2) ? 1 : 0;
      tables.push({ rows, headerRows });
    } else {
      index = Math.max(index, start + 1);
    }
  }
  return { tables, tableLineIndexes, tableStartIndexes };
}

/** Small stable hash, so re-parsing the same paper yields the same id. */
function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export type { MarkingStrategy };
export { strategyFor };
