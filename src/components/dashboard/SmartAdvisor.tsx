"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { useMemo, useState } from "react";

interface SmartAdvisorProps {
  stats: any;
  collectionRate: number;
  attendanceRate: number;
  role: "headmaster" | "bursar" | "dean" | "teacher";
  performanceAlerts?: any[];
  isOsxPartner?: boolean;
}

export default function SmartAdvisor({
  stats,
  collectionRate,
  attendanceRate,
  role,
  performanceAlerts = [],
  isOsxPartner = false,
}: SmartAdvisorProps) {
  const insights = useMemo(() => {
    const list: string[] = [];

    if (role === "headmaster" || role === "bursar") {
      if (collectionRate < 50) {
        list.push(
          "Sustainability Warning: Collection rate is below 50%. School operation buffer is at high risk. Recommend activating 'Auto-SMS Recovery' for all balances.",
        );
      }
    }

    if (role === "headmaster" && collectionRate > 85) {
      list.push(
        "Strong Cash Flow: Fee collection has crossed 85%. Excellent time to invest in term-end rewards or infrastructure maintenance.",
      );
    }

    // OSX Engagement Tips — only shown to schools in the OSX partnership
    if (isOsxPartner) {
      if (role === "headmaster" || role === "dean") {
        const currentMonth = new Date().getMonth();
        if (currentMonth === 1 || currentMonth === 4 || currentMonth === 8) {
          list.push(
            "OSX Foundation: It's the start of the term. Ensure your 'Action Teams' are launched and Chapter toolkits are delivered.",
          );
        }
        if (attendanceRate > 95) {
          list.push(
            "Leadership Moment: High engagement detected. A perfect time for an SLF 'Servant Leadership' assembly or debate championship.",
          );
        }
      }

      if (role === "headmaster" || role === "teacher") {
        if (new Date().getMonth() >= 2 && new Date().getMonth() <= 4) {
          list.push(
            "GreenSchools: Rainy season is here. Perfect for the 'School Garden' project or tree planting drives.",
          );
        }
        list.push(
          "RED Campaign: Routine check—are the dignity kits fully stocked for the term? Use the 'Service Catalog' to restock.",
        );
      }
    }

    if (stats?.pendingLeave > 0) {
      list.push(
        `Operational Excellence: ${stats.pendingLeave} staff leave requests are pending. Resolution improves teacher morale and lesson stability.`,
      );
    }

    if (stats?.classesNotMarked > 0) {
      list.push(
        `Compliance Check: ${stats.classesNotMarked} classes have not submitted attendance. Digital registration compliance is essential for audit integrity.`,
      );
    }

    if (
      role === "bursar" &&
      collectionRate > 0 &&
      collectionRate < 100 &&
      stats?.totalFeesExpected
    ) {
      list.push(
        `Revenue Goal: Target of UGX ${(stats.totalFeesExpected - stats.totalFeesCollected).toLocaleString()} remains for term budget completion.`,
      );
    }

    if (stats?.pendingApprovals > 3) {
      list.push(
        `You have ${stats.pendingApprovals} pending approvals. Clearing them now will speed up school operations.`,
      );
    }

    // Add a generic "smart" tip if list is short
    if (list.length < 2) {
      list.push(
        "Tip: Use the 'Bulk SMS' tool to announce upcoming school events instantly.",
      );
    }

    // Rollover reminder
    const isEndOfTerm =
      new Date().getMonth() === 3 ||
      new Date().getMonth() === 7 ||
      new Date().getMonth() === 11;
    if (isEndOfTerm && role === "headmaster") {
      list.push(
        "End of Term: Time to check all names are correct and print the term report cards.",
      );
    }

    if (performanceAlerts.length > 0) {
      const topAlert = performanceAlerts[0];
      list.push(
        `Alert: ${topAlert.studentName} marks dropped by ${topAlert.dropPercentage}% in ${topAlert.subjectName}. Consider a parent meeting.`,
      );
    }

    return list;
  }, [stats, collectionRate, attendanceRate, role]);

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="fixed bottom-20 right-6 z-40 p-3 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 animate-float-gentle"
        title="Daily School Advisor"
      >
        <MaterialIcon icon="auto_awesome" style={{ fontSize: 24 }} />
      </button>

      {/* Slide-out panel */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--surface)] h-full shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border)] bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-between sticky top-0">
              <div className="flex items-center gap-2">
                <MaterialIcon style={{ fontSize: 20 }}>
                  auto_awesome
                </MaterialIcon>
                <span className="text-sm font-semibold">
                  Daily School Advisor
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <MaterialIcon style={{ fontSize: 20 }}>close</MaterialIcon>
              </button>
            </div>
            <div className="p-4 space-y-3">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber/20"
                >
                  <p className="text-sm font-medium text-[var(--t1)] leading-relaxed">
                    {insight}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
