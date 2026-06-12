"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useClasses } from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { logger } from "@/lib/logger";

export default function AttendanceHistoryPage() {
  const { school, user } = useAuth();
  const { classes } = useClasses(school?.id);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: 0,
  });

  const fetchHistory = useCallback(async () => {
    if (!school?.id) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        school_id: school.id,
        date_from: startDate,
        date_to: endDate,
      });
      if (selectedClass) params.set("class_id", selectedClass);

      const res = await fetch(`/api/attendance/report/?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "Failed to fetch history");
      }

      let recordsData: any[] = [];
      if (selectedClass || search.trim()) {
        const allStudents = json.data.students || [];
        const studentMap = new Map(allStudents.map((s: any) => [s.student_id, s]));
        recordsData = Object.entries(studentMap).map(([sid, s]: [string, any]) => ({
          date: "",
          students: {
            id: sid,
            first_name: s.first_name,
            last_name: s.last_name,
            student_number: s.student_number,
            classes: { name: "" },
          },
          status: "",
          present: s.present,
          absent: s.absent,
          late: s.late,
          excused: s.excused,
          total: s.total,
          rate: s.rate,
        }));
      } else {
        recordsData = json.data.students || [];
      }

      let filtered = recordsData;
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (r: any) =>
            r.first_name?.toLowerCase().includes(q) ||
            r.last_name?.toLowerCase().includes(q) ||
            r.student_number?.toLowerCase().includes(q) ||
            r.students?.first_name?.toLowerCase().includes(q) ||
            r.students?.last_name?.toLowerCase().includes(q) ||
            r.students?.student_number?.toLowerCase().includes(q),
        );
      }

      setRecords(filtered);
      setSummary({
        present: json.data.summary.present,
        absent: json.data.summary.absent,
        late: json.data.summary.late,
        excused: json.data.summary.excused,
        total: json.data.summary.total,
      });
    } catch (err) {
      logger.error("Error fetching attendance history:", err);
    } finally {
      setLoading(false);
    }
  }, [school?.id, startDate, endDate, selectedClass, search]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const exportCsv = () => {
    if (records.length === 0) return;
    const headers = ["Student Number", "First Name", "Last Name", "Present", "Absent", "Late", "Excused", "Total", "Rate%"];
    const rows = records.map((r: any) => [
      r.student_number || r.students?.student_number || "",
      r.first_name || r.students?.first_name || "",
      r.last_name || r.students?.last_name || "",
      r.present ?? 0,
      r.absent ?? 0,
      r.late ?? 0,
      r.excused ?? 0,
      r.total ?? 0,
      r.rate ?? 0,
    ]);
    const csvContent = [
      `Attendance History Summary - ${startDate} to ${endDate}`,
      "",
      headers.join(","),
      ...rows.map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-history-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalRate = summary.total > 0
    ? ((summary.present / summary.total) * 100).toFixed(1)
    : "0.0";

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Attendance History"
        subtitle="View and export attendance records"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={exportCsv}
            disabled={records.length === 0}
            icon={<MaterialIcon icon="download" />}
          >
            Export CSV
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Class</label>
            <select
              value={selectedClass || ""}
              onChange={(e) => setSelectedClass(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
            >
              <option value="">All Classes</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Search Student</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or student number..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-[var(--primary)]">{summary.total}</div>
          <div className="text-xs text-[var(--t3)]">Total Records</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{summary.present}</div>
          <div className="text-xs text-[var(--t3)]">Present</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{summary.absent}</div>
          <div className="text-xs text-[var(--t3)]">Absent</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{summary.late}</div>
          <div className="text-xs text-[var(--t3)]">Late</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{summary.excused}</div>
          <div className="text-xs text-[var(--t3)]">Excused</div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-[var(--t1)]">Attendance Rate:</span>
          <span className="text-lg font-bold text-green-600">{totalRate}%</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, parseFloat(totalRate))}%` }}
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : records.length === 0 ? (
        <EmptyState
          icon="history"
          title="No attendance records found"
          description="Try adjusting your date range or class filter"
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-3 text-left text-xs font-semibold text-[var(--t2)] uppercase">Student</th>
                  <th className="p-3 text-left text-xs font-semibold text-[var(--t2)] uppercase">Number</th>
                  <th className="p-3 text-center text-xs font-semibold text-[var(--t2)] uppercase">Present</th>
                  <th className="p-3 text-center text-xs font-semibold text-[var(--t2)] uppercase">Absent</th>
                  <th className="p-3 text-center text-xs font-semibold text-[var(--t2)] uppercase">Late</th>
                  <th className="p-3 text-center text-xs font-semibold text-[var(--t2)] uppercase">Excused</th>
                  <th className="p-3 text-center text-xs font-semibold text-[var(--t2)] uppercase">Total</th>
                  <th className="p-3 text-center text-xs font-semibold text-[var(--t2)] uppercase">Rate</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r: any, i: number) => {
                  const firstName = r.first_name || r.students?.first_name || "";
                  const lastName = r.last_name || r.students?.last_name || "";
                  const studentNumber = r.student_number || r.students?.student_number || "";
                  const rate = r.rate ?? (r.total > 0 ? Math.round((r.present / r.total) * 1000) / 10 : 0);
                  return (
                    <tr key={r.student_id || i} className="border-t border-[var(--border)] hover:bg-[var(--surface-container)]">
                      <td className="p-3 text-sm font-medium text-[var(--t1)]">{firstName} {lastName}</td>
                      <td className="p-3 text-sm text-[var(--t2)]">{studentNumber}</td>
                      <td className="p-3 text-sm text-center text-green-600 font-medium">{r.present ?? 0}</td>
                      <td className="p-3 text-sm text-center text-red-600 font-medium">{r.absent ?? 0}</td>
                      <td className="p-3 text-sm text-center text-yellow-600 font-medium">{r.late ?? 0}</td>
                      <td className="p-3 text-sm text-center text-purple-600 font-medium">{r.excused ?? 0}</td>
                      <td className="p-3 text-sm text-center text-[var(--t1)]">{r.total ?? 0}</td>
                      <td className="p-3 text-sm text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          rate >= 90 ? "bg-green-100 text-green-800" :
                          rate >= 75 ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 text-center text-xs text-[var(--t3)] border-t border-[var(--border)]">
            {records.length} student(s)
          </div>
        </Card>
      )}
    </div>
    </PageErrorBoundary>
  );
}
