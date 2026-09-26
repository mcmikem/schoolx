"use client";
import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

interface ReadinessItem {
  label: string;
  status: "ok" | "missing" | "pending";
  link: string;
  detail: string;
}

interface SchoolReadinessGuideProps {
  items: ReadinessItem[];
  title?: string;
}

export function SchoolReadinessGuide({ items, title = "School Readiness" }: SchoolReadinessGuideProps) {
  const missing = items.filter((i) => i.status !== "ok").length;
  if (missing === 0) return null;

  return (
    <div className="rounded-[24px] border border-[#f5deb3] bg-[#fffaf5] p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[var(--amber)] text-lg">fact_check</span>
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--amber)]">{title}</span>
        <span className="ml-auto rounded-full bg-[var(--amber)] px-2 py-0.5 text-[10px] font-bold text-white">
          {missing} item{missing > 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-xl border p-3 flex items-center gap-3 ${
              item.status === "ok"
                ? "border-[var(--green-soft)] bg-[var(--green-soft)]"
                : "border-[var(--red-soft)] bg-[var(--red-soft)]"
            }`}
          >
            <span
              className={`material-symbols-outlined text-lg ${
                item.status === "ok" ? "text-[var(--green)]" : "text-[var(--red)]"
              }`}
            >
              {item.status === "ok" ? "check_circle" : "warning"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--t1)]">{item.label}</p>
              <p className="text-[11px] text-[#6b7f99] truncate">{item.detail}</p>
            </div>
            {item.status !== "ok" && (
              <Link
                href={item.link}
                className="shrink-0 rounded-lg bg-[var(--t1)] px-3 py-1.5 text-[10px] font-bold text-white hover:opacity-90"
              >
                Fix
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeacherQuickGuide() {
  return (
    <div className="rounded-[24px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[var(--t1)] text-lg">school</span>
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--t1)]">My Day</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { step: "1", label: "Take attendance", icon: "how_to_reg", href: "/dashboard/attendance" },
          { step: "2", label: "Enter marks", icon: "grade", href: "/dashboard/grades" },
          { step: "3", label: "Post homework", icon: "assignment", href: "/dashboard/homework" },
          { step: "4", label: "Check timetable", icon: "calendar_month", href: "/dashboard/timetable" },
        ].map((action) => (
          <Link
            key={action.step}
            href={action.href}
            className="rounded-xl bg-white border border-[#e5ecf4] p-3 hover:bg-[var(--primary-50)] transition-colors text-center"
          >
            <div className="w-6 h-6 rounded-full bg-[var(--t1)] text-white text-[10px] font-bold flex items-center justify-center mx-auto mb-1">
              {action.step}
            </div>
            <span className="material-symbols-outlined text-[var(--t1)] text-xl">{action.icon}</span>
            <p className="text-[10px] font-bold text-[var(--t1)] mt-1">{action.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
