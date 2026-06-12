"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useDormAttendance } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

type CheckType = "morning" | "night";
type AttendanceStatus = "present" | "absent" | "sick";
type AbsenceReason = "went_home" | "in_hospital" | "missing" | "other";

const CHECK_TYPES: { value: CheckType; label: string; time: string }[] = [
  { value: "morning", label: "Morning Roll Call", time: "5:30 AM" },
  { value: "night", label: "Night Roll Call", time: "9:00 PM" },
];

const ABSENCE_REASONS: { value: AbsenceReason; label: string }[] = [
  { value: "went_home", label: "Went Home" },
  { value: "in_hospital", label: "In Hospital" },
  { value: "missing", label: "Missing" },
  { value: "other", label: "Other" },
];

export default function DormAttendancePage() {
  const { school, user } = useAuth();
  const toast = useToast();

  const [selectedDormId, setSelectedDormId] = useState<string | undefined>();
  const [checkType, setCheckType] = useState<CheckType>("night");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [editingReason, setEditingReason] = useState<string | null>(null);

  const { attendance, students, dorms, loading, markAttendance, refetch } =
    useDormAttendance(selectedDormId, date, checkType);

  const selectedDorm = dorms.find((d: any) => d.id === selectedDormId);

  const attendanceMap = new Map<string, any>();
  attendance.forEach((a: any) => {
    attendanceMap.set(a.student_id, a);
  });

  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    const existing = attendanceMap.get(studentId);
    markAttendance(studentId, status, {
      absence_reason: status === "absent" ? existing?.absence_reason || undefined : undefined,
      absence_notes: status === "absent" ? existing?.absence_notes : undefined,
      id: existing?.id,
    });
    if (status === "absent") setEditingReason(studentId);
  };

  const updateReason = (studentId: string, reason: AbsenceReason, notes?: string) => {
    const existing = attendanceMap.get(studentId);
    if (existing) {
      markAttendance(studentId, existing.status, {
        ...existing,
        absence_reason: reason,
        absence_notes: notes,
      });
    }
  };

  const markAllPresent = () => {
    students.forEach((s: any) => {
      markAttendance(s.id, "present", {
        id: attendanceMap.get(s.id)?.id,
      });
    });
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const checkedAt = new Date().toISOString();
      const toUpdate: any[] = [];
      const toInsert: any[] = [];

      for (const [studentId, record] of Array.from(attendanceMap.entries())) {
        if (record.id) {
          toUpdate.push({
            id: record.id,
            status: record.status,
            absence_reason: record.absence_reason,
            absence_notes: record.absence_notes,
            checked_at: checkedAt,
          });
        } else {
          toInsert.push({
            dorm_id: selectedDormId,
            date,
            student_id: studentId,
            check_type: checkType,
            status: record.status,
            absence_reason: record.absence_reason,
            absence_notes: record.absence_notes,
            checked_by: user?.id,
            checked_at: checkedAt,
          });
        }
      }

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("dorm_attendance")
          .insert(toInsert);
        if (insertError) throw insertError;
      }

      if (toUpdate.length > 0) {
        const { error: upsertError } = await supabase
          .from("dorm_attendance")
          .upsert(toUpdate, { onConflict: "id" });
        if (upsertError) throw upsertError;
      }

      toast.success("Attendance saved successfully");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Array.from(attendanceMap.values()).filter((a) => a.status === "present").length;
  const absentCount = Array.from(attendanceMap.values()).filter((a) => a.status === "absent").length;
  const sickCount = Array.from(attendanceMap.values()).filter((a) => a.status === "sick").length;
  const totalMarked = Array.from(attendanceMap.values()).length;

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Dorm Attendance"
        subtitle="Morning (5:30 AM) and Night (9:00 PM) roll calls"
      />

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Dorm</label>
            {dorms.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No dorms</div>
            ) : (
              <select
                value={selectedDormId || ""}
                onChange={(e) => setSelectedDormId(e.target.value || undefined)}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
              >
                <option value="">Select dorm...</option>
                {dorms.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Check Type</label>
            <select value={checkType} onChange={(e) => setCheckType(e.target.value as CheckType)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm">
              {CHECK_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label} ({ct.time})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">&nbsp;</label>
            <Button variant="secondary" onClick={markAllPresent} disabled={!selectedDormId} className="w-full">
              <MaterialIcon icon="check_circle" className="text-base" />
              Mark All Present
            </Button>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">&nbsp;</label>
            <Button onClick={saveAttendance} disabled={saving || !selectedDormId} className="w-full">
              {saving ? "Saving..." : "Save Attendance"}
            </Button>
          </div>
        </div>
      </Card>

      {selectedDormId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{presentCount}</div>
            <div className="text-sm text-[var(--t3)]">Present</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{absentCount}</div>
            <div className="text-sm text-[var(--t3)]">Absent</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{sickCount}</div>
            <div className="text-sm text-[var(--t3)]">Sick</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-[var(--primary)]">{totalMarked}/{students.length}</div>
            <div className="text-sm text-[var(--t3)]">Marked</div>
          </Card>
        </div>
      )}

      {selectedDormId && (
        <Card>
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--t1)]">{selectedDorm?.name} — Students ({students.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Student</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Status</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Absence Reason</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student: any) => {
                  const record = attendanceMap.get(student.id);
                  const status = record?.status || "pending";

                  return (
                    <tr key={student.id} className="border-b border-[var(--border)]">
                      <td className="p-4 font-medium text-[var(--t1)]">{student.first_name} {student.last_name}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          status === "present" ? "bg-green-100 text-green-800" :
                          status === "absent" ? "bg-red-100 text-red-800" :
                          status === "sick" ? "bg-amber-100 text-amber-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="p-4">
                        {status === "absent" && editingReason === student.id ? (
                          <div className="flex flex-col gap-1">
                            <select
                              value={record?.absence_reason || ""}
                              onChange={(e) => updateReason(student.id, e.target.value as AbsenceReason)}
                              className="px-3 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs"
                            >
                              <option value="">Select reason...</option>
                              {ABSENCE_REASONS.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Notes (optional)"
                              value={record?.absence_notes || ""}
                              onChange={(e) => updateReason(student.id, record?.absence_reason || "other", e.target.value)}
                              className="px-3 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs"
                            />
                            <button onClick={() => setEditingReason(null)} className="text-xs text-blue-600">Done</button>
                          </div>
                        ) : status === "absent" && record?.absence_reason ? (
                          <span className="text-sm text-red-600">
                            {ABSENCE_REASONS.find((r) => r.value === record.absence_reason)?.label}
                            {record.absence_notes ? ` — ${record.absence_notes}` : ""}
                          </span>
                        ) : (
                          <span className="text-sm text-[var(--t3)]">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateStatus(student.id, "present")}
                            className={`px-2 py-1 rounded text-xs font-bold ${status === "present" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
                          >P</button>
                          <button
                            onClick={() => updateStatus(student.id, "absent")}
                            className={`px-2 py-1 rounded text-xs font-bold ${status === "absent" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}
                          >A</button>
                          <button
                            onClick={() => updateStatus(student.id, "sick")}
                            className={`px-2 py-1 rounded text-xs font-bold ${status === "sick" ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-600"}`}
                          >S</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && !loading && (
                  <tr><td colSpan={4} className="text-center py-8 text-[var(--t3)]">No students assigned to this dorm</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!selectedDormId && (
        <Card className="p-12 text-center">
          <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">bed</MaterialIcon>
          <p className="mt-2 text-[var(--t3)]">Select a dorm to take attendance</p>
        </Card>
      )}
    </div>
    </PageErrorBoundary>
  );
}
