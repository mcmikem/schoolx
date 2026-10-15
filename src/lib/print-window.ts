/**
 * Printing helpers for report cards, ID cards and staff records.
 *
 * Every one of those printers used to do this:
 *
 *   win.document.open();
 *   // clone the app's <link>/<style> into the new window
 *   win.document.body.innerHTML = html;
 *   win.document.close();
 *   win.print();
 *
 * which never worked. document.open() resets the document, and Chrome leaves
 * document.body null until something has been written or the document closed,
 * so the assignment threw a TypeError. The popup stayed on about:blank and
 * print() was never reached -- the user got an empty tab and no PDF, with no
 * error surfaced anywhere.
 *
 * Writing one complete document fixes that, and has two further benefits: the
 * printed page no longer inherits whatever @media print rules the app happens
 * to be serving (globals-ux.css hides .topbar/.sidebar/.mobile-bottom-nav, which
 * is right for a page print and wrong here), and the output is identical on
 * every browser rather than depending on stylesheet cloning.
 */

export interface PrintDocumentOptions {
  /** Extra CSS for the printed page. Kept explicit so output never drifts. */
  styles?: string;
  /** @page rule, e.g. "A4" or "A4 landscape". Defaults to A4 portrait. */
  page?: string;
  /**
   * Markup for <head>. Used where the printed content is lifted from live DOM
   * and so needs the app's stylesheets to look right -- pass the outerHTML of
   * the document's <link rel="stylesheet"> elements.
   */
  headHtml?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildDocument(title: string, bodyHtml: string, options: PrintDocumentOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${options.headHtml ?? ""}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "DM Sans", "Segoe UI", Arial, Helvetica, sans-serif;
    color: #000;
    padding: 16px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table { border-collapse: collapse; }
  img { max-width: 100%; }
  @page { size: ${options.page ?? "A4"}; margin: 12mm; }
${options.styles ?? ""}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Open the print window. Must be called synchronously from a click handler --
 * pop-up blockers reject window.open() once an await has passed, which is why
 * async printers used to fail silently (a null return, no error, no PDF).
 * Returns null when blocked so callers can tell the user instead of hanging.
 */
export function openPrintWindow(): Window | null {
  return window.open("", "_blank");
}

/** Write a complete, self-contained document into an already-open window. */
export function writePrintDocument(
  target: Window,
  title: string,
  bodyHtml: string,
  options: PrintDocumentOptions = {},
): void {
  const doc = target.document;
  doc.open();
  doc.write(buildDocument(title, bodyHtml, options));
  doc.close();
}

/** Wait for images so they are not missing from the PDF, then open the dialog. */
export async function printWhenReady(target: Window, timeoutMs = 8000): Promise<void> {
  const doc = target.document;
  const images = Array.from(doc.images);
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
          setTimeout(done, timeoutMs);
        }),
    ),
  );
  // Let layout settle before handing off to the print dialog.
  await new Promise((resolve) => setTimeout(resolve, 50));
  target.focus();
  target.print();
}

/**
 * Open, write and print in one step. Synchronous up to the point the window
 * exists, so it is safe to call from a click handler.
 */
export function printDocument(
  title: string,
  bodyHtml: string,
  options: PrintDocumentOptions = {},
): boolean {
  const target = openPrintWindow();
  if (!target) return false;
  writePrintDocument(target, title, bodyHtml, options);
  void printWhenReady(target);
  return true;
}