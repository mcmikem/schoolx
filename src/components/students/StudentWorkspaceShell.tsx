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

const WORKSPACE_COPY: Record<
  StudentWorkspaceTab,
  {
    title: string;
    summary: string;
    guidance: string;
    primaryMetricLabel: string;
  }
> = {
  registry: {
    title: "Registry desk",
    summary: "Admissions, search, identity updates, and family records live here.",
    guidance: "Use this workspace for day-to-day record hygiene, imports, and profile corrections before printing IDs or reports.",
    primaryMetricLabel: "enrolled learners",
  },
  transfers: {
    title: "Transfers desk",
    summary: "Capture inbound and outbound movement with traceable handover history.",
    guidance: "Use this workspace when a learner joins from another school or needs a formal transfer-out record and letter.",
    primaryMetricLabel: "movement records",
  },
  dropouts: {
    title: "Retention desk",
    summary: "Escalate attendance risk, contact guardians, and document dropouts cleanly.",
    guidance: "Use this workspace for intervention first, then formal dropout marking only when recovery efforts have failed.",
    primaryMetricLabel: "risk cases",
  },
  promotion: {
    title: "Promotion desk",
    summary: "Prepare end-of-year progression decisions and bulk class movements safely.",
    guidance: "Use this workspace after registry data is clean and class rosters are final, especially before reporting cycles close.",
    primaryMetricLabel: "active learners",
  },
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

  const activeWorkspace = WORKSPACE_COPY[activeTab];

  return (
    <div className="space-y-6">
      <div
        className="rounded-[28px] border border-[var(--border)] p-6 lg:p-8 overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(14,165,233,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(34,197,94,0.12), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.98), rgba(247,250,252,0.96))",
        }}
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="dashboard-pill bg-emerald-50 text-emerald-700">
                {totalStudents} enrolled
              </span>
              <span className="dashboard-pill bg-blue-50 text-blue-700">
                {classesCount} classes
              </span>
              <span className="dashboard-pill bg-amber-50 text-amber-700">
                Term {currentTerm || "-"}
              </span>
              <span className="dashboard-pill bg-rose-50 text-rose-700">
                {atRiskCount + likelyDropoutCount} retention cases
              </span>
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)] mb-2">
                Student Operations System
              </div>
              <h2 className="text-3xl lg:text-4xl font-black text-[var(--t1)] leading-tight max-w-2xl">
                Run admissions, identity, movement, and retention from one controlled workspace.
              </h2>
              <p className="mt-3 text-sm lg:text-base text-[var(--t2)] max-w-2xl leading-7">
                This hub should behave like one controlled operations floor, not a pile of separate tools. Run admissions, risk handling, transfer control, and progression from one place with fewer repeated actions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 min-w-full xl:min-w-[360px] xl:max-w-[420px] self-start">
            <button onClick={onAddStudent} className="btn btn-primary justify-center">
              <MaterialIcon icon="person_add" style={{ fontSize: "16px" }} />
              Register Student
            </button>
            <button onClick={onImport} className="btn btn-navy justify-center">
              <MaterialIcon icon="cloud_upload" style={{ fontSize: "16px" }} />
              Import CSV
            </button>
            <button onClick={onGeneratePle} className="btn btn-ghost justify-center">
              <MaterialIcon icon="tag" style={{ fontSize: "16px" }} />
              Generate PLE
            </button>
            <button onClick={onExport} className="btn btn-ghost justify-center">
              <MaterialIcon icon="download" style={{ fontSize: "16px" }} />
              Export Registry
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 lg:p-5 shadow-[0_20px_45px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)]">
                  Operations Flow
                </div>
                <div className="mt-1 text-sm text-[var(--t2)]">
                  Move between student workflows here. The active desk stays visible below.
                </div>
              </div>
              <div className="hidden lg:flex items-center gap-2 rounded-full bg-[var(--surface-container)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--t3)]">
                <MaterialIcon icon="tune" style={{ fontSize: "14px" }} />
                Guided flow
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {WORKFLOW_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className="rounded-[20px] border p-4 text-left transition-all"
                    style={{
                      borderColor: isActive ? "var(--primary)" : "rgba(148, 163, 184, 0.28)",
                      background: isActive
                        ? "linear-gradient(135deg, rgba(0,31,63,0.06), rgba(14,165,233,0.05))"
                        : "rgba(255,255,255,0.9)",
                      boxShadow: isActive ? "0 12px 24px rgba(0,31,63,0.08)" : "none",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[var(--surface-container)] flex items-center justify-center text-[var(--primary)]">
                        <MaterialIcon icon={tab.icon} style={{ fontSize: "18px" }} />
                      </div>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                        style={{
                          background: isActive ? "var(--primary)" : "rgba(148, 163, 184, 0.16)",
                          color: isActive ? "white" : "var(--t3)",
                        }}
                      >
                        {isActive ? "Open" : workflowCounts[tab.id]}
                      </span>
                    </div>
                    <div className="mt-4 font-bold text-[var(--t1)] text-base">{tab.label}</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--t3)]">{tab.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/70 bg-[rgba(0,31,63,0.92)] p-5 text-white shadow-[0_24px_48px_rgba(0,31,63,0.22)]">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/60">
              Current Workspace
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-black leading-tight">{activeWorkspace.title}</div>
                <p className="mt-2 text-sm leading-6 text-white/75">{activeWorkspace.summary}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Now tracking</div>
                <div className="mt-1 text-2xl font-black">{workflowCounts[activeTab]}</div>
                <div className="text-xs text-white/65">{activeWorkspace.primaryMetricLabel}</div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-white/8 px-4 py-3 text-sm leading-6 text-white/80">
              {activeWorkspace.guidance}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--t3)]">Students</div>
          <div className="mt-3 text-3xl font-black text-[var(--t1)]">{totalStudents}</div>
          <div className="mt-2 text-sm text-[var(--t3)]">Active registry footprint for {academicYear || "this cycle"}</div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--t3)]">Boys</div>
          <div className="mt-3 text-3xl font-black text-[var(--navy)]">{boysCount}</div>
          <div className="mt-2 text-sm text-[var(--t3)]">Gender balance signal</div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--t3)]">Girls</div>
          <div className="mt-3 text-3xl font-black text-[var(--red)]">{girlsCount}</div>
          <div className="mt-2 text-sm text-[var(--t3)]">Admissions mix this year</div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--t3)]">Retention Watch</div>
          <div className="mt-3 text-3xl font-black text-amber-600">{atRiskCount + likelyDropoutCount}</div>
          <div className="mt-2 text-sm text-[var(--t3)]">At-risk and likely dropout learners</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <Card className="p-5">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)] mb-3">
            Linked Outputs
          </div>
          <div className="space-y-3">
            <Link href="/dashboard/students/id-cards" className="flex items-start gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 hover:bg-[var(--surface-container)] transition-colors">
              <MaterialIcon icon="badge" className="text-[var(--primary)] mt-0.5" />
              <div>
                <div className="font-bold text-[var(--t1)]">ID card studio</div>
                <div className="text-sm text-[var(--t3)]">Print identity cards with current photos and class data.</div>
              </div>
            </Link>
            <Link href="/dashboard/reports" className="flex items-start gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 hover:bg-[var(--surface-container)] transition-colors">
              <MaterialIcon icon="description" className="text-[var(--primary)] mt-0.5" />
              <div>
                <div className="font-bold text-[var(--t1)]">Individual reports</div>
                <div className="text-sm text-[var(--t3)]">Preview, print, and review report cards learner by learner.</div>
              </div>
            </Link>
            <Link href="/dashboard/report-cards" className="flex items-start gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 hover:bg-[var(--surface-container)] transition-colors">
              <MaterialIcon icon="print_connect" className="text-[var(--primary)] mt-0.5" />
              <div>
                <div className="font-bold text-[var(--t1)]">Class report runs</div>
                <div className="text-sm text-[var(--t3)]">Generate whole-class report batches with comments and fee status.</div>
              </div>
            </Link>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)] mb-3">
              Operator Notes
            </div>
            <div className="space-y-3 text-sm leading-6 text-[var(--t2)]">
              <div className="rounded-2xl bg-[var(--surface-container)] px-4 py-3">
                {activeStudents} students are currently active and ready for reporting, promotion, and identity workflows.
              </div>
              <div className="rounded-2xl border border-[var(--border)] px-4 py-3">
                Keep learner identity details current in Registry before printing IDs or reports to avoid carrying stale class or photo data downstream.
              </div>
              <div className="rounded-2xl border border-[var(--border)] px-4 py-3">
                Use Transfers for school movement, Retention for intervention and dropout control, and Promotion only after rosters are verified.
              </div>
          </div>
        </Card>
      </div>
    </div>
  );
}