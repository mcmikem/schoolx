"use client";

import type { PDFPageProxy } from "pdfjs-dist";

import type { DiagramCrop } from "./exam-model";
import { rebuildLayout } from "./pdf-lines";

/**
 * PDF → text, entirely in the browser.
 *
 * Two paths, tried in order:
 *
 * 1. The PDF's own text layer, read with pdf.js. What a digital PDF gives you,
 *    and the only path that preserves the exact characters.
 *
 * 2. OCR, for the scans that make up most of what schools actually have. Pages
 *    are rendered to a canvas and read by Tesseract running locally. No CDN, no
 *    server, and no paper leaves the browser -- which matters, because a pupil's
 *    exam is not a thing to hand to a third-party API by default.
 *
 * Path 2 is slower by orders of magnitude and less accurate, and the caller is
 * expected to say which path was used rather than presenting OCR output as if
 * it had been read from the file.
 *
 * All runtime assets are served same-origin from `public/vendor/`. A CDN would
 * be blocked by the app's CSP anyway, and a school's connection should not be
 * part of the parser's dependencies.
 */

// Served with a .js name: the dev server 307s bare .mjs paths, and pdf.js
// only needs the bytes to be valid JavaScript to start a module worker.
const PDFJS_WORKER = "/vendor/pdfjs/pdf.worker.min.js";

const TESSERACT = {
  workerPath: "/vendor/tesseract/worker.min.js",
  corePath: "/vendor/tesseract",
  /** Directory holding eng.traineddata.gz (~2 MB, loaded once per session). */
  langPath: "/vendor/tesseract/tessdata",
};

export interface ExtractionResult {
  text: string;
  /** Text split by original PDF page, for locating questions in the source. */
  pageTexts: string[];
  /** "text layer" when read from the PDF itself; "ocr" when read from pixels. */
  method: "text layer" | "ocr";
  pages: number;
  /** True when a large scan needs a teacher to select a smaller page range. */
  needsPageSelection?: boolean;
  /** Page range processed by OCR when a subset was requested. */
  pagesRead?: { start: number; end: number };
  /** Compressed source-page images for retaining scanned diagrams. */
  pageImages?: Record<number, string>;
  /** Figure regions cut from the page images, ready for the parser. */
  diagramCrops?: DiagramCrop[];
  /** Human-readable progress for the OCR path, which can take a while. */
  progress?: (message: string) => void;
}

/**
 * Minimum number of characters per page for the text layer to be trusted.
 *
 * A scanned PDF often carries a token text layer -- a page number, a footer --
 * and treating that as "digital" would silently parse a paper made of nothing.
 * Below this the pages go to OCR.
 */
const MIN_CHARS_PER_PAGE = 40;
const MAX_AUTO_OCR_PAGES = 10;
const MAX_OCR_RANGE_PAGES = 10;
/** Rendering scale: 2 turns a 72 dpi PDF page into ~144 dpi pixels. */
const RENDER_SCALE = 2;

/** A page worth looking at for a figure, before it is rendered to pixels. */
function needsDiagramPage(text: string): boolean {
  return /\b(?:fig(?:ure)?\.?\s*\d|diagram|circuit|shown\s+(?:below|above)|apparatus)\b/i.test(text);
}

export interface WordBox {
  text: string;
  /** Canvas pixels, top-left origin. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface FigureWord extends WordBox {
  /** The printed figure number, when the caption carries one. */
  number: number | null;
}

/**
 * Cut figure regions out of a rendered page.
 *
 * Captions are the only reliable anchor text gives us: "Figure 4." sits under
 * the drawing it names. The drawing is therefore the band above the caption,
 * bounded at the top by the nearest prose line (labels around a figure are
 * short, a paragraph is not) and split horizontally when two captions share a
 * line, as a paper printing two diagrams side by side does.
 *
 * Nothing is invented: a page without a caption yields no crop and the caller
 * keeps the full page as an honest fallback.
 */
