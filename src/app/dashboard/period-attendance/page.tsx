"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useClasses, usePeriodAttendance } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { EmptyState } from "@/components/EmptyState";
import PersonInitials from "@/components/ui/PersonInitials";

const PERIODS = ["Period 1", "Period 2", "Period 3", "Period 4", "Period 5", "Period 6", "Period 7", "Period 8"];

const STATUS_OPTIONS = [
  { status: "present", label: "Present", color: "bg-green-100 text-green-700 border-green-200" },
  { status: "absent", label: "Absent", color: "bg-red-100 text-red-700 border-red-200" },
  { status: "late", label: "Late", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { status: "excused", label: "Excused", color: "bg-purple-100 text-purple-700 border-purple-200" },
];

export default function PeriodAttendancePage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("Period 1");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [saving, setSaving] = useState(false);

  const { attendance, students, loading, markAttendance } = usePeriodAttendance(
    selectedClass || undefined,
    date,
    selectedPeriod,
  );

  const attendanceMap = Object.fromEntries(attendance.map((a: any) => [a.student_id, a.status]));

  const saveAttendance = async () => {
    if (!selectedClass || !user?.id) return;
    try {
      setSaving(true);
      const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
        school_id: school?.id,
        student_id: studentId,
        class_id: selectedClass,
        date,
        period: selectedPeriod,
        status,
        recorded_by: user.id,
      }));

      const { error } = await withTimeout(
        supabase.from("period_attendance").upsert(records, { onConflict: "student_id,date,period" }),
        15000,
        timeoutFallback(),
      );

      if (error) throw error;
      toast.success("Period attendance saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (students.length === 0) return;
    const headers = ["Student Number", "First Name", "Last Name", "Status"];
    const rows = students.map((student: any) => {
      const status = attendanceMap[student.id] || "not marked";
      return [student.student_number, student.first_name, student.last_name, status];
    });
    const csvContent = [
      `Period Attendance - ${selectedClass} - ${selectedPeriod} - ${date}`,
      "",
      headers.join(","),
      ...rows.map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `period-attendance-${selectedPeriod}-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  const presentCount = Object.values(attendanceMap).filter((s) => s === "present").length;
  const absentCount = Object.values(attendanceMap).filter((s) => s === "absent").length;
  const lateCount = Object.values(attendanceMap).filter((s) => s === "late").length;
  const excusedCount = Object.values(attendanceMap).filter((s) => s === "excused").length;

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Period Attendance"
          subtitle="Mark attendance for each period"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={exportCsv}
              disabled={students.length === 0}
              icon={<MaterialIcon icon="download" />}
            >
              Export CSV
            </Button>
          }
        />

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {classes.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-800">
              No classes available
            </div>
          ) : (
            <select
              value={selectedClass || ""}
              onChange={(e) => setSelectedClass(e.target.value || null)}
              className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium sm:w-48"
              aria-label="Select class"
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium sm:w-40"
            aria-label="Select period"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium sm:w-48"
            aria-label="Attendance date"
          />
        </div>

        {selectedClass && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{presentCount}</div>
              <div className="text-xs text-[var(--t3)]">Present</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{absentCount}</div>
              <div className="text-xs text-[var(--t3)]">Absent</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{lateCount}</div>
              <div className="text-xs text-[var(--t3)]">Late</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">{excusedCount}</div>
              <div className="text-xs text-[var(--t3)]">Excused</div>
            </Card>
          </div>
        )}

        {!selectedClass ? (
          <Card className="p-12 text-center">
            <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">fact_check</MaterialIcon>
            <h3 className="text-lg font-semibold text-[var(--t1)] mt-4 mb-2">Select a class</h3>
            <p className="text-[var(--t3)]">Choose a class to mark period attendance</p>
          </Card>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6">
                <div className="animate-pulse bg-[var(--surface-container)] h-12 rounded" />
              </Card>
            ))}
          </div>
        ) : students.length === 0 ? (
          <Card className="p-12 text-center">
            <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">group</MaterialIcon>
            <h3 className="text-lg font-semibold text-[var(--t1)] mt-4 mb-2">No students</h3>
            <p className="text-[var(--t3)]">Add students to this class first</p>
          </Card>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {students.map((student: any) => (
                <Card key={student.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PersonInitials name={`${student.first_name} ${student.last_name}`} size={40} />
                      <div>
                        <div className="font-medium text-[var(--t1)]">
                          {student.first_name} {student.last_name}
                        </div>
                        <div className="text-xs text-[var(--t3)]">{student.student_number}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option.status}
                          onClick={() => markAttendance(student.id, option.status)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            attendanceMap[student.id] === option.status
                              ? option.color
                              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Button
              onClick={saveAttendance}
              disabled={saving || Object.keys(attendanceMap).length === 0}
              className="w-full"
            >
              {saving ? "Saving..." : "Save Period Attendance"}
            </Button>
          </>
        )}
      </div>
    </PageErrorBoundary>
  );
}
