"use client";

import { useEffect, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";

type StudentWorkspaceTab = "registry" | "transfers" | "dropouts" | "promotion";

interface StudentWorkspaceShellProps {
  totalStudents: number;
  boysCount: number;
  girlsCount: number;
  classesCount: number;
  activeStudents: number;
  transferredCount: number;
  atRiskCount: number;
  likelyDropoutCount: number;
  activeTab: StudentWorkspaceTab;
  onTabChange: (tab: StudentWorkspaceTab) => void;
}

const WORKFLOW_TABS: Array<{
  id: StudentWorkspaceTab;
  label: string;
  icon: string;
}> = [
  { id: "registry", label: "Registry", icon: "group" },
  { id: "transfers", label: "Transfers", icon: "swap_horiz" },
  { id: "dropouts", label: "Retention", icon: "warning" },
  { id: "promotion", label: "Promotion", icon: "trending_up" },
];

export default function StudentWorkspaceShell({
  totalStudents,
  boysCount,
  girlsCount,
  classesCount,
  activeStudents,
  transferredCount,
  atRiskCount,
  likelyDropoutCount,
  activeTab,
  onTabChange,
}: StudentWorkspaceShellProps) {
  const tabsScrollerRef = useRef<HTMLDivElement | null>(null);
  const [showTabsOverflowHint, setShowTabsOverflowHint] = useState(false);

  useEffect(() => {
    const updateOverflowHint = () => {
      const node = tabsScrollerRef.current;
      if (!node) return;
      setShowTabsOverflowHint(node.scrollWidth > node.clientWidth + 8);
    };

    updateOverflowHint();
    window.addEventListener("resize", updateOverflowHint);
    return () => window.removeEventListener("resize", updateOverflowHint);
  }, []);

  useEffect(() => {
    const node = tabsScrollerRef.current;
    if (!node) return;
    const activeButton = node.querySelector<HTMLButtonElement>(`[data-tab-id="${activeTab}"]`);
    activeButton?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeTab]);

  const workflowCounts: Record<StudentWorkspaceTab, number> = {
    registry: totalStudents,
    transfers: transferredCount,
    dropouts: atRiskCount + likelyDropoutCount,
    promotion: activeStudents,
  };

  const stats = [
    { label: "Total enrolled", value: totalStudents, color: "var(--navy)", icon: "group" },
    { label: "Boys", value: boysCount, color: "var(--navy)", icon: "male" },
    { label: "Girls", value: girlsCount, color: "var(--green)", icon: "female" },
    { label: "Classes", value: classesCount, color: "var(--green)", icon: "school" },
  ];

  return (
    <div>
      <section aria-label="Student totals" className="grid grid-cols-2 border-y border-[var(--border)] sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="px-3 py-3 sm:px-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[var(--t3)]">
              <MaterialIcon style={{ fontSize: 14, color: s.color }}>{s.icon}</MaterialIcon>
              {s.label}
            </div>
            <div className="mt-1 text-xl font-extrabold tabular-nums" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </section>

      <div
        ref={tabsScrollerRef}
        className="flex overflow-x-auto no-scrollbar border-b border-[var(--border)]"
        aria-label="Student workflow tabs"
      >
        {WORKFLOW_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = workflowCounts[tab.id];
          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm transition-colors ${
                isActive
                  ? "border-[var(--primary)] font-bold text-[var(--primary)]"
                  : "border-transparent font-medium text-[var(--t2)] hover:text-[var(--t1)]"
              }`}
            >
              <MaterialIcon icon={tab.icon} size={16} />
              {tab.label}
              {count > 0 && (
                <span className={`text-xs tabular-nums ${isActive ? "text-[var(--primary)]" : "text-[var(--t3)]"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {showTabsOverflowHint && (
        <div className="flex items-center gap-1 pl-1 pt-2 text-xs text-[var(--t3)] sm:hidden">
          <MaterialIcon icon="swipe" size={14} />
          Swipe left or right to see all tabs
        </div>
      )}
    </div>
  );
}
