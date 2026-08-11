"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import { ChildSelector } from "@/components/parent-portal/ChildSelector";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";
import {
  calculateAttendanceStats,
  normalizeAttendanceRecords,
  ParentPortalAttendanceRecord,
} from "@/lib/parent-portal";

const STATUS_STYLES: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent: "bg-red-50 text-red-700 border-red-200",
  late: "bg-amber-50 text-amber-700 border-amber-200",
  excused: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function ParentAttendancePage() {
  const { isDemo } = useAuth();
  const { selectedChild } = useParentPortal();
  const [records, setRecords] = useState<ParentPortalAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, excused: 0, total: 0 });

  const fetchAttendance = useCallback(
    async (child: typeof selectedChild) => {
      if (!child) return;
      setLoading(true);
      if (isDemo) {
        const demoRecords = Array.from({ length: 20 }, (_, i) => ({
          id: `demo-${i}`,
          date: new Date(Date.now() - i * 86400000).toISOString().split("T")[0],
          status: ["present", "present", "present", "absent", "late"][i % 5],
          notes: i % 5 === 3 ? "Parent not informed" : null,
        }));
        const normalized = normalizeAttendanceRecords(demoRecords);
        setRecords(normalized);
        setStats(calculateAttendanceStats(normalized));
        setLoading(false);
        return;
      }
      const { data } = await withTimeout(
        supabase
          .from("attendance")
          .select("id, date, status, remarks")
          .eq("student_id", child.id)
          .order("date", { ascending: false })
          .limit(60),
        12000,
        timeoutFallback(),
      );
      const normalized = normalizeAttendanceRecords(data || []);
      setRecords(normalized);
      setStats(calculateAttendanceStats(normalized));
      setLoading(false);
    },
    [isDemo],
  );

  useEffect(() => {
    if (selectedChild) fetchAttendance(selectedChild);
  }, [selectedChild, fetchAttendance]);

  const attendanceRate = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;

  return (
    <ParentPortalShell pageTitle="Attendance">
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader
          title="Attendance"
          subtitle="See how often your child is present, absent, or late"
          variant="premium"
        />

        <ChildSelector />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Attendance Rate",
              value: `${attendanceRate}%`,
              icon: "percent",
              color: attendanceRate >= 80 ? "text-emerald-600" : "text-red-600",
            },
            { label: "Present", value: stats.present, icon: "check_circle", color: "text-emerald-600" },
            { label: "Absent", value: stats.absent, icon: "cancel", color: "text-red-600" },
            { label: "Late", value: stats.late, icon: "schedule", color: "text-amber-600" },
          ].map((s) => (
            <Card key={s.label}>
              <CardBody className="text-center space-y-2 bg-[linear-gradient(180deg,var(--portal-surface-tint)_0%,var(--portal-surface)_100%)]">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[15px] border border-[var(--border)] bg-[var(--surface-container-low)]">
                  <MaterialIcon icon={s.icon} className={`text-xl ${s.color}`} />
                </div>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                  {s.label}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>

        <Card>
          <CardBody>
            <h2 className="font-bold text-[var(--on-surface)] mb-4">Recent Records (Last 60 Days)</h2>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-[var(--surface-container)] rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <p className="text-center text-[var(--on-surface-variant)] py-8">No attendance records found</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 bg-[var(--surface-container-low)] rounded-[18px] border border-[var(--border)]"
                  >
                    <div className="flex items-center gap-3">
                      <MaterialIcon
                        icon={r.status === "present" ? "check_circle" : r.status === "absent" ? "cancel" : "schedule"}
                        className={
                          r.status === "present"
                            ? "text-emerald-500"
                            : r.status === "absent"
                              ? "text-red-500"
                              : "text-amber-500"
                        }
                      />
                      <div>
                        <p className="font-bold text-sm text-[var(--on-surface)]">
                          {new Date(r.date).toLocaleDateString("en-GB", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {r.notes && <p className="text-[10px] text-[var(--on-surface-variant)]">{r.notes}</p>}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[r.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </ParentPortalShell>
  );
}
