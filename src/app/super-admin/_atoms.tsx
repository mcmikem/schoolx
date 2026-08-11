"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { PLAN_COLORS, PLAN_LABELS, STATUS_STYLES } from "./_shared";

// ─── UI Atoms ─────────────────────────────────────────────────────────────────

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary)] ${value ? "bg-[var(--primary)]" : "bg-[#cbd5e1]"}`}
      role="switch"
      aria-checked={value}
    >
      <span
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
        style={{ left: value ? "calc(100% - 20px)" : "4px" }}
      />
    </button>
  );
}

export function Badge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

export function PlanBadge({ plan }: { plan: string }) {
  const c = PLAN_COLORS[plan] || "#64748b";
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
      style={{ background: `${c}18`, color: c }}
    >
      {PLAN_LABELS[plan] || plan}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-accent" style={{ background: color }} />
      <div className="stat-inner">
        <div className="stat-meta">
          <div className="stat-label">{label}</div>
          <div className="stat-icon-box" style={{ background: `${color}18`, color }}>
            <MaterialIcon icon={icon} style={{ fontSize: 20 }} />
          </div>
        </div>
        <div className="stat-val" style={{ color }}>
          {value}
        </div>
        {sub && <div className="text-[12px] text-[var(--t3)] mt-1.5 font-medium">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] w-full max-w-sm max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto p-6">
        <h3 className="font-['Sora'] text-[15px] font-bold text-[var(--t1)] mb-2">{title}</h3>
        <p className="text-[13px] text-[var(--t2)] mb-5 leading-relaxed">{body}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold border border-[var(--border)] text-[var(--t2)] hover:bg-[var(--bg)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-[var(--primary)] hover:opacity-90"}`}
          >
            {loading ? "Working\u2026" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
