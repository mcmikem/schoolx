"use client";

import { useEffect, useState } from "react";
import { reportClientError } from "@/lib/report-client-error";

interface Props {
  error: Error & { digest?: string };
  source: string;
  className?: string;
}

/**
 * Human-readable crash details on every error screen.
 *
 * The generic "something went wrong" card used to be all a user could send us,
 * which made first-launch failures impossible to diagnose. The message, path,
 * browser and digest are now visible (and copyable), and the same payload is
 * posted to /api/client-error/ once so it is in the database even if the person
 * never sends a screenshot.
 */
export function ErrorDetails({ error, source, className }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    reportClientError(error, source);
  }, [error, source]);

  const details = [
    `Message: ${error?.message || error?.name || "Unknown error"}`,
    error?.digest ? `Digest: ${error.digest}` : null,
    typeof window !== "undefined" ? `Path: ${window.location.pathname}` : null,
    typeof navigator !== "undefined" ? `Browser: ${navigator.userAgent}` : null,
    error?.stack ? `Stack:\n${error.stack}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(details);
      } else {
        const area = document.createElement("textarea");
        area.value = details;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions, insecure context). The details
      // are already on screen; do not show a second failure.
    }
  };

  return (
    <div className={className ?? "w-full"}>
      <p className="text-sm font-medium text-gray-700 break-words mb-3">
        {(error?.message || "An unexpected error occurred.").slice(0, 300)}
      </p>
      {(error?.digest || error?.stack) && (
        <details className="text-left mb-4 rounded-lg border border-gray-200 bg-white/60 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-gray-600">Error details</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-500">
            {error.digest ? `Digest: ${error.digest}\n` : ""}
            {error.stack || error.message}
          </pre>
        </details>
      )}
      <button
        type="button"
        onClick={copy}
        className="text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-700 mb-4"
      >
        {copied ? "Copied" : "Copy error details for support"}
      </button>
    </div>
  );
}
