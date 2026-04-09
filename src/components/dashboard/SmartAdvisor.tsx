"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { useMemo } from "react";

interface SmartAdvisorProps {
  stats: any;
  collectionRate: number;
  attendanceRate: number;
  role: "headmaster" | "bursar" | "dean" | "teacher";
}

export default function SmartAdvisor({ stats, collectionRate, attendanceRate, role }: SmartAdvisorProps) {
  const insights = useMemo(() => {
    const list: string[] = [];
    
    if (role === "headmaster" || role === "bursar") {
      if (collectionRate < 50) {
        list.push("Revenue collection is below 50%. Prioritize sending fee reminders this week.");
      } else if (collectionRate > 80) {
        list.push("Excellent collection rate! Consider allocating surplus to pending infrastructure tasks.");
      }
    }

    if (role === "headmaster" || role === "dean" || role === "teacher") {
      if (attendanceRate < 85) {
        list.push("Attendance dip detected. Check for seasonal illness or local events affecting students.");
      } else if (attendanceRate >= 95) {
        list.push("Outstanding engagement! Student participation is at an all-time high.");
      }
    }

    if (stats?.pendingLeave > 0) {
      list.push(`Leave Management: ${stats.pendingLeave} staff requests awaiting your decision.`);
    }

    if (stats?.classesNotMarked > 0) {
      list.push(`Action Required: ${stats.classesNotMarked} classes haven't marked attendance today.`);
    }

    if (role === "bursar" && collectionRate > 0 && collectionRate < 100) {
       list.push(`Financial Goal: You are UGX ${(stats.totalFeesExpected - stats.totalFeesCollected).toLocaleString()} away from your term target.`);
    }

    if (stats?.pendingApprovals > 3) {
      list.push(`You have ${stats.pendingApprovals} pending approvals. Clearing them now will speed up school operations.`);
    }

    // Add a generic "smart" tip if list is short
    if (list.length < 2) {
      list.push("Tip: Use the 'Bulk SMS' tool to announce upcoming school events instantly.");
    }

    return list;
  }, [stats, collectionRate, attendanceRate, role]);

  return (
    <div className="card-gradient-amber rounded-[var(--r2)] p-1 mb-8 shadow-xl shadow-amber/10 animate-float-gentle">
      <div className="bg-white/95 backdrop-blur-md rounded-[calc(var(--r2)-4px)] p-4 flex gap-4 items-start">
        <div className="w-12 h-12 rounded-2xl bg-amber-soft flex items-center justify-center flex-shrink-0 border border-amber/20 shadow-inner">
          <MaterialIcon icon="auto_awesome" className="text-amber text-2xl animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
             <span className="text-[10px] font-extrabold text-amber uppercase tracking-widest">Smart Advisor</span>
             <span className="w-1.5 h-1.5 rounded-full bg-amber animate-ping" />
          </div>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <p key={i} className="text-sm font-bold text-[var(--t1)] leading-tight">
                {insight}
              </p>
            ))}
          </div>
        </div>
        <button className="text-[var(--t4)] hover:text-amber transition-colors">
          <MaterialIcon icon="close" style={{ fontSize: 18 }} />
        </button>
      </div>
    </div>
  );
}
