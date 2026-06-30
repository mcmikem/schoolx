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
      <div className="rounded-2xl border border-dashed border-[#d7e3f2] bg-white/50 p-5 text-center">
        <span className="material-symbols-outlined text-2xl text-[#1f8a70]">check_circle</span>
        <p className="mt-1 text-xs font-semibold text-[#7f91aa]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const colors = {
          urgent: { dot: "bg-[#c2472b]", badge: "bg-[#ffefe8] text-[#c2472b]", border: "border-l-[#c2472b]" },
          attention: { dot: "bg-[#b45309]", badge: "bg-[#fff5e8] text-[#b45309]", border: "border-l-[#b45309]" },
          normal: { dot: "bg-[#42638d]", badge: "bg-[#eef5ff] text-[#42638d]", border: "border-l-[#42638d]" },
        }[task.priority];

        return (
          <div
            key={task.id}
            className={`flex items-center gap-3 rounded-2xl border border-[#eef2f8] bg-white p-3.5 border-l-4 ${colors.border} shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5`}
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors.badge}`}>
              <MaterialIcon icon={task.icon} className="text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#17325f]">{task.label}</p>
            </div>
            <Link
              href={task.href}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-[11px] font-bold text-white transition-all hover:opacity-90 ${
                task.priority === "urgent" ? "bg-[#c2472b]" : task.priority === "attention" ? "bg-[#b45309]" : "bg-[#17325f]"
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
