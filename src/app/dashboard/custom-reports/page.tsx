"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

interface DataColumn {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "currency";
  category: "student" | "finance" | "academic";
}

const AVAILABLE_COLUMNS: DataColumn[] = [
  {
    id: "stu_id",
    label: "Student ID Number",
    type: "text",
    category: "student",
  },
  { id: "stu_name", label: "Full Name", type: "text", category: "student" },
  {
    id: "stu_class",
    label: "Current Class",
    type: "text",
    category: "student",
  },
  { id: "stu_gender", label: "Gender", type: "text", category: "student" },
  { id: "stu_dob", label: "Date of Birth", type: "date", category: "student" },
  {
    id: "fin_balance",
    label: "Outstanding Fees",
    type: "currency",
    category: "finance",
  },
  {
    id: "fin_paid",
    label: "Total Paid",
    type: "currency",
    category: "finance",
  },
  {
    id: "fin_wallet",
    label: "Canteen Wallet",
    type: "currency",
    category: "finance",
  },
  {
    id: "aca_attendance",
    label: "Attendance %",
    type: "number",
    category: "academic",
  },
  {
    id: "aca_average",
    label: "Term Average",
    type: "number",
    category: "academic",
  },
];

export default function CustomReportsBuilder() {
  const { school } = useAuth();
  const toast = useToast();

  const [selectedColumns, setSelectedColumns] = useState<DataColumn[]>([
    AVAILABLE_COLUMNS[0],
    AVAILABLE_COLUMNS[1],
    AVAILABLE_COLUMNS[2],
  ]);

  const [reportTitle, setReportTitle] = useState("Untitled Custom Report");
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const unselectedColumns = AVAILABLE_COLUMNS.filter(
    (col) => !selectedColumns.find((sc) => sc.id === col.id),
  );

  const addColumn = (col: DataColumn) => {
    setSelectedColumns([...selectedColumns, col]);
  };

  const removeColumn = (id: string) => {
    setSelectedColumns(selectedColumns.filter((c) => c.id !== id));
  };

  const loadPreview = useCallback(async () => {
    if (!school?.id || selectedColumns.length === 0) { setPreviewData([]); return; }
    setPreviewLoading(true);
    try {
      const { data: students } = await supabase
        .from("students")
        .select("id, student_number, first_name, last_name, gender, date_of_birth, class_id, canteen_balance, classes(name)")
        .eq("school_id", school.id)
        .eq("status", "active")
        .limit(5);
      const rows = (students || []).map((s: any) => {
        const row: Record<string, string> = {};
        selectedColumns.forEach((col) => {
          switch (col.id) {
            case "stu_id": row[col.id] = s.student_number || "-"; break;
            case "stu_name": row[col.id] = `${s.first_name} ${s.last_name}`; break;
            case "stu_class": row[col.id] = s.classes?.name || "-"; break;
            case "stu_gender": row[col.id] = s.gender === "M" ? "Male" : s.gender === "F" ? "Female" : "-"; break;
            case "stu_dob": row[col.id] = s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString() : "-"; break;
            case "fin_wallet": row[col.id] = `UGX ${Number(s.canteen_balance || 0).toLocaleString()}`; break;
            default: row[col.id] = "…";
          }
        });
        return row;
      });
      setPreviewData(rows);
    } catch { setPreviewData([]); }
    finally { setPreviewLoading(false); }
  }, [school?.id, selectedColumns]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const handleExport = async () => {
    if (!school?.id) { toast.error("No school selected"); return; }
    if (selectedColumns.length === 0) { toast.error("Add at least one column to export"); return; }
    setExporting(true);
    try {
      const { data: students } = await supabase
        .from("students")
        .select("id, student_number, first_name, last_name, gender, date_of_birth, class_id, canteen_balance, classes(name)")
        .eq("school_id", school.id)
        .eq("status", "active");

      const needsFinance = selectedColumns.some((c) => c.id === "fin_paid" || c.id === "fin_balance");
      const needsAttendance = selectedColumns.some((c) => c.id === "aca_attendance");
      const needsGrades = selectedColumns.some((c) => c.id === "aca_average");

      const studentIds = (students || []).map((s: any) => s.id);
      const paymentsByStudent: Record<string, number> = {};
      const attendanceByStudent: Record<string, number> = {};
      const gradesByStudent: Record<string, number> = {};
      let expectedFee = 0;

      if (needsFinance && studentIds.length > 0) {
        const [{ data: payments }, { data: feeStructure }] = await Promise.all([
          supabase.from("fee_payments").select("student_id, amount_paid").in("student_id", studentIds),
          supabase.from("fee_structure").select("amount").eq("school_id", school.id),
        ]);
        (payments || []).forEach((p: any) => {
          paymentsByStudent[p.student_id] = (paymentsByStudent[p.student_id] || 0) + Number(p.amount_paid);
        });
        expectedFee = (feeStructure || []).reduce((s: number, f: any) => s + Number(f.amount), 0);
      }

      if (needsAttendance && studentIds.length > 0) {
        const { data: attendance } = await supabase.from("attendance").select("student_id, status").in("student_id", studentIds);
        const total: Record<string, number> = {};
        const present: Record<string, number> = {};
        (attendance || []).forEach((a: any) => {
          total[a.student_id] = (total[a.student_id] || 0) + 1;
          if (a.status === "present") present[a.student_id] = (present[a.student_id] || 0) + 1;
        });
        studentIds.forEach((id) => {
          attendanceByStudent[id] = total[id] ? Math.round(((present[id] || 0) / total[id]) * 100) : 0;
        });
      }

      if (needsGrades && studentIds.length > 0) {
        const { data: grades } = await supabase.from("grades").select("student_id, score").in("student_id", studentIds);
        const sums: Record<string, number> = {};
        const counts: Record<string, number> = {};
        (grades || []).forEach((g: any) => {
          if (g.score != null) {
            sums[g.student_id] = (sums[g.student_id] || 0) + Number(g.score);
            counts[g.student_id] = (counts[g.student_id] || 0) + 1;
          }
        });
        studentIds.forEach((id) => {
          gradesByStudent[id] = counts[id] ? Math.round(sums[id] / counts[id]) : 0;
        });
      }

      const headers = selectedColumns.map((c) => c.label);
      const csvRows = [headers.join(",")];
      (students || []).forEach((s: any) => {
        const row = selectedColumns.map((col) => {
          let val = "";
          switch (col.id) {
            case "stu_id": val = s.student_number || ""; break;
            case "stu_name": val = `${s.first_name} ${s.last_name}`; break;
            case "stu_class": val = (s.classes as any)?.name || ""; break;
            case "stu_gender": val = s.gender === "M" ? "Male" : s.gender === "F" ? "Female" : ""; break;
            case "stu_dob": val = s.date_of_birth || ""; break;
            case "fin_paid": val = String(paymentsByStudent[s.id] || 0); break;
            case "fin_balance": val = String(Math.max(0, expectedFee - (paymentsByStudent[s.id] || 0))); break;
            case "fin_wallet": val = String(s.canteen_balance || 0); break;
            case "aca_attendance": val = `${attendanceByStudent[s.id] || 0}%`; break;
            case "aca_average": val = `${gradesByStudent[s.id] || 0}%`; break;
          }
          return `"${val.replace(/"/g, '""')}"`;
        });
        csvRows.push(row.join(","));
      });

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportTitle.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${students?.length || 0} student records to CSV`);
    } catch (err: any) {
      toast.error(err?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageErrorBoundary>
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
          <div className="glass-premium rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-l-4 border-indigo-500 shadow-xl shadow-indigo-500/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-indigo-500/10 to-transparent z-0 pointer-events-none opacity-50" />
            <div className="relative z-10 flex-1">
              <input
                className="text-3xl font-black tracking-tight text-[var(--t1)] bg-transparent border-0 outline-none w-full md:w-3/4 mb-1 border-b-2 border-transparent hover:border-[var(--border)] focus:border-indigo-500 transition-colors placeholder:text-[var(--t4)]"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Report Title"
              />
              <p className="text-[var(--t3)] font-medium">
                Drag and drop or click data attributes to build your customized
                PDF or Excel export.
              </p>
            </div>
            <button
              onClick={handleExport}
              className="relative z-10 bg-[var(--surface-container)] text-[var(--t1)] border-[1.5px] border-[var(--border)] hover:border-indigo-500 px-6 py-3 rounded-2xl shadow-sm font-bold transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
              disabled={exporting || selectedColumns.length === 0}
            >
              <MaterialIcon icon={exporting ? "hourglass_empty" : "download"} className="text-indigo-500" />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Data Dictionary Sidebar */}
            <div className="glass-premium rounded-3xl p-6 lg:col-span-1 shadow-sm sticky top-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--t2)] mb-4 flex items-center gap-2">
                <MaterialIcon
                  icon="dataset"
                  style={{ fontSize: 18 }}
                  className="text-indigo-400"
                />
                Data Atlas
              </h3>

              <div className="space-y-4">
                {["student", "finance", "academic"].map((category) => {
                  const categoryCols = unselectedColumns.filter(
                    (c) => c.category === category,
                  );
                  if (categoryCols.length === 0) return null;
                  return (
                    <div key={category} className="mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)] mb-2 px-1">
                        {category} Metadata
                      </p>
                      <div className="space-y-2">
                        {categoryCols.map((col) => (
                          <button
                            key={col.id}
                            onClick={() => addColumn(col)}
                            className="w-full text-left bg-[var(--surface)] hover:bg-[var(--surface-container-low)] border border-[var(--border)] hover:border-indigo-400 p-3 rounded-xl transition-all shadow-sm flex items-center justify-between group active:scale-95"
                          >
                            <span className="text-sm font-bold text-[var(--t1)] line-clamp-1">
                              {col.label}
                            </span>
                            <MaterialIcon
                              icon="add"
                              className="text-[var(--t4)] group-hover:text-indigo-500"
                              style={{ fontSize: 16 }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {unselectedColumns.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-[var(--border)] rounded-xl">
                    <p className="text-xs text-[var(--t3)] font-medium">
                      All points utilized.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Live Canvas Preview */}
            <div className="glass-premium rounded-3xl lg:col-span-3 flex flex-col border border-[var(--border)] bg-white/40 shadow-sm overflow-hidden">
              <div className="p-4 bg-[var(--surface)] border-b border-[var(--border)] flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs font-bold text-[var(--t3)] px-2 bg-[var(--bg)] rounded-md border border-[var(--border)]">
                  Live Canvas View
                </span>
              </div>

              <div className="p-6 sm:p-8 flex-1 overflow-x-auto custom-scrollbar">
                {selectedColumns.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] rounded-3xl text-[var(--t4)]">
                    <MaterialIcon
                      icon="view_column"
                      style={{ fontSize: 48, marginBottom: 12 }}
                      className="opacity-50"
                    />
                    <p className="text-sm font-bold tracking-tight">
                      Report Canvas is Empty
                    </p>
                    <p className="text-xs mt-1 opacity-70">
                      Add attributes from the Data Atlas.
                    </p>
                  </div>
                ) : previewLoading ? (
                  <div className="h-48 flex items-center justify-center text-[var(--t3)] text-sm font-medium animate-pulse">Loading preview…</div>
                ) : (
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr>
                        {selectedColumns.map((col) => (
                          <th
                            key={col.id}
                            className="relative group text-left px-4 py-3 bg-[var(--surface-container)]/80 text-[11px] font-black uppercase tracking-widest text-[var(--t2)] border-y border-[var(--border)] first:border-l first:rounded-tl-2xl last:border-r last:rounded-tr-2xl hover:bg-[var(--surface-container)] transition-colors"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span>{col.label}</span>
                              <button
                                onClick={() => removeColumn(col.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--red)] p-1 hover:bg-[var(--red)]/10 rounded"
                              >
                                <MaterialIcon icon="close" style={{ fontSize: 14 }} />
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.length > 0 ? previewData.map((row, i) => (
                        <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--surface-container-low)]/50 transition-colors">
                          {selectedColumns.map((col) => (
                            <td key={col.id} className="px-4 py-3 text-sm font-medium text-[var(--t1)]">
                              {row[col.id] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={selectedColumns.length} className="px-4 py-8 text-center text-sm text-[var(--t3)]">
                            No students found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
    </PageErrorBoundary>
  );
}
