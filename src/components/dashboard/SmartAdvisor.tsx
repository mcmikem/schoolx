"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { useMemo } from "react";

interface SmartAdvisorProps {
  stats: any;
  collectionRate: number;
  attendanceRate: number;
  role: "headmaster" | "bursar" | "dean" | "teacher";
  performanceAlerts?: any[];
  isOsxPartner?: boolean;
}

export default function SmartAdvisor({ stats, collectionRate, attendanceRate, role, performanceAlerts = [], isOsxPartner = false }: SmartAdvisorProps) {
  const insights = useMemo(() => {
    const list: string[] = [];
    
    if (role === "headmaster" || role === "bursar") {
      if (collectionRate < 50) {
        list.push("Sustainability Warning: Collection rate is below 50%. School operation buffer is at high risk. Recommend activating 'Auto-SMS Recovery' for all balances.");
      }
    }

    if (role === "headmaster" && collectionRate > 85) {
       list.push("Strong Cash Flow: Fee collection has crossed 85%. Excellent time to invest in term-end rewards or infrastructure maintenance.");
    }

    // OSX Engagement Tips — only shown to schools in the OSX partnership
    if (isOsxPartner) {
      if (role === "headmaster" || role === "dean") {
        const currentMonth = new Date().getMonth();
        if (currentMonth === 1 || currentMonth === 4 || currentMonth === 8) {
          list.push("OSX Foundation: It's the start of the term. Ensure your 'Action Teams' are launched and Chapter toolkits are delivered.");
        }
        if (attendanceRate > 95) {
          list.push("Leadership Moment: High engagement detected. A perfect time for an SLF 'Servant Leadership' assembly or debate championship.");
        }
      }

      if (role === "headmaster" || role === "teacher") {
        if (new Date().getMonth() >= 2 && new Date().getMonth() <= 4) {
          list.push("GreenSchools: Rainy season is here. Perfect for the 'School Garden' project or tree planting drives.");
        }
        list.push("RED Campaign: Routine check—are the dignity kits fully stocked for the term? Use the 'Service Catalog' to restock.");
      }
    }

    if (stats?.pendingLeave > 0) {
      list.push(`Operational Excellence: ${stats.pendingLeave} staff leave requests are pending. Resolution improves teacher morale and lesson stability.`);
    }

    if (stats?.classesNotMarked > 0) {
      list.push(`Compliance Check: ${stats.classesNotMarked} classes have not submitted attendance. Digital registration compliance is essential for audit integrity.`);
    }

    if (role === "bursar" && collectionRate > 0 && collectionRate < 100 && stats?.totalFeesExpected) {
       list.push(`Revenue Goal: Target of UGX ${(stats.totalFeesExpected - stats.totalFeesCollected).toLocaleString()} remains for term budget completion.`);
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
