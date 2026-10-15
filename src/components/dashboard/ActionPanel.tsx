"use client";

import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

interface ActionPanelProps {
  title: string;
  label: string;
  description: string;
  actions: { href: string; label: string; icon: string; tone?: string }[];
}

export default function ActionPanel({ title, label, description, actions }: ActionPanelProps) {
  const columns = actions.length === 6 ? "xl:grid-cols-6" : actions.length === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4";
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold font-heading text-[var(--t1)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--t3)]">{description}</p>
      </div>
      <nav aria-label={label} className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 ${columns}`}>
        {actions.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            className={`group flex min-h-[88px] min-w-0 flex-col justify-between gap-3 rounded-xl border p-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${index === 0 ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90" : "border-[var(--border)] bg-[var(--surface-bright)] text-[var(--t1)] hover:border-[var(--primary)] hover:bg-[var(--primary-50)]"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <MaterialIcon
                icon={action.icon}
                className={`text-xl ${index === 0 ? "" : action.tone || "text-[var(--primary)]"}`}
              />
              <MaterialIcon icon="arrow_forward" className="text-base opacity-60" />
            </div>
            <span className="text-sm font-semibold leading-snug break-words">{action.label}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
