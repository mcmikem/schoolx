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
    <div className="space-y-4">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--t3)]">{s.label}</div>
              <span className="w-7 h-7 rounded-lg bg-[var(--surface-container-low)] flex items-center justify-center shrink-0">
                <MaterialIcon style={{ fontSize: 15, color: s.color }}>{s.icon}</MaterialIcon>
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold" style={{ color: s.color, fontFamily: "Sora, sans-serif" }}>
              {s.value}
            </div>
          </div>
        ))}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-2 pt-2">
          <div className="relative">
            <div
              ref={tabsScrollerRef}
              className="flex gap-1 overflow-x-auto no-scrollbar px-1 pb-1 snap-x snap-mandatory"
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
                    className={`flex shrink-0 snap-start items-center gap-2 px-4 py-3 rounded-t-xl text-[13px] font-semibold whitespace-nowrap border-b-2 transition-all ${
                      isActive
                        ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--navy-soft)]"
                        : "border-transparent text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--bg)]"
                    }`}
                  >
                    <MaterialIcon icon={tab.icon} size={16} />
                    {tab.label}
                    {count > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-container)] text-[var(--t3)]"}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {showTabsOverflowHint && (
            <div className="sm:hidden px-2 pb-2 text-[11px] text-[var(--t3)] flex items-center gap-1">
              <MaterialIcon icon="swipe" size={14} />
              Swipe left or right to see all tabs
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