export interface FigureCropRegion {
  page: number;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function findFigureCropRegions(
  words: WordBox[],
  pageWidth: number,
  pageHeight: number,
  page: number,
): FigureCropRegion[] {
  if (words.length === 0) return [];

  const heights = words
    .map((word) => word.y1 - word.y0)
    .filter((height) => height > 0)
    .sort((left, right) => left - right);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 12;
  const tolerance = Math.max(4, medianHeight * 0.7);

  const lines: WordBox[][] = [];
  let current: WordBox[] = [];
  let currentY = Number.NaN;
  for (const word of [...words].sort((left, right) => left.y0 - right.y0 || left.x0 - right.x0)) {
    const centre = (word.y0 + word.y1) / 2;
    if (Number.isNaN(currentY) || Math.abs(centre - currentY) > tolerance) {
      if (current.length > 0) lines.push(current);
      current = [word];
      currentY = centre;
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) lines.push(current);
  for (const line of lines) line.sort((left, right) => left.x0 - right.x0);

  const captions: FigureWord[] = [];
  for (const line of lines) {
    line.forEach((word, index) => {
      const match = word.text.match(/^(?:fig(?:ure)?|diagram)[.,:]?\s*(\d{1,2})?[.,:]?$/i);
      if (!match) return;
      // "diagram" mid-sentence is prose ("the circuit diagram in class"), not
      // a caption. A bare "Diagram" label owns its line.
      if (!/^fig/i.test(word.text) && line.length > 2) return;
      const next = line[index + 1];
      const number = match[1]
        ? Number(match[1])
        : next && /^(\d{1,2})[.,:]?$/.test(next.text)
          ? Number(next.text.replace(/\D/g, ""))
          : null;
      captions.push({ ...word, number });
    });
  }
  if (captions.length === 0) return [];

  const regions: FigureCropRegion[] = [];
  for (const caption of captions) {
    const lineIndex = lines.findIndex((line) => line.some((word) => word.x0 === caption.x0 && word.y0 === caption.y0));
    if (lineIndex < 0) continue;
    const captionLine = lines[lineIndex];
    const onSameLine = captions.filter((candidate) =>
      captionLine.some((word) => word.x0 === candidate.x0 && word.y0 === candidate.y0),
    );
    const position = onSameLine.findIndex((candidate) => candidate.x0 === caption.x0);
    const previous = position > 0 ? onSameLine[position - 1] : null;
    const next = position >= 0 && position < onSameLine.length - 1 ? onSameLine[position + 1] : null;

    const captionTop = Math.min(...captionLine.map((word) => word.y0));
    const captionBottom = Math.max(...captionLine.map((word) => word.y1));
    const left = previous ? (previous.x0 + caption.x0) / 2 : 0;
    const right = next ? (caption.x0 + next.x0) / 2 : pageWidth;

    // The nearest paragraph above bounds the drawing. A paragraph ends in
    // punctuation; the short labels and aligned rows that belong to the figure
    // do not. Prefer that end so a table printed as part of the diagram (a
    // transformer's turns, say) is kept inside the crop instead of being taken
    // for body text and cut off.
    const isBodyEnd = (line: WordBox[]) => {
      const text = line.map((word) => word.text).join(" ");
      if (/^(?:figure|fig\.?|diagram)\b/i.test(text)) return false;
      return /[.!?]$/.test(text) && line.length >= 3;
    };
    const isBodyLine = (line: WordBox[]) => {
      const lineWidth = Math.max(...line.map((word) => word.x1)) - Math.min(...line.map((word) => word.x0));
      return line.length >= 5 || lineWidth > pageWidth * 0.45;
    };
    let top = Math.max(0, captionTop - pageHeight * 0.4);
    let bodyLineIndex = -1;
    for (let above = lineIndex - 1; above >= 0; above--) {
      if (isBodyEnd(lines[above])) {
        bodyLineIndex = above;
        break;
      }
    }
    if (bodyLineIndex < 0) {
      for (let above = lineIndex - 1; above >= 0; above--) {
        if (isBodyLine(lines[above])) {
          bodyLineIndex = above;
          break;
        }
      }
    }
    if (bodyLineIndex >= 0) {
      top = Math.max(0, Math.max(...lines[bodyLineIndex].map((word) => word.y1)) + medianHeight * 0.4);
    }
    const bottom = Math.min(pageHeight, captionBottom + medianHeight * 0.6);

    const width = right - left;
    const height = bottom - top;
    // A sliver is a caption misread, not a figure. Leave those to the page
    // fallback rather than ship a strip of blank paper.
    if (width < pageWidth * 0.2 || height < medianHeight * 3) continue;

    regions.push({
      page,
      label: caption.number !== null ? `figure ${caption.number} on page ${page}` : `figure on page ${page}`,
      left,
      top,
      width,
      height,
    });
  }
  return regions;
}

function findFigureCrops(canvas: HTMLCanvasElement, words: WordBox[], page: number): DiagramCrop[] {
  return findFigureCropRegions(words, canvas.width, canvas.height, page).flatMap((region) => {
    const cropped = document.createElement("canvas");
    cropped.width = Math.round(region.width);
    cropped.height = Math.round(region.height);
    const context = cropped.getContext("2d");
    if (!context) return [];
    context.drawImage(canvas, region.left, region.top, region.width, region.height, 0, 0, region.width, region.height);
    return [{ page, label: region.label, imageDataUri: cropped.toDataURL("image/jpeg", 0.82) }];
  });
}

export interface PdfPageRange {
  start: number;
  end: number;
}

export async function extractTextFromPdf(
  data: ArrayBuffer,
  options: Pick<ExtractionResult, "progress"> & { pageRange?: PdfPageRange } = {},
): Promise<ExtractionResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = doc.numPages;

  const pageTexts = Array.from({ length: pages }, () => "");
  const textPageImages: Record<number, string> = {};
  const diagramCrops: DiagramCrop[] = [];
  let textLayerChars = 0;
  const selectedStart = options.pageRange ? Math.max(1, Math.floor(options.pageRange.start)) : 1;
  const selectedEnd = options.pageRange ? Math.min(pages, Math.floor(options.pageRange.end)) : pages;
  if (selectedEnd < selectedStart) {
    throw new Error("Choose an ending page that is the same as or after the starting page.");
  }
  if (options.pageRange && selectedEnd - selectedStart + 1 > MAX_OCR_RANGE_PAGES) {
    throw new Error(`Read at most ${MAX_OCR_RANGE_PAGES} scanned pages at a time.`);
  }

  // A selected range should never inspect the rest of a large book. Check its
  // own text layer first so digital pages stay exact without scanning 140 pages.
  const probePages = pages > MAX_AUTO_OCR_PAGES ? Math.min(pages, 3) : pages;
  const textStart = options.pageRange ? selectedStart : 1;
  const textEnd = options.pageRange ? selectedEnd : pages;
  for (let i = textStart; i <= textEnd; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Runs are rejoined into visual lines first. The naive one-newline-per-run
    // join shreds anything laid out as a table, and this PDF's questions
    // routinely sit in cells: the paper walks out of extraction unreadable.
    const positioned = content.items.flatMap((item) =>
      item && typeof item === "object" && "str" in item
        ? [
            {
              str: item.str,
              x: item.transform[4],
              y: item.transform[5],
              width: item.width,
              height: item.height,
            },
          ]
        : [],
    );
    const text = rebuildLayout(positioned);
    pageTexts[i - 1] = text;
    textLayerChars += text.length;
    if (needsDiagramPage(text)) {
      const canvas = await renderToCanvas(page);
      textPageImages[i] = canvas.toDataURL("image/jpeg", 0.72);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const words = positioned
        .filter((item) => item.str.trim().length > 0)
        .map((item) => {
          const [left, baseline] = viewport.convertToViewportPoint(item.x, item.y);
          return {
            text: item.str.trim(),
            x0: left,
            y0: baseline - item.height * viewport.scale,
            x1: left + item.width * viewport.scale,
            y1: baseline,
          };
        });
      diagramCrops.push(...findFigureCrops(canvas, words, i));
    } else {
      page.cleanup();
    }
    if (
      !options.pageRange &&
      i === probePages &&
      pages > MAX_AUTO_OCR_PAGES &&
      textLayerChars / probePages < MIN_CHARS_PER_PAGE
    ) {
      return {
        text: "",
        pageTexts: Array.from({ length: pages }, () => ""),
        method: "ocr",
        pages,
        needsPageSelection: true,
      };
    }
  }

  const pagesToRead = textEnd - textStart + 1;
  if (textLayerChars / pagesToRead >= MIN_CHARS_PER_PAGE) {
    return {
      text: pageTexts.filter(Boolean).join("\n\n"),
      pageTexts,
      method: "text layer",
      pages,
      ...(options.pageRange ? { pagesRead: { start: textStart, end: textEnd } } : {}),
      ...(Object.keys(textPageImages).length > 0 ? { pageImages: textPageImages } : {}),
      ...(diagramCrops.length > 0 ? { diagramCrops } : {}),
    };
  }

  if (pages > MAX_AUTO_OCR_PAGES && !options.pageRange) {
    return {
      text: "",
      pageTexts: Array.from({ length: pages }, () => ""),
      method: "ocr",
      pages,
      needsPageSelection: true,
    };
  }

  const start = selectedStart;
  const end = selectedEnd;

  // Not enough text: these are rendered pixels. Say so, then read them.
  options.progress?.(
    `This PDF has little or no embedded text (${textLayerChars} characters over ${pages} page${pages === 1 ? "" : "s"}), so it is being read as a scanned image.`,
  );
  const ocrText = Array.from({ length: pages }, () => "");
  const pageImages: Record<number, string> = {};
  const scanCrops: DiagramCrop[] = [];
  for (let i = start; i <= end; i++) {
    options.progress?.(`Reading page ${i} of ${pages}...`);
    const page = await doc.getPage(i);
    const canvas = await renderToCanvas(page);
    pageImages[i] = canvas.toDataURL("image/jpeg", 0.72);
    const recognised = await recognise(canvas, options.progress);
    ocrText[i - 1] = recognised.text;
    scanCrops.push(...findFigureCrops(canvas, recognised.words, i));
  }

  return {
    text: ocrText.filter(Boolean).join("\n\n"),
    pageTexts: ocrText,
    method: "ocr",
    pages,
    pagesRead: { start, end },
    pageImages,
    ...(scanCrops.length > 0 ? { diagramCrops: scanCrops } : {}),
  };
}

async function renderToCanvas(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  // Scale 2 turns a 72 dpi PDF page into ~144 dpi pixels: enough for Tesseract
  // to pick up question numbers, at a size that keeps a 10-page paper under a
  // couple of minutes on a school laptop.
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not create a canvas to render the page onto.");
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas;
}

/** One shared Tesseract worker for the whole session; it is expensive to make. */
let workerPromise: Promise<{
  recognise: (image: HTMLCanvasElement) => Promise<{
    data: {
      text: string;
      blocks?: Array<{
        paragraphs?: Array<{
          lines?: Array<{ words?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }>;
        }>;
      }> | null;
    };
  }>;
  terminate: () => Promise<unknown>;
}> | null = null;

async function recognise(
  canvas: HTMLCanvasElement,
  progress?: (message: string) => void,
): Promise<{ text: string; words: WordBox[] }> {
  const tesseract = await import("tesseract.js");
  workerPromise ??= tesseract.createWorker("eng", 1, TESSERACT).then((worker) => ({
    recognise: (image: HTMLCanvasElement) => worker.recognize(image),
    terminate: () => worker.terminate(),
  }));
  const worker = await workerPromise;
  try {
    const { data } = await worker.recognise(canvas);
    const words: WordBox[] =
      data.blocks?.flatMap((block) =>
        (block.paragraphs ?? []).flatMap((paragraph) =>
          (paragraph.lines ?? []).flatMap((line) =>
            (line.words ?? [])
              .filter((word) => word.text.trim().length > 0)
              .map((word) => ({
                text: word.text.trim(),
                x0: word.bbox.x0,
                y0: word.bbox.y0,
                x1: word.bbox.x1,
                y1: word.bbox.y1,
              })),
          ),
        ),
      ) ?? [];
    return { text: data.text.trim(), words };
  } catch (error) {
    progress?.(
      `A page failed to read (${error instanceof Error ? error.message : String(error)}). Its text will be missing.`,
    );
    return { text: "", words: [] };
  }
}
