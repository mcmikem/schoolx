"use client";

import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";

interface ClassOption {
  id: string;
  name: string;
}

interface AtRiskStudent {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  student_number: string;
  class_id: string;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  consecutive_absent: number;
  last_attendance_date: string | null;
  risk_level: "at_risk" | "likely_dropout";
}

interface StudentRetentionPanelProps {
  atRiskCount: number;
  likelyDropoutCount: number;
  activeStudentsCount: number;
  droppedStudentsCount: number;
  dropoutClassFilter: string;
  setDropoutClassFilter: (value: string) => void;
  classes: ClassOption[];
  onRefresh: () => void;
  filteredAtRisk: AtRiskStudent[];
  loadingAtRisk: boolean;
  sendingSms: string | null;
  onContactParent: (student: AtRiskStudent) => void;
  showDropoutModal: string | null;
  setShowDropoutModal: (studentId: string | null) => void;
  dropoutReason: string;
  setDropoutReason: (value: string) => void;
  onMarkDropout: () => void;
}

export default function StudentRetentionPanel({
  atRiskCount,
  likelyDropoutCount,
  activeStudentsCount,
  droppedStudentsCount,
  dropoutClassFilter,
  setDropoutClassFilter,
  classes,
  onRefresh,
  filteredAtRisk,
  loadingAtRisk,
  sendingSms,
  onContactParent,
  showDropoutModal,
  setShowDropoutModal,
  dropoutReason,
  setDropoutReason,
  onMarkDropout,
}: StudentRetentionPanelProps) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <MaterialIcon className="text-amber-600">warning</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">At Risk</span>
          </div>
          <div className="text-3xl font-bold text-amber-600">{atRiskCount}</div>
          <div className="text-xs text-[var(--t3)]">14-29 days absent</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <MaterialIcon className="text-red-600">error</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Likely Dropout</span>
          </div>
          <div className="text-3xl font-bold text-red-600">{likelyDropoutCount}</div>
          <div className="text-xs text-[var(--t3)]">30+ days absent</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <MaterialIcon className="text-blue-600">group</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Active</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">{activeStudentsCount}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <MaterialIcon className="text-gray-500">person_off</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Dropouts</span>
          </div>
          <div className="text-3xl font-bold text-gray-600">{droppedStudentsCount}</div>
        </Card>
      </div>

      <div className="flex gap-4 mb-4 items-center">
        <select
          aria-label="Class filter"
          value={dropoutClassFilter}
          onChange={(e) => setDropoutClassFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium"
        >
          <option value="all">All Classes</option>
          {classes.map((classItem) => (
            <option key={classItem.id} value={classItem.id}>
              {classItem.name}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <MaterialIcon icon="refresh" className="text-base" />
          Refresh
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[var(--on-surface)]">
            {atRiskCount + likelyDropoutCount > 0
              ? `${filteredAtRisk.length} student${filteredAtRisk.length !== 1 ? "s" : ""} at risk of dropout`
              : "No at-risk students found"}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--surface-container)]">
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Student</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Class</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Days Absent</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Last Attendance</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Risk Level</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Parent Phone</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingAtRisk ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[var(--t3)]">Loading...</td>
                </tr>
              ) : filteredAtRisk.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[var(--t3)]">No at-risk students found</td>
                </tr>
              ) : (
                filteredAtRisk.map((student) => (
                  <tr key={student.id} className="border-b border-[var(--border)]">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{
                            background: student.gender === "M" ? "var(--navy)" : "var(--red)",
                          }}
                        >
                          {student.first_name?.charAt(0)}
                          {student.last_name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{student.first_name} {student.last_name}</div>
                          <div className="text-xs text-[var(--t3)]">{student.student_number || "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold">{student.class_name}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold" style={{ color: student.consecutive_absent >= 30 ? "#e74c3c" : "#f39c12" }}>
                        {student.consecutive_absent} days
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      {student.last_attendance_date ? new Date(student.last_attendance_date).toLocaleDateString() : "No record"}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${student.risk_level === "likely_dropout" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                        {student.risk_level === "likely_dropout" ? "Likely Dropout" : "At Risk"}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-mono">{student.parent_phone || "-"}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => onContactParent(student)}
                          disabled={sendingSms === student.id || !student.parent_phone}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-40"
                          title="Send SMS to parent"
                        >
                          <MaterialIcon icon="sms" className="text-sm mr-0.5" />
                          {sendingSms === student.id ? "Sending..." : "Contact"}
                        </button>
                        <button
                          onClick={() => setShowDropoutModal(student.id)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                          title="Mark as dropout"
                        >
                          <MaterialIcon icon="person_remove" className="text-sm mr-0.5" />
                          Dropout
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showDropoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDropoutModal(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--on-surface)]">Mark as Dropout</h2>
              <button onClick={() => setShowDropoutModal(null)} className="p-1 hover:bg-[var(--surface-container)] rounded-lg">
                <MaterialIcon className="text-xl text-[var(--t3)]">close</MaterialIcon>
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[var(--t3)] mb-4">This will set the student status to &quot;dropped&quot;. Please provide a reason.</p>
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Reason for Dropout</label>
                <select value={dropoutReason} onChange={(e) => setDropoutReason(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required>
                  <option value="">Select reason...</option>
                  <option value="Financial difficulties">Financial difficulties</option>
                  <option value="Family relocation">Family relocation</option>
                  <option value="Pregnancy">Pregnancy</option>
                  <option value="Early marriage">Early marriage</option>
                  <option value="Child labor">Child labor</option>
                  <option value="Illness/Disability">Illness/Disability</option>
                  <option value="Lost interest">Lost interest</option>
                  <option value="Death">Death</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setShowDropoutModal(null)}>Cancel</Button>
                <Button variant="danger" className="flex-1" onClick={onMarkDropout} disabled={!dropoutReason}>Mark as Dropout</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}