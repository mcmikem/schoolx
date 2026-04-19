"use client";

import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";

type StudentWorkspaceTab = "registry" | "transfers" | "dropouts" | "promotion";

interface StudentWorkspaceShellProps {
  totalStudents: number;
  boysCount: number;
  girlsCount: number;
  activeStudents: number;
  classesCount: number;
  currentTerm?: number | null;
  academicYear?: string | null;
  transferredCount: number;
  atRiskCount: number;
  likelyDropoutCount: number;
  activeTab: StudentWorkspaceTab;
  onTabChange: (tab: StudentWorkspaceTab) => void;
  onImport: () => void;
  onAddStudent: () => void;
  onGeneratePle: () => void;
  onExport: () => void;
}

const WORKFLOW_TABS: Array<{
  id: StudentWorkspaceTab;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    id: "registry",
    label: "Registry",
    icon: "group",
    description: "Admissions, search, updates, and family records.",
  },
  {
    id: "transfers",
    label: "Transfers",
    icon: "swap_horiz",
    description: "Move learners in and out with full handover history.",
  },
  {
    id: "dropouts",
    label: "Retention",
    icon: "warning",
    description: "Track risk, intervene early, and document follow-up.",
  },
  {
    id: "promotion",
    label: "Promotion",
    icon: "trending_up",
    description: "Prepare class progression and bulk year transitions.",
  },
];

const TAB_DESCRIPTIONS: Record<StudentWorkspaceTab, string> = {
  registry: "Add, search, and update student records",
  transfers: "Record students joining or leaving",
  dropouts: "Spot and follow up at-risk learners",
  promotion: "Move students to the next class",
};

export default function StudentWorkspaceShell({
  totalStudents,
  boysCount,
  girlsCount,
  activeStudents,
  classesCount,
  currentTerm,
  academicYear,
  transferredCount,
  atRiskCount,
  likelyDropoutCount,
  activeTab,
  onTabChange,
  onImport,
  onAddStudent,
  onGeneratePle,
  onExport,
}: StudentWorkspaceShellProps) {
  const workflowCounts: Record<StudentWorkspaceTab, number> = {
    registry: totalStudents,
    transfers: transferredCount,
    dropouts: atRiskCount + likelyDropoutCount,
    promotion: activeStudents,
  };

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="ph-title">Student Hub</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="dashboard-pill bg-[var(--navy-soft)] text-[var(--navy)]">
              {totalStudents} enrolled
            </span>
            <span className="dashboard-pill bg-[var(--navy-soft)] text-[var(--navy)]">
              {classesCount} classes
            </span>
            <span className="dashboard-pill bg-[var(--amber-soft)] text-[var(--amber)]">
              Term {currentTerm || "–"}
            </span>
            {(atRiskCount + likelyDropoutCount) > 0 && (
              <span className="dashboard-pill bg-[var(--red-soft)] text-[var(--red)]">
                {atRiskCount + likelyDropoutCount} at risk
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button onClick={onAddStudent} className="btn btn-primary">
            <MaterialIcon icon="person_add" size={15} />
            Register Student
          </button>
          <button onClick={onImport} className="btn btn-ghost">
            <MaterialIcon icon="cloud_upload" size={15} />
            Import CSV
          </button>
          <button onClick={onGeneratePle} className="btn btn-ghost">
            <MaterialIcon icon="tag" size={15} />
            PLE Numbers
          </button>
          <button onClick={onExport} className="btn btn-ghost">
            <MaterialIcon icon="download" size={15} />
            Export
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total enrolled", value: totalStudents, color: "var(--navy)" },
          { label: "Boys", value: boysCount, color: "var(--navy)" },
          { label: "Girls", value: girlsCount, color: "var(--green)" },
          { label: "At risk", value: atRiskCount + likelyDropoutCount, color: atRiskCount + likelyDropoutCount > 0 ? "var(--amber)" : "var(--t3)" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--t3)]">{s.label}</div>
            <div className="mt-2 text-2xl font-extrabold" style={{ color: s.color, fontFamily: "Sora, sans-serif" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Workflow tabs ── */}
      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-2 pt-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {WORKFLOW_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const count = workflowCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-t-xl text-[13px] font-semibold whitespace-nowrap border-b-2 transition-all ${
                    isActive
                      ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--navy-soft)]"
                      : "border-transparent text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--bg)]"
                  }`}
                >
                  <MaterialIcon icon={tab.icon} size={16} />
                  {tab.label}
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-container)] text-[var(--t3)]"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-5 py-3 bg-[var(--surface-container-low)]">
          <p className="text-[13px] text-[var(--t2)]">
            {TAB_DESCRIPTIONS[activeTab]}
          </p>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/dashboard/students/id-cards" className="card flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)] transition-colors no-underline">
          <div className="w-9 h-9 rounded-xl bg-[var(--navy-soft)] flex items-center justify-center flex-shrink-0">
            <MaterialIcon icon="id_card" size={17} className="text-[var(--navy)]" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[var(--t1)]">ID Card Studio</div>
            <div className="text-[11px] text-[var(--t3)]">Print student identity cards</div>
          </div>
        </Link>
        <Link href="/dashboard/reports" className="card flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)] transition-colors no-underline">
          <div className="w-9 h-9 rounded-xl bg-[var(--navy-soft)] flex items-center justify-center flex-shrink-0">
            <MaterialIcon icon="description" size={17} className="text-[var(--navy)]" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[var(--t1)]">Individual Reports</div>
            <div className="text-[11px] text-[var(--t3)]">Preview & print report cards</div>
          </div>
        </Link>
        <Link href="/dashboard/report-cards" className="card flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)] transition-colors no-underline">
          <div className="w-9 h-9 rounded-xl bg-[var(--navy-soft)] flex items-center justify-center flex-shrink-0">
            <MaterialIcon icon="print" size={17} className="text-[var(--navy)]" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[var(--t1)]">Batch Reports</div>
            <div className="text-[11px] text-[var(--t3)]">Print whole-class report runs</div>
          </div>
        </Link>
      </div>
    </div>
  );
}