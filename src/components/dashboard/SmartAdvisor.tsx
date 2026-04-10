"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { useMemo } from "react";

interface SmartAdvisorProps {
  stats: any;
  collectionRate: number;
  attendanceRate: number;
  role: "headmaster" | "bursar" | "dean" | "teacher";
  performanceAlerts?: any[];
}

export default function SmartAdvisor({ stats, collectionRate, attendanceRate, role, performanceAlerts = [] }: SmartAdvisorProps) {
  const insights = useMemo(() => {
    const list: string[] = [];
    
    if (role === "headmaster" || role === "bursar") {
      if (collectionRate < 50) {
        list.push("Money collected is less than half of what is expected. You should tell parents to clear balances soon.");
      } else if (collectionRate > 80) {
        list.push("Great job! Almost everyone has paid. You can now plan for school repairs or new equipment.");
      }
    }

    if (role === "headmaster" || role === "dean" || role === "teacher") {
      if (attendanceRate < 85) {
        list.push("Attendance is dropped today. Check if children are sick or if there is a local event keeping them away.");
      } else if (attendanceRate >= 95) {
        list.push("Very good! Almost every student is in school today.");
      }
    }

    if (stats?.pendingLeave > 0) {
      list.push(`Leave Management: ${stats.pendingLeave} staff requests awaiting your decision.`);
    }

    if (stats?.classesNotMarked > 0) {
      list.push(`Action Required: ${stats.classesNotMarked} classes haven't marked attendance today.`);
    }

    if (role === "bursar" && collectionRate > 0 && collectionRate < 100 && stats?.totalFeesExpected) {
       list.push(`Financial Goal: You are UGX ${(stats.totalFeesExpected - stats.totalFeesCollected).toLocaleString()} away from your term target.`);
    }

    if (stats?.pendingApprovals > 3) {
      list.push(`You have ${stats.pendingApprovals} pending approvals. Clearing them now will speed up school operations.`);
    }

    // Add a generic "smart" tip if list is short
    if (list.length < 2) {
      list.push("Tip: Use the 'Bulk SMS' tool to announce upcoming school events instantly.");
    }

    // Rollover reminder
    const isEndOfTerm = new Date().getMonth() === 3 || new Date().getMonth() === 7 || new Date().getMonth() === 11;
    if (isEndOfTerm && role === "headmaster") {
      list.push("End of Term: Time to check all names are correct and print the term report cards.");
    }

    if (performanceAlerts.length > 0) {
      const topAlert = performanceAlerts[0];
      list.push(`Alert: ${topAlert.studentName} marks dropped by ${topAlert.dropPercentage}% in ${topAlert.subjectName}. Consider a parent meeting.`);
    }

    return list;
  }, [stats, collectionRate, attendanceRate, role]);

  return (
    <div className="card-gradient-amber rounded-[var(--r2)] p-1 mb-8 shadow-xl shadow-amber/10 animate-float-gentle">
      <div className="bg-surface backdrop-blur-md rounded-[calc(var(--r2)-4px)] p-4 flex gap-4 items-start">
        <div className="w-12 h-12 rounded-2xl bg-amber-soft flex items-center justify-center flex-shrink-0 border border-amber/20 shadow-inner">
          <MaterialIcon icon="auto_awesome" className="text-amber text-2xl animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
             <span className="text-[10px] font-extrabold text-amber uppercase tracking-widest">Daily School Advisor</span>
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
