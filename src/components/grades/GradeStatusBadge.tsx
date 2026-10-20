"use client";

import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  draft: "bg-[var(--amber-soft)] text-[var(--amber-ink)]",
  submitted: "bg-blue-50 text-blue-700",
  approved: "bg-[var(--green-soft)] text-[var(--green-ink)]",
};

const LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  published: "Published",
};

/** Mark-sheet workflow state for a pupil's row. */
export function GradeStatusBadge({ status }: { status?: string | null }) {
  const key = status || "draft";
  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black",
        STYLES[key] ?? "bg-surface-container text-on-surface-variant",
      )}
    >
      {LABELS[key] ?? "Published"}
    </span>
  );
}
