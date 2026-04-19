"use client";

import MaterialIcon from "@/components/MaterialIcon";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";

interface ClassData {
  id: string;
  name: string;
  level: string;
}

interface PromotionStudent {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  repeating?: boolean;
}

interface StudentPromotionPanelProps {
  onAutoPromote: () => void;
  autoPromoting: boolean;
  autoPromoteResult: any;
  selectedStudents: Set<string>;
  actionCounts: { promote: number; repeat: number; demote: number };
  promotionClasses: ClassData[];
  fromClass: string;
  setFromClass: (value: string) => void;
  toClass: string;
  setToClass: (value: string) => void;
  processPromotions: () => void;
  promoting: boolean;
  getNextClassOptions: () => ClassData[];
  getPrevClassOptions: () => ClassData[];
  toggleAll: () => void;
  promotionStudents: PromotionStudent[];
  promotionLoading: boolean;
  toggleStudent: (id: string) => void;
  studentActions: Record<string, { action: "promote" | "repeat" | "demote" }>;
  setAction: (studentId: string, action: "promote" | "repeat" | "demote") => void;
  promotionHistory: any[];
  showDemoteModal: string | null;
  setShowDemoteModal: (value: string | null) => void;
  demoteClass: string;
  setDemoteClass: (value: string) => void;
  demoteReason: string;
  setDemoteReason: (value: string) => void;
  confirmDemote: () => void;
}

