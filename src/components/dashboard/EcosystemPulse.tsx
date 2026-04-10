"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { useMemo } from "react";

interface EcosystemPulseProps {
  payments: any[];
  smsStats?: any;
  loading?: boolean;
}

export default function EcosystemPulse({ payments, smsStats, loading }: EcosystemPulseProps) {
  const activities = useMemo(() => {
    const list: any[] = [];
    
    // Add recent payments
    payments.slice(0, 3).forEach((p, i) => {
      list.push({
        id: `pay-${i}`,
        type: "payment",
        title: "Fee Payment Received",
        detail: `UGX ${Number(p.amount_paid).toLocaleString()} from ${p.students?.first_name || "Student"}`,
        time: "Just now",
        icon: "payments",
        color: "var(--green)"
      });
    });

    // Add SMS activity
    if (smsStats?.sentToday > 0) {
      list.push({
        id: "sms-today",
        type: "sms",
        title: "Communication Sent",
        detail: `${smsStats.sentToday} SMS messages delivered to parents`,
        time: "Today",
        icon: "sms",
        color: "var(--navy)"
      });
    }

    // Default system activity
    list.push({
      id: "sys-init",
      type: "system",
      title: "Academic Term Active",
      detail: "Term 1 synchronization complete",
      time: "Stable",
      icon: "cloud_done",
      color: "var(--navy-mid)"
    });

    return list;
  }, [payments, smsStats]);

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
        {activities.map((act) => (
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
                <span className="text-[10px] font-medium text-[var(--t4)]">{act.time}</span>
              </div>
              <p className="text-[11px] text-[var(--t3)] mt-1 line-clamp-2">{act.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
