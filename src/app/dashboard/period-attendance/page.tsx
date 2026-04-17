"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useClasses } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { EmptyState } from "@/components/EmptyState";

const PERIODS = [
  "Period 1",
  "Period 2",
  "Period 3",
  "Period 4",
  "Period 5",
  "Period 6",
  "Period 7",
  "Period 8",
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
  const [students, setStudents] = useState<
    Array<{
      id: string;
      first_name: string;
      last_name: string;
      student_number: string;
    }>
  >([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchStudents = useCallback(async () => {
    if (!selectedClass || !school?.id) return;
    try {
      setLoading(true);
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("school_id", school.id)
        .eq("class_id", selectedClass)
        .eq("status", "active")
        .order("first_name");
      setStudents(data || []);

      const { data: attData } = await supabase
        .from("period_attendance")
        .select("*")
        .eq("class_id", selectedClass)
        .eq("date", date)
        .eq("period", selectedPeriod);

      const attMap: Record<string, string> = {};
      attData?.forEach((a) => {
        attMap[a.student_id] = a.status;
      });
      setAttendance(attMap);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, school?.id, date, selectedPeriod]);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
    }
  }, [selectedClass, date, selectedPeriod, fetchStudents]);

  const markAttendance = (studentId: string, status: string) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    if (!selectedClass || !user?.id) return;
    try {
      setSaving(true);
      const records = Object.entries(attendance).map(([studentId, status]) => ({
        school_id: school?.id,
        student_id: studentId,
        class_id: selectedClass,
        date,
        period: selectedPeriod,
        status,
        recorded_by: user.id,
      }));

      const { error } = await supabase
        .from("period_attendance")
        .upsert(records, { onConflict: "student_id,date,period" });

      if (error) throw error;
      toast.success("Period attendance saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Period Attendance"
        subtitle="Mark attendance for each period"
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

      {!selectedClass ? (
        <Card className="p-12 text-center">
          <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">
            fact_check
          </MaterialIcon>
          <h3 className="text-lg font-semibold text-[var(--t1)] mt-4 mb-2">
            Select a class
          </h3>
          <p className="text-[var(--t3)]">
            Choose a class to mark period attendance
          </p>
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
          <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">
            group
          </MaterialIcon>
          <h3 className="text-lg font-semibold text-[var(--t1)] mt-4 mb-2">
            No students
          </h3>
          <p className="text-[var(--t3)]">Add students to this class first</p>
        </Card>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {students.map((student) => (
              <Card key={student.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        {student.first_name?.charAt(0)}
                        {student.last_name?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-[var(--t1)]">
                        {student.first_name} {student.last_name}
                      </div>
                      <div className="text-xs text-[var(--t3)]">
                        {student.student_number}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[
                      {
                        status: "present",
                        label: "Present",
                        color: "bg-green-100 text-green-700 border-green-200",
                      },
                      {
                        status: "absent",
                        label: "Absent",
                        color: "bg-red-100 text-red-700 border-red-200",
                      },
                      {
                        status: "late",
                        label: "Late",
                        color:
                          "bg-yellow-100 text-yellow-700 border-yellow-200",
                      },
                    ].map((option) => (
                      <button
                        key={option.status}
                        onClick={() =>
                          markAttendance(student.id, option.status)
                        }
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          attendance[student.id] === option.status
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
            disabled={saving || Object.keys(attendance).length === 0}
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
