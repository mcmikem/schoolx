"use client";
import Link from "next/link";
import { memo } from "react";
import MaterialIcon from "@/components/MaterialIcon";

export interface UpNextTask {
  label: string;
  icon: string;
  priority: string;
  href: string;
  cta: string;
  secondary?: { label: string; onClick: () => void };
}

/** The one anchor panel on the dashboard: the single most important next action. */
const UpNextCard = memo(function UpNextCard({ task }: { task: UpNextTask | null }) {
  return (
    <section
      aria-labelledby="up-next-title"
      className="overflow-hidden rounded-3xl bg-[var(--bot-navy)] text-white shadow-sm"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="up-next-title" className="text-xs font-medium uppercase tracking-wide text-blue-100">
            Up next
          </h2>
          {task && (
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              {task.priority === "urgent" ? "Urgent" : "Review"}
            </span>
          )}
        </div>

        {task ? (
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xl font-bold leading-snug tracking-tight">{task.label}</p>
              <p className="mt-1 text-sm text-blue-100">
                {task.priority === "urgent" ? "Needs action today." : "Worth a look when you have a moment."}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              {task.secondary && (
                <button
                  type="button"
                  onClick={task.secondary.onClick}
                  className="min-h-11 rounded-full border border-white/25 px-4 text-xs font-semibold text-white transition-colors hover:bg-white/10"
                >
                  {task.secondary.label}
                </button>
              )}
              <Link
                href={task.href}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-xs font-bold text-[#123c35] transition-colors hover:bg-blue-50 sm:w-auto sm:min-w-[150px]"
                aria-label={`${task.cta}: ${task.label}`}
              >
                <MaterialIcon icon={task.icon} style={{ fontSize: 16 }} />
                {task.cta}
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3 py-1">
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
              aria-hidden="true"
            >
              <MaterialIcon icon="check_circle" style={{ fontSize: 20 }} />
            </span>
            <span>
              <span className="block text-[14px] font-bold">All caught up</span>
              <span className="mt-0.5 block text-xs text-blue-100">No urgent items right now.</span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
});

export default UpNextCard;
