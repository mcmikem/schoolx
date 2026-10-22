"use client";

import type { PDFPageProxy } from "pdfjs-dist";

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
  /** "text layer" when read from the PDF itself; "ocr" when read from pixels. */
  method: "text layer" | "ocr";
  pages: number;
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

export async function extractTextFromPdf(
  data: ArrayBuffer,
  options: Pick<ExtractionResult, "progress"> = {},
): Promise<ExtractionResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = doc.numPages;

  // Text layer first: cheap, exact, and quick to reject.
  const pageTexts: string[] = [];
  let textLayerChars = 0;
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Runs are rejoined into visual lines first. The naive one-newline-per-run
    // join shreds anything laid out as a table, and this PDF's questions
    // routinely sit in cells: the paper walks out of extraction unreadable.
    const text = rebuildLayout(
      content.items.flatMap((item) =>
        item && typeof item === "object" && "str" in item
          ? [{ str: item.str, x: item.transform[4], y: item.transform[5] }]
          : [],
      ),
    );
    pageTexts.push(text);
    textLayerChars += text.length;
    page.cleanup();
  }

  if (textLayerChars / pages >= MIN_CHARS_PER_PAGE) {
    return { text: pageTexts.join("\n\n"), method: "text layer", pages };
  }

  // Not enough text: these are rendered pixels. Say so, then read them.
  options.progress?.(
    `This PDF has little or no embedded text (${textLayerChars} characters over ${pages} page${pages === 1 ? "" : "s"}), so it is being read as a scanned image.`,
  );
  const ocrText: string[] = [];
  for (let i = 1; i <= pages; i++) {
    options.progress?.(`Reading page ${i} of ${pages}...`);
    const page = await doc.getPage(i);
    const canvas = await renderToCanvas(page);
    ocrText.push(await recognise(canvas, options.progress));
  }

  return { text: ocrText.join("\n\n"), method: "ocr", pages };
}

async function renderToCanvas(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  // Scale 2 turns a 72 dpi PDF page into ~144 dpi pixels: enough for Tesseract
  // to pick up question numbers, at a size that keeps a 10-page paper under a
  // couple of minutes on a school laptop.
  const viewport = page.getViewport({ scale: 2 });
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
  recognise: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
}> | null = null;

async function recognise(canvas: HTMLCanvasElement, progress?: (message: string) => void) {
  const tesseract = await import("tesseract.js");
  workerPromise ??= tesseract.createWorker("eng", 1, TESSERACT).then((worker) => ({
    recognise: (image: HTMLCanvasElement) => worker.recognize(image),
    terminate: () => worker.terminate(),
  }));
  const worker = await workerPromise;
  try {
    const { data } = await worker.recognise(canvas);
    return data.text.trim();
  } catch (error) {
    progress?.(
      `A page failed to read (${error instanceof Error ? error.message : String(error)}). Its text will be missing.`,
    );
    return "";
  }
}
