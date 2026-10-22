"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

const PDFJS_WORKER = "/vendor/pdfjs/pdf.worker.min.js";

export default function PdfSourceViewer({
  url,
  data,
  initialPage = 1,
}: {
  url?: string;
  data?: ArrayBuffer;
  initialPage?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    const loadDocument = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        if (!data && !url) throw new Error("No PDF source was provided");
        const task = data
          ? pdfjs.getDocument({ data: data.slice(0) })
          : pdfjs.getDocument({ url: url!, disableStream: true, disableAutoFetch: true });
        loadingTask = task;
        const document = await task.promise;
        if (!cancelled) {
          setDocumentProxy(document);
          setPageCount(document.numPages);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          logger.error("Could not open original exam PDF:", cause);
          setError("This paper could not be opened. Check your connection and try again.");
        }
      }
    };
    setDocumentProxy(null);
    void loadDocument();
    return () => {
      cancelled = true;
      setDocumentProxy(null);
      void loadingTask?.destroy();
    };
  }, [url, data]);

  useEffect(() => setPage(Math.max(1, initialPage)), [initialPage]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    const renderPage = async () => {
      try {
        if (!documentProxy) return;
        const pageNumber = Math.max(1, Math.min(page, documentProxy.numPages));
        if (pageNumber !== page) setPage(pageNumber);
        const pdfPage = await documentProxy.getPage(pageNumber);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const width = Math.max(240, canvas.parentElement?.clientWidth ?? 640);
        const scale = Math.min(1.5, width / base.width) * zoom;
        const viewport = pdfPage.getViewport({ scale });
        const pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
        if (!cancelled) {
          setError(null);
        }
      } catch {
        if (!cancelled) setError("This page could not be shown. Try opening the original PDF instead.");
      }
    };
    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [documentProxy, page, zoom]);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-gray-300 bg-gray-100 p-2 sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold disabled:opacity-50"
        >
          Previous page
        </button>
        <span aria-live="polite" className="text-sm font-semibold text-gray-700">
          Page {page}
          {pageCount ? ` of ${pageCount}` : ""}
        </span>
        <button
          type="button"
          disabled={pageCount > 0 && page >= pageCount}
          onClick={() => setPage((current) => Math.min(pageCount || current + 1, current + 1))}
          className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold disabled:opacity-50"
        >
          Next page
        </button>
      </div>
      <div className="mb-2 flex justify-end gap-2">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= 1}
          onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
          className="min-h-11 min-w-11 rounded-lg border border-gray-300 bg-white text-lg disabled:opacity-50"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= 2}
          onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
          className="min-h-11 min-w-11 rounded-lg border border-gray-300 bg-white text-lg disabled:opacity-50"
        >
          +
        </button>
      </div>
      {error ? (
        <p role="alert" className="p-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex max-h-[72vh] justify-center overflow-auto">
        <canvas ref={canvasRef} aria-label={`Original exam page ${page}`} className="h-auto shadow-md" />
      </div>
      <p className="mt-2 text-center text-xs text-gray-600">
        Original page shown as printed. Use + to read small details.
      </p>
    </div>
  );
}
