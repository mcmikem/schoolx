"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";

const STATUS_STYLES: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent: "bg-red-50 text-red-700 border-red-200",
  late: "bg-amber-50 text-amber-700 border-amber-200",
  excused: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function ParentAttendancePage() {
  const { user, isDemo } = useAuth();
  const { isAuthorized, isChecking } = useParentPortalGuard();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, excused: 0, total: 0 });

  const fetchChildren = useCallback(async () => {
    if (isDemo) {
      const demo = [{ id: "child-1", first_name: "Isaac", last_name: "Mugisha", class_name: "P.5 Blue" }];
      setChildren(demo);
      setSelectedChild(demo[0]);
      return;
    }
    if (!user?.id) return;
    const { data } = await supabase
      .from("parent_students")
      .select("student:students(id, first_name, last_name, class:classes(name))")
      .eq("parent_id", user.id);
    const list = (data || []).map((d: any) => ({ ...d.student, class_name: d.student.class?.name || "—" }));
    setChildren(list);
    if (list.length > 0) setSelectedChild(list[0]);
  }, [user?.id, isDemo]);

  const fetchAttendance = useCallback(async (child: any) => {
    if (!child) return;
    setLoading(true);
    if (isDemo) {
      const demoRecords = Array.from({ length: 20 }, (_, i) => ({
        id: `demo-${i}`,
        date: new Date(Date.now() - i * 86400000).toISOString().split("T")[0],
        status: ["present", "present", "present", "absent", "late"][i % 5],
        notes: i % 5 === 3 ? "Parent not informed" : null,
      }));
      setRecords(demoRecords);
      computeStats(demoRecords);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("attendance")
      .select("id, date, status, remarks")
      .eq("student_id", child.id)
      .order("date", { ascending: false })
      .limit(60);
    const normalized = (data || []).map((record: any) => ({
      ...record,
      notes: record.remarks,
    }));
    setRecords(normalized);
    computeStats(normalized);
    setLoading(false);
  }, [isDemo]);

  const computeStats = (data: any[]) => {
    const s = { present: 0, absent: 0, late: 0, excused: 0, total: data.length };
    data.forEach((r) => { if (r.status in s) (s as any)[r.status]++; });
    setStats(s);
  };

  useEffect(() => { fetchChildren(); }, [fetchChildren]);
  useEffect(() => { if (selectedChild) fetchAttendance(selectedChild); }, [selectedChild, fetchAttendance]);

  if (isChecking || !isAuthorized) {
    return null;
  }

  const attendanceRate = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Attendance" subtitle="Track your child's daily attendance record" />

      {children.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {children.map((c) => (
            <button key={c.id} onClick={() => setSelectedChild(c)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${selectedChild?.id === c.id ? "bg-[var(--primary)] text-[var(--on-primary)]" : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"}`}>
              {c.first_name} {c.last_name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Attendance Rate", value: `${attendanceRate}%`, icon: "percent", color: attendanceRate >= 80 ? "text-emerald-600" : "text-red-600" },
          { label: "Present", value: stats.present, icon: "check_circle", color: "text-emerald-600" },
          { label: "Absent", value: stats.absent, icon: "cancel", color: "text-red-600" },
          { label: "Late", value: stats.late, icon: "schedule", color: "text-amber-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardBody className="text-center space-y-1">
              <MaterialIcon icon={s.icon} className={`text-2xl ${s.color}`} />
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">{s.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <h2 className="font-bold text-[var(--on-surface)] mb-4">Recent Records (Last 60 Days)</h2>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-[var(--surface-container)] rounded-2xl animate-pulse" />)}</div>
          ) : records.length === 0 ? (
            <p className="text-center text-[var(--on-surface-variant)] py-8">No attendance records found</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-[var(--surface-container-low)] rounded-2xl">
                  <div className="flex items-center gap-3">
                    <MaterialIcon icon={r.status === "present" ? "check_circle" : r.status === "absent" ? "cancel" : "schedule"}
                      className={r.status === "present" ? "text-emerald-500" : r.status === "absent" ? "text-red-500" : "text-amber-500"} />
                    <div>
                      <p className="font-bold text-sm text-[var(--on-surface)]">
                        {new Date(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      {r.notes && <p className="text-[10px] text-[var(--on-surface-variant)]">{r.notes}</p>}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[r.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