export default function StudentPromotionPanel({
  onAutoPromote,
  autoPromoting,
  autoPromoteResult,
  selectedStudents,
  actionCounts,
  promotionClasses,
  fromClass,
  setFromClass,
  toClass,
  setToClass,
  processPromotions,
  promoting,
  getNextClassOptions,
  getPrevClassOptions,
  toggleAll,
  promotionStudents,
  promotionLoading,
  toggleStudent,
  studentActions,
  setAction,
  promotionHistory,
  showDemoteModal,
  setShowDemoteModal,
  demoteClass,
  setDemoteClass,
  demoteReason,
  setDemoteReason,
  confirmDemote,
}: StudentPromotionPanelProps) {
  return (
    <>
      <div className="flex gap-3 mb-6 flex-wrap">
        <Button onClick={onAutoPromote} disabled={autoPromoting} className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white">
          <MaterialIcon icon="auto_fix_high" style={{ fontSize: 18 }} />
          {autoPromoting ? "Auto-Promoting..." : "Auto-Promote All Students"}
        </Button>
      </div>

      {autoPromoteResult && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Auto-Promotion Results</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 rounded-xl bg-green-50">
                <div className="text-2xl font-bold text-green-600">{autoPromoteResult.summary.promoted}</div>
                <div className="text-xs text-green-700">Promoted</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-600">{autoPromoteResult.summary.retained}</div>
                <div className="text-xs text-yellow-700">Retained</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-red-50">
                <div className="text-2xl font-bold text-red-600">{autoPromoteResult.summary.errors}</div>
                <div className="text-xs text-red-700">Errors</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-50">
                <div className="text-2xl font-bold text-blue-600">{autoPromoteResult.summary.total}</div>
                <div className="text-xs text-blue-700">Total Processed</div>
              </div>
            </div>
            {autoPromoteResult.results.promoted.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-green-700 mb-2">Promoted Students</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {autoPromoteResult.results.promoted.map((result: any, index: number) => (
                    <div key={index} className="text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                      {result.name}: {result.fromClass} &rarr; {result.toClass}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {autoPromoteResult.results.retained.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-yellow-700 mb-2">Retained Students</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {autoPromoteResult.results.retained.map((result: any, index: number) => (
                    <div key={index} className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-lg">
                      {result.name}: {result.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {selectedStudents.size > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {actionCounts.promote > 0 && <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">{actionCounts.promote} to promote</span>}
          {actionCounts.repeat > 0 && <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">{actionCounts.repeat} repeating</span>}
          {actionCounts.demote > 0 && <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">{actionCounts.demote} to demote</span>}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Students</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--on-surface)]">From Class</label>
              {promotionClasses.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No classes available</div>
              ) : (
                <select value={fromClass} onChange={(e) => setFromClass(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20">
                  <option value="">Select class...</option>
                  {promotionClasses.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--on-surface)]">Promote To Class</label>
              {promotionClasses.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No classes available</div>
              ) : (
                <select value={toClass} onChange={(e) => setToClass(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20">
                  <option value="">Select target class...</option>
                  {getNextClassOptions().map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--on-surface)]">&nbsp;</label>
              <Button onClick={processPromotions} disabled={promoting || selectedStudents.size === 0} loading={promoting} className="w-full">
                <MaterialIcon icon="upgrade" style={{ fontSize: 18 }} />
                {promoting ? "Processing..." : `Process ${selectedStudents.size} Students`}
              </Button>
            </div>
          </div>

          {fromClass && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedStudents.size === promotionStudents.length && promotionStudents.length > 0} onChange={toggleAll} className="w-4 h-4" />
                  <span className="text-sm font-medium">Select All ({promotionStudents.length} students)</span>
                </label>
                <span className="text-sm text-[var(--t3)]">{selectedStudents.size} selected</span>
              </div>

              {promotionLoading ? (
                <TableSkeleton rows={5} />
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Name</th>
                        <th>Gender</th>
                        <th>Current Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promotionStudents.map((student) => {
                        const action = studentActions[student.id]?.action || "promote";
                        return (
                          <tr key={student.id}>
                            <td><input type="checkbox" checked={selectedStudents.has(student.id)} onChange={() => toggleStudent(student.id)} className="w-4 h-4" /></td>
                            <td className="font-medium text-sm">{student.first_name} {student.last_name}</td>
                            <td className="text-sm">{student.gender}</td>
                            <td>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${student.repeating ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                                {student.repeating ? "Repeating" : "Active"}
                              </span>
                            </td>
                            <td>
                              <div className="flex gap-1">
                                <button onClick={() => setAction(student.id, "promote")} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${action === "promote" ? "bg-green-100 border-green-300 text-green-800" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>Promote</button>
                                <button onClick={() => setAction(student.id, "repeat")} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${action === "repeat" ? "bg-yellow-100 border-yellow-300 text-yellow-800" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>Repeat</button>
                                <button onClick={() => setAction(student.id, "demote")} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${action === "demote" ? "bg-red-100 border-red-300 text-red-800" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>Demote</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {promotionStudents.length === 0 && (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState icon="group" title="No active students in this class" description="Select a class with active students to proceed" />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promotion History</CardTitle>
        </CardHeader>
        <CardBody>
          {promotionHistory.length === 0 ? (
            <EmptyState icon="history" title="No promotion history" description="Promotions will appear here once processed" />
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Type</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {promotionHistory.map((entry, index) => (
                    <tr key={index}>
                      <td className="text-sm">{new Date(entry.promoted_at).toLocaleDateString()}</td>
                      <td className="text-sm">{entry.student_id?.substring(0, 8)}...</td>
                      <td className="text-sm">{entry.from_classes?.name}</td>
                      <td className="text-sm">{entry.to_classes?.name}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${entry.promotion_type === "repeating" ? "bg-yellow-100 text-yellow-800" : entry.promotion_type === "demoted" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                          {entry.promotion_type || "promoted"}
                        </span>
                      </td>
                      <td className="text-sm">{entry.users?.full_name || "System"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {showDemoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDemoteModal(null)}>
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="font-semibold text-[var(--t1)]">Demote Student</div>
              <button onClick={() => setShowDemoteModal(null)} className="p-1 hover:bg-[var(--surface-container)] rounded-lg">
                <MaterialIcon className="text-xl text-[var(--t3)]">close</MaterialIcon>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">Demote to Class</label>
                <select value={demoteClass} onChange={(e) => setDemoteClass(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required>
                  <option value="">Select class...</option>
                  {getPrevClassOptions().map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">Reason</label>
                <textarea value={demoteReason} onChange={(e) => setDemoteReason(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] resize-none" rows={3} placeholder="Reason for demotion..." />
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setShowDemoteModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={confirmDemote} disabled={!demoteClass} className="flex-1">Confirm Demote</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}