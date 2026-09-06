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
}

export default function TaskManager({
  tasks,
  emptyMessage = "All clear! No pending tasks.",
}: {
  tasks: Task[];
  emptyMessage?: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-[var(--r)] border border-dashed border-[var(--border)] bg-[var(--surface-container-low)] p-5 text-center">
        <span className="material-symbols-outlined text-2xl text-[var(--green)]">check_circle</span>
        <p className="mt-1 text-xs font-semibold text-[var(--t3)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const colors = {
          urgent: {
            badge: "bg-[var(--red-soft)] text-[var(--red)]",
            border: "border-l-[var(--red)]",
          },
          attention: {
            badge: "bg-[var(--amber-soft)] text-[var(--amber)]",
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
              <p className="truncate text-[13px] font-bold text-[var(--t1)]">{task.label}</p>
            </div>
            <Link
              href={task.href}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold text-white transition-all hover:opacity-90 ${
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
