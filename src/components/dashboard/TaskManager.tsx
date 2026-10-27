"use client";
import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

interface Task {
  id: string;
  label: string;
  icon: string;
  priority: "urgent" | "attention" | "normal";
  href: string;
  cta: string;
  /** Problem-motivating action that does not navigate: e.g. WhatsApp the
   *  class teachers instead of just sending the headmaster to a screen. */
  secondary?: { label: string; onClick: () => void };
}

export default function TaskManager({
  tasks,
  emptyMessage = "All clear! No pending tasks.",
  variant = "cards",
}: {
  tasks: Task[];
  emptyMessage?: string;
  variant?: "cards" | "list";
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-[var(--r)] border border-dashed border-[var(--border)] bg-[var(--surface-container-low)] p-5 text-center">
        <span className="material-symbols-outlined text-2xl text-[var(--green)]">check_circle</span>
        <p className="mt-1 text-xs font-semibold text-[var(--t3)]">{emptyMessage}</p>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <ul className="divide-y divide-[var(--border)]">
        {tasks.map((task) => {
          const colors = {
            urgent: "bg-[var(--red-soft)] text-[var(--red-ink)]",
            attention: "bg-[var(--amber-soft)] text-[var(--amber-ink)]",
            normal: "bg-[var(--primary-50)] text-[var(--primary)]",
          }[task.priority];

          return (
            <li key={task.id} className="flex items-start gap-3 py-3 sm:items-center">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:mt-0 ${colors}`}
              >
                <MaterialIcon icon={task.icon} className="text-base" />
              </span>
              <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-[var(--t1)]">{task.label}</p>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                {task.secondary && (
                  <button
                    type="button"
                    onClick={task.secondary.onClick}
                    className="text-xs font-semibold text-[var(--t3)] transition-colors hover:text-[var(--t1)]"
                  >
                    {task.secondary.label}
                  </button>
                )}
                <Link href={task.href} className="text-xs font-bold text-[var(--primary)] hover:underline">
                  {task.cta}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const colors = {
          urgent: {
            badge: "bg-[var(--red-soft)] text-[var(--red-ink)]",
            border: "border-l-[var(--red)]",
          },
          attention: {
            badge: "bg-[var(--amber-soft)] text-[var(--amber-ink)]",
            border: "border-l-[var(--amber)]",
          },
          normal: {
            badge: "bg-[var(--primary-50)] text-[var(--primary)]",
            border: "border-l-[var(--primary)]",
          },
        }[task.priority];

        return (
          <div
            key={task.id}
            className={`flex items-center gap-3 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-3.5 border-l-4 ${colors.border} shadow-[var(--sh1)] transition-all hover:shadow-[var(--sh2)] hover:-translate-y-0.5`}
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors.badge}`}>
              <MaterialIcon icon={task.icon} className="text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13px] font-bold leading-snug text-[var(--t1)]">{task.label}</p>
            </div>
            {task.secondary && (
              <button
                type="button"
                onClick={task.secondary.onClick}
                className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--t2)] transition-all hover:bg-[var(--surface-container-low)]"
              >
                {task.secondary.label}
              </button>
            )}
            <Link
              href={task.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90 sm:px-3.5 sm:py-2 ${
                task.priority === "urgent"
                  ? "bg-[var(--red)]"
                  : task.priority === "attention"
                    ? "bg-[var(--amber)]"
                    : "bg-[var(--primary)]"
              }`}
            >
              {task.cta}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
