"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { useMemo } from "react";
import { buildEcosystemActivities } from "@/lib/dashboard-data";

interface EcosystemPulseProps {
  payments: any[];
  smsStats?: any;
  loading?: boolean;
}

export default function EcosystemPulse({ payments, smsStats, loading }: EcosystemPulseProps) {
  const activities = useMemo(
    () => buildEcosystemActivities({ payments, smsStats }),
    [payments, smsStats],
  );

  const formatActivityTime = (value: string) => {
    if (!value || value === "Today" || value === "Recent") return value || "Recent";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString("en-UG", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="glass-premium rounded-[var(--r2)] p-6 overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
          <h3 className="text-sm font-bold text-[var(--t1)] font-heading">Recent Activity</h3>
        </div>
        <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">Live Feed</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 no-scrollbar flex flex-col gap-4">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-[var(--surface-container-low)]" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-2/3 rounded-full bg-[var(--surface-container-low)]" />
                  <div className="h-3 w-full rounded-full bg-[var(--surface-container-low)]" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-container-low)] p-4 text-center">
            <div className="text-sm font-semibold text-[var(--t1)]">No recent real activity yet</div>
            <div className="text-[12px] text-[var(--t3)] mt-1">
              Payments, messages, and other live actions will appear here automatically.
            </div>
          </div>
        ) : activities.map((act) => (
          <div key={act.id} className="flex gap-4 group">
            <div className="flex flex-col items-center">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/20 transition-all group-hover:scale-110 shadow-sm"
                style={{ backgroundColor: `${act.color}15`, color: act.color }}
              >
                <MaterialIcon icon={act.icon} style={{ fontSize: 20 }} />
              </div>
              <div className="w-[1px] flex-1 bg-[var(--border)] my-1 border-dotted" />
            </div>
            <div className="flex-1 pb-4 border-b border-[var(--bg)] last:border-none">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--t1)]">{act.title}</span>
                <span className="text-[10px] font-medium text-[var(--t4)]">{formatActivityTime(act.time)}</span>
              </div>
              <p className="text-[11px] text-[var(--t3)] mt-1 line-clamp-2">{act.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
