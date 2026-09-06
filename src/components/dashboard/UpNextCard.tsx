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
}

/** Donezo "Reminders" pattern: the single most important next action + CTA. */
const UpNextCard = memo(function UpNextCard({ task }: { task: UpNextTask | null }) {
  return (
    <div className="card !p-4 sm:!p-5">
      <div className="panel-head !mb-3">
        <h2 className="panel-title">Up next</h2>
        {task &&
          (task.priority === "urgent" ? (
            <span className="badge badge-red">Urgent</span>
          ) : (
            <span className="badge badge-amber">Review</span>
          ))}
      </div>

      {task ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[17px] font-bold text-[var(--t1)] leading-snug tracking-tight">{task.label}</p>
            <p className="mt-1 text-xs text-[var(--t3)]">
              {task.priority === "urgent" ? "Needs action today." : "Worth a look when you have a moment."}
            </p>
          </div>
          <Link
            href={task.href}
            className="btn-pill btn-primary w-full sm:w-auto sm:min-w-[150px]"
            aria-label={`${task.cta}: ${task.label}`}
          >
            <MaterialIcon icon={task.icon} style={{ fontSize: 16 }} />
            {task.cta}
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 py-1">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--green-soft)] text-[var(--green)]"
            aria-hidden="true"
          >
            <MaterialIcon icon="check_circle" style={{ fontSize: 20 }} />
          </span>
          <span>
            <span className="block text-[14px] font-bold text-[var(--t1)]">All caught up</span>
            <span className="block text-xs text-[var(--t3)] mt-0.5">No urgent items right now.</span>
          </span>
        </div>
      )}
    </div>
  );
});

export default UpNextCard;
