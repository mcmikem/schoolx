/**
 * PDF text items -> lines of text, by visual position.
 *
 * A PDF does not store lines; it stores positioned text runs, and a paper laid
 * out with tables (and even columned body text) yields one run per cell or
 * fragment. Joining runs with newline characters -- the naive extraction --
 * shreds the document: the line holding "4." is not the line holding the
 * question text, every table cell becomes its own paragraph, and the parser
 * below stream sees a paper nobody wrote.
 *
 * Rebuilding the page's visual lines first is therefore not cosmetic: it is
 * what makes structured reading possible at all. Runs are grouped by y
 * coordinate into rows, ordered within a row by x, and joined with single
 * spaces; rows join with newlines, paragraphs' separation having already been
 * destroyed. Left with <lines> of plain text, the paper reads in roughly the
 * order a person reading it top-left to bottom-right would.
 */

export interface PositionedItem {
  str: string;
  /** Horizontal position on the page, in whichever unit the caller supplies. */
  x: number;
  /** Vertical position; larger values sit higher up the page. */
  y: number;
  /** Width of the text run, used to retain large inter-column gaps. */
  width?: number;
  /** Text height in page units, used to scale the column-gap threshold. */
  height?: number;
}

/** How far apart two runs' vertical positions can be and still share a line. */
const MIN_LINE_TOLERANCE = 3;
const MAX_LINE_TOLERANCE = 6;

/**
 * A scanned page is rarely square to the glass: a one-degree tilt lifts a word
 * at the right margin almost a full line above a word at the left. Grouping on
 * raw `y` then mixes words from two visual lines, the joined text comes out as
 * ragged column fragments, and every such fragment looks like a table cell.
 *
 * Estimate the page's tilt from the text itself, then cluster on the corrected
 * baseline. The projection that makes the most runs share a horizontal line is
 * the tilt; no extra metadata is needed, and a perfectly square page estimates
 * zero.
 */
function estimateSkew(items: PositionedItem[]): number {
  if (items.length < 4) return 0;
  const xs = items.map((item) => item.x);
  if (Math.max(...xs) - Math.min(...xs) < 40) return 0;

  let bestAngle = 0;
  let bestScore = -1;
  for (let degrees = -5; degrees <= 5; degrees += 0.25) {
    const slope = Math.tan((degrees * Math.PI) / 180);
    const bins = new Map<number, number>();
    for (const item of items) {
      const bucket = Math.round((item.y + item.x * slope) / 2);
      bins.set(bucket, (bins.get(bucket) ?? 0) + 1);
    }
    let score = 0;
    for (const count of bins.values()) score += count * count;
    if (score > bestScore) {
      bestScore = score;
      bestAngle = degrees;
    }
  }
  return bestAngle;
}

function lineTolerance(items: PositionedItem[]): number {
  const heights = items
    .map((item) => item.height)
    .filter((height): height is number => typeof height === "number" && height > 0)
    .sort((left, right) => left - right);
  if (heights.length === 0) return MIN_LINE_TOLERANCE;
  const median = heights[Math.floor(heights.length / 2)];
  return Math.min(MAX_LINE_TOLERANCE, Math.max(MIN_LINE_TOLERANCE, median * 0.6));
}

export function rebuildLayout(items: PositionedItem[]): string {
  // Whitespace-only runs carry position but no content; a blank gap is
  // preserved by the space inserted between real neighbours.
  const filtered = items.filter((item) => item.str.trim().length > 0);
  const skew = estimateSkew(filtered);
  const slope = Math.tan((skew * Math.PI) / 180);
  const tolerance = lineTolerance(filtered);

  const runs = filtered
    .map((item) => ({ ...item, baseline: item.y + item.x * slope }))
    .sort((a, b) => {
      // Same visual line (to tolerance): read left to right. Different line:
      // top of the page first. y grows downward in a few conventions; callers
      // pass pdf.js transforms, where larger y is higher up the page.
      if (Math.abs(a.baseline - b.baseline) > tolerance) return b.baseline - a.baseline;
      return a.x - b.x;
    });

  const lines: string[] = [];
  let current: PositionedItem[] = [];
  let currentY = Number.NaN;

  for (const run of runs) {
    if (Number.isNaN(currentY) || Math.abs(currentY - run.baseline) > tolerance) {
      if (current.length > 0) lines.push(joinLine(current));
      current = [run];
      // A row keeps the baseline of its first run so that runs which sit within
      // tolerance of one another do not drift rows run after run.
      currentY = run.baseline;
      continue;
    }
    current.push(run);
  }
  if (current.length > 0) lines.push(joinLine(current));

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function joinLine(runs: PositionedItem[]): string {
  return runs.reduce((line, run, index) => {
    const content = run.str.trim();
    if (!content) return line;
    if (index === 0) return content;

    const previous = runs[index - 1];
    const gap = run.x - (previous.x + (previous.width ?? 0));
    const height = run.height ?? previous.height;
    const threshold = height === undefined ? 24 : Math.max(8, height * 0.7);
    const followsQuestionNumber = /^\d{1,2}[.)]$/.test(previous.str.trim());
    return `${line}${!followsQuestionNumber && gap >= threshold ? "\t" : " "}${content}`;
  }, "");
}
