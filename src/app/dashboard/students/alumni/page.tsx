"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/ui/Modal";

export default function AlumniPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();

  const [alumni, setAlumni] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [selectedAlumnus, setSelectedAlumnus] = useState<any>(null);

  const fetchAlumni = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      if (isDemo) {
        setAlumni([]);
        return;
      }
      const { data, error } = await supabase
        .from("students")
        .select("*, classes(name, level)")
        .eq("school_id", school.id)
        .eq("status", "completed")
        .order("last_name", { ascending: true });
      if (error) throw error;
      setAlumni(data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load alumni");
    } finally {
      setLoading(false);
    }
  }, [school?.id, isDemo, toast]);

  useEffect(() => {
    if (!school?.id) return;
    fetchAlumni();
  }, [school?.id, fetchAlumni]);

  const graduationYears = useMemo(() => {
    const years = new Set<string>();
    alumni.forEach((a) => {
      const year = a.admission_date ? new Date(a.admission_date).getFullYear().toString() : null;
      if (year) years.add(year);
    });
    return Array.from(years).sort().reverse();
  }, [alumni]);

  const filtered = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return alumni.filter((a) => {
      const name = `${a.first_name} ${a.last_name}`.toLowerCase();
      const matchesSearch = !search || name.includes(search) || (a.student_number || "").toLowerCase().includes(search);
      const matchesYear =
        yearFilter === "all" ||
        (a.admission_date ? new Date(a.admission_date).getFullYear().toString() === yearFilter : false);
      return matchesSearch && matchesYear;
    });
  }, [alumni, searchTerm, yearFilter]);

  const exportCSV = () => {
    if (!filtered.length) {
      toast.error("No alumni to export");
      return;
    }
    const headers = ["Name", "Student Number", "Gender", "Class", "Admission Date", "Parent Name", "Parent Phone"];
    const rows = filtered.map((a) => [
      `${a.first_name} ${a.last_name}`,
      a.student_number || "",
      a.gender === "M" ? "Male" : "Female",
      a.classes?.name || "",
      a.admission_date || "",
      a.parent_name || "",
      a.parent_phone || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alumni.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  };

  return (
    <PageErrorBoundary>
      <div className="space-y-6 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
        <PageHeader title="Alumni" subtitle={`${alumni.length} former students`} variant="premium" />

        <Card>
          <CardHeader>
            <CardTitle>Alumni Directory</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1 relative">
                <MaterialIcon
                  icon="search"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)] text-sm"
                />
                <input
                  type="text"
                  placeholder="Search by name or student number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
                />
              </div>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
              >
                <option value="all">All Years</option>
                {graduationYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <Button onClick={exportCSV} variant="secondary">
                <MaterialIcon icon="file_download" style={{ fontSize: 18 }} />
                Export CSV
              </Button>
            </div>

            {loading ? (
              <TableSkeleton rows={8} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="groups"
                title="No alumni found"
                description={
                  alumni.length === 0
                    ? "No students have been marked as completed yet"
                    : "Try adjusting your search or filters"
                }
              />
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Student #</th>
                      <th>Gender</th>
                      <th>Last Class</th>
                      <th>Admission</th>
                      <th>Parent</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => (
                      <tr key={a.id}>
                        <td className="font-medium">
                          {a.first_name} {a.last_name}
                        </td>
                        <td className="text-sm font-mono">{a.student_number || "-"}</td>
                        <td className="text-sm">{a.gender === "M" ? "Male" : "Female"}</td>
                        <td>
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                            {a.classes?.name || "N/A"}
                          </span>
                        </td>
                        <td className="text-sm">
                          {a.admission_date ? new Date(a.admission_date).toLocaleDateString() : "-"}
                        </td>
                        <td className="text-sm">{a.parent_name || "-"}</td>
                        <td>
                          <button
                            onClick={() => setSelectedAlumnus(a)}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {selectedAlumnus && (
        <Modal isOpen={!!selectedAlumnus} onClose={() => setSelectedAlumnus(null)} title="Alumni Profile" size="md">
          <div className="space-y-4 p-2">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl font-bold text-blue-700">
                  {selectedAlumnus.first_name?.[0]}
                  {selectedAlumnus.last_name?.[0]}
                </span>
              </div>
              <h3 className="text-lg font-bold">
                {selectedAlumnus.first_name} {selectedAlumnus.last_name}
              </h3>
              <p className="text-sm text-[var(--t3)]">{selectedAlumnus.student_number || "No number"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-gray-50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">Gender</div>
                <div className="font-semibold mt-0.5">{selectedAlumnus.gender === "M" ? "Male" : "Female"}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">Class</div>
                <div className="font-semibold mt-0.5">{selectedAlumnus.classes?.name || "N/A"}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">Admission Date</div>
                <div className="font-semibold mt-0.5">
                  {selectedAlumnus.admission_date
                    ? new Date(selectedAlumnus.admission_date).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">Status</div>
                <div className="font-semibold mt-0.5 text-blue-600">Completed</div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)] mb-1">
                Parent / Guardian
              </div>
              <div className="text-sm">
                {selectedAlumnus.parent_name || "N/A"} · {selectedAlumnus.parent_phone || "N/A"}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </PageErrorBoundary>
  );
}
