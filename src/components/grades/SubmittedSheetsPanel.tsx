"use client";
import * as React from "react";
import MaterialIcon from "@/components/MaterialIcon";
import type { GradeWorkflowStatus } from "@/lib/operations";

export interface SubmittedSheet {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  status: GradeWorkflowStatus;
  teacherName: string;
  markedCount: number;
}

interface SubmittedSheetsPanelProps {
  sheets: SubmittedSheet[];
  loading?: boolean;
  /** The next thing this person can do to a sheet, if anything. */
  nextAction: (sheet: SubmittedSheet) => { status: GradeWorkflowStatus; label: string } | null;
  onOpen: (sheet: SubmittedSheet) => void;
  onAdvance: (sheet: SubmittedSheet, status: GradeWorkflowStatus) => void;
  /** For a headmaster this is "Submitted for review"; for a teacher, "Your sheets". */
  heading: string;
  emptyHint: string;
}

const STATUS_LABEL: Record<GradeWorkflowStatus, string> = {
  draft: "Not submitted",
  submitted: "Submitted",
  approved: "Approved",
  published: "Published",
};

const STATUS_STYLE: Record<GradeWorkflowStatus, string> = {
  draft: "bg-[var(--surface-container-high)] text-[var(--t2)]",
  submitted: "bg-[var(--amber-soft,#fef3c7)] text-[var(--amber-ink,#92400e)]",
  approved: "bg-[var(--primary-50)] text-[var(--primary-700)]",
  published: "bg-[var(--green-soft,#dcfce7)] text-[var(--green-ink,#166534)]",
};

const FILTERS: Array<{ key: GradeWorkflowStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Not submitted" },
];

/**
 * The work that has been handed in.
 *
 * A headmaster does not enter marks. They are handed them, and the job is to
 * see what is waiting, who sent it, and to approve or publish it. The Grades
 * page used to open on the mark-entry form for everyone, so the headmaster
 * landed on a class picker and a subject list -- the teacher's job -- and had
 * no way to see the sheets that had been submitted to them at all.
 *
 * So this sits at the top of the page for the people who review, and the
 * entry form goes below it, behind its own heading.
 */
export default function SubmittedSheetsPanel({
  sheets,
  loading,
  nextAction,
  onOpen,
  onAdvance,
  heading,
  emptyHint,
}: SubmittedSheetsPanelProps) {
  const [active, setActive] = React.useState<GradeWorkflowStatus | "all">("all");

  const counts = React.useMemo(() => {
    const out: Record<string, number> = { all: sheets.length };
    for (const sheet of sheets) out[sheet.status] = (out[sheet.status] ?? 0) + 1;
    return out;
  }, [sheets]);

  const visible = active === "all" ? sheets : sheets.filter((s) => s.status === active);

  return (
    <section
      aria-label={heading}
      className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-[var(--t1)]">{heading}</h2>
        <span className="text-xs text-[var(--t3)]">
          {counts.submitted ? `${counts.submitted} waiting for you` : "Nothing waiting"}
        </span>
      </div>

      {/* Filters. The count of what is waiting is the number the headmaster
          came for, so it is on the chip, not behind the chip. */}
      <div className="-mx-1 mb-3 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2 px-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActive(f.key)}
              aria-pressed={active === f.key}
              className={`min-h-11 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                active === f.key
                  ? "bg-[var(--primary)] text-[var(--on-primary)]"
                  : "bg-[var(--surface-container)] text-[var(--t2)]"
              }`}
            >
              {f.label}
              {counts[f.key] ? <span className="ml-1 opacity-70">({counts[f.key]})</span> : null}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-4 text-sm text-[var(--t3)]">Loading the sheets that have been handed in…</p>
      ) : visible.length === 0 ? (
        <p className="py-4 text-sm text-[var(--t3)]">{emptyHint}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((sheet) => {
            const action = nextAction(sheet);
            return (
              <li
                key={`${sheet.classId}:${sheet.subjectId}`}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-container-lowest)] px-3 py-2.5"
              >
                <button type="button" onClick={() => onOpen(sheet)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-bold text-[var(--t1)]">
                    {sheet.className} · {sheet.subjectName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--t3)]">
                    {sheet.teacherName} · {sheet.markedCount} marked
                  </span>
                </button>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${STATUS_STYLE[sheet.status]}`}
                >
                  {STATUS_LABEL[sheet.status]}
                </span>
                {action && (
                  <button
                    type="button"
                    onClick={() => onAdvance(sheet, action.status)}
                    className="min-h-11 shrink-0 rounded-xl bg-[var(--primary)] px-3 text-sm font-bold text-white"
                  >
                    {action.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
