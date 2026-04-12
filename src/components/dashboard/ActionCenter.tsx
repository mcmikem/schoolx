"use client";
import MaterialIcon from "@/components/MaterialIcon";
import Link from "next/link";

interface ActionItem {
  id: string;
  label: string;
  count: number;
  description: string;
  link: string;
  priority: "high" | "medium" | "low";
}

interface ActionCenterProps {
  items: ActionItem[];
  loading?: boolean;
}

function ActionCenterSkeleton() {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 bg-slate-200 rounded animate-pulse" />
        <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border bg-slate-50 animate-pulse"
          >
            <div className="w-12 h-12 bg-slate-200 rounded-xl" />
            <div className="w-24 h-4 bg-slate-200 rounded mt-4" />
            <div className="w-32 h-3 bg-slate-200 rounded mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ActionCenter({ items, loading }: ActionCenterProps) {
  if (loading) return <ActionCenterSkeleton />;

  const activeItems = items.filter((item) => item.count > 0);

  if (activeItems.length === 0)
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <MaterialIcon
            icon="bolt"
            style={{ color: "var(--amber)", fontSize: 20 }}
          />
          <h3 className="text-sm font-bold text-[var(--t1)] font-heading">
            Action Center
          </h3>
        </div>
        <div className="p-6 text-center text-surface-variant rounded-xl bg-surface-container-low">
          <MaterialIcon
            icon="check_circle"
            className="text-2xl text-green-500 mb-2"
          />
          <p className="text-sm">All caught up! No pending actions.</p>
        </div>
      </div>
    );

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <MaterialIcon
          icon="bolt"
          style={{ color: "var(--amber)", fontSize: 20 }}
        />
        <h3 className="text-sm font-bold text-[var(--t1)] font-heading">
          Action Center
        </h3>
        <span className="bg-[var(--red-soft)] text-[var(--red)] text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-2">
          {activeItems.length} Urgent
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeItems.map((item) => (
          <Link
            key={item.id}
            href={item.link}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98] hover:shadow-lg ${
              item.priority === "high"
                ? "bg-[var(--grad-amber)] text-white border-transparent"
                : "bg-white border-[var(--border)] hover:border-[var(--amber)]"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                item.priority === "high"
                  ? "bg-white/20"
                  : "bg-[var(--amber-soft)] text-[var(--amber)]"
              }`}
            >
              <span className="text-xl font-extrabold font-heading">
                {item.count}
              </span>
            </div>
            <div className="min-w-0">
              <div
                className={`text-sm font-bold truncate ${item.priority === "high" ? "text-white" : "text-[var(--t1)]"}`}
              >
                {item.label}
              </div>
              <div
                className={`text-[11px] font-medium truncate ${item.priority === "high" ? "text-white/80" : "text-[var(--t3)]"}`}
              >
                {item.description}
              </div>
            </div>
            <div className="ml-auto">
              <MaterialIcon icon="chevron_right" style={{ fontSize: 18 }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
