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
}

/** How far apart two runs' vertical positions can be and still share a line. */
const LINE_TOLERANCE = 3;

export function rebuildLayout(items: PositionedItem[]): string {
  const runs = items
    // Whitespace-only runs carry position but no content; a blank gap is
    // preserved by the space inserted between real neighbours.
    .filter((item) => item.str.trim().length > 0)
    .sort((a, b) => {
      // Same visual line (to tolerance): read left to right. Different line:
      // top of the page first. y grows downward in a few conventions; callers
      // pass pdf.js transforms, where larger y is higher up the page.
      if (Math.abs(a.y - b.y) > LINE_TOLERANCE) return b.y - a.y;
      return a.x - b.x;
    });

  const lines: string[] = [];
  let current: PositionedItem[] = [];
  let currentY = Number.NaN;

  for (const run of runs) {
    if (Number.isNaN(currentY) || Math.abs(currentY - run.y) > LINE_TOLERANCE) {
      if (current.length > 0) lines.push(joinLine(current));
      current = [run];
      // A row keeps the y of its first run so that runs which sit within
      // tolerance of one another do not drift rows run after run.
      currentY = run.y;
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
  return runs
    .map((run) => run.str.trim())
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
