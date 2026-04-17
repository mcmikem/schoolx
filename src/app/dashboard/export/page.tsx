"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStudents, useClasses } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card as UICard } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

export default function ExportPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const [selectedClass, setSelectedClass] = useState("all");
  const [exportType, setExportType] = useState<
    "students" | "uneb" | "grades" | "attendance" | "fees"
  >("students");
  const [exporting, setExporting] = useState(false);

  const filteredStudents = useMemo(() => {
    if (selectedClass === "all") return students;
    return students.filter((s) => s.class_id === selectedClass);
  }, [students, selectedClass]);

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;

      let data: any[] = [];
      let filename = "";

      if (isDemo) {
        const {
          DEMO_GRADES,
          DEMO_ATTENDANCE,
          DEMO_FEE_PAYMENTS,
          DEMO_STUDENTS,
        } = await import("@/lib/demo-data");

        switch (exportType) {
          case "students":
            data = filteredStudents.map((s) => ({
              "First Name": s.first_name,
              "Last Name": s.last_name,
              Gender: s.gender === "M" ? "Male" : "Female",
              "Student Number": s.student_number || "",
              Class: s.classes?.name || "",
              "Parent Name": s.parent_name || "",
              "Parent Phone": s.parent_phone || "",
              "Date of Birth": s.date_of_birth || "",
              Status: s.status || "active",
            }));
            filename = "students_export.xlsx";
            break;

          case "uneb":
            data = filteredStudents.map((s) => ({
              "Index Number": s.ple_index_number || "",
              "Student Number": s.student_number || "",
              "First Name": s.first_name,
              "Last Name": s.last_name,
              Gender: s.gender === "M" ? "Male" : "Female",
              "Date of Birth": s.date_of_birth || "",
              Class: s.classes?.name || "",
              "School Code": school?.school_code || "",
            }));
            filename = "uneb_candidate_list.xlsx";
            break;

          case "grades":
            data = DEMO_GRADES.map((g) => ({
              "Student ID": g.student_id,
              "Subject ID": g.subject_id,
              Assessment: g.assessment_type,
              Score: g.score,
              "Max Score": g.max_score,
              Term: g.term,
              Year: g.academic_year,
            }));
            filename = "grades_export.xlsx";
            break;

          case "attendance":
            data = DEMO_ATTENDANCE.slice(0, 50).map((a) => ({
              "Student ID": a.student_id,
              "Class ID": a.class_id,
              Date: a.date,
              Status: a.status,
              Remarks: a.remarks || "",
            }));
            filename = "attendance_export.xlsx";
            break;

          case "fees":
            data = DEMO_FEE_PAYMENTS.map((p) => ({
              "Student ID": p.student_id,
              Amount: p.amount_paid,
              Method: p.payment_method,
              Reference: p.payment_reference || "",
              "Paid By": p.paid_by || "",
              Date: p.payment_date,
            }));
            filename = "fees_export.xlsx";
            break;
        }
      } else {
        switch (exportType) {
          case "students":
            data = filteredStudents.map((s) => ({
              "First Name": s.first_name,
              "Last Name": s.last_name,
              Gender: s.gender === "M" ? "Male" : "Female",
              "Student Number": s.student_number || "",
              Class: s.classes?.name || "",
              "Parent Name": s.parent_name || "",
              "Parent Phone": s.parent_phone || "",
              "Parent Phone 2": s.parent_phone2 || "",
              "Date of Birth": s.date_of_birth || "",
              Status: s.status || "active",
            }));
            filename = "students_export.xlsx";
            break;

          case "uneb":
            data = filteredStudents.map((s) => ({
              "Index Number": s.ple_index_number || "",
              "Student Number": s.student_number || "",
              "First Name": s.first_name,
              "Last Name": s.last_name,
              Gender: s.gender === "M" ? "Male" : "Female",
              "Date of Birth": s.date_of_birth || "",
              Class: s.classes?.name || "",
              "School Code": school?.school_code || "",
            }));
            filename = "uneb_candidate_list.xlsx";
            break;

          case "grades":
            const { data: grades } = await supabase
              .from("grades")
              .select(
                "*, students(first_name, last_name, student_number), subjects(name, code)",
              )
              .eq(
                "class_id",
                selectedClass !== "all" ? selectedClass : undefined,
              );

            data =
              grades?.map((g) => ({
                "Student Name": `${g.students?.first_name} ${g.students?.last_name}`,
                "Student Number": g.students?.student_number || "",
                Subject: g.subjects?.name || "",
                Assessment: g.assessment_type,
                Score: g.score,
                Term: g.term,
                Year: g.academic_year,
              })) || [];
            filename = "grades_export.xlsx";
            break;

          case "attendance":
            const { data: attendance } = await supabase
              .from("attendance")
              .select("*, students(first_name, last_name, student_number)")
              .gte(
                "date",
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
              );

            data =
              attendance?.map((a) => ({
                "Student Name": `${a.students?.first_name} ${a.students?.last_name}`,
                "Student Number": a.students?.student_number || "",
                Date: a.date,
                Status: a.status,
              })) || [];
            filename = "attendance_export.xlsx";
            break;

          case "fees":
            const { data: payments } = await supabase
              .from("fee_payments")
              .select("*, students(first_name, last_name, student_number)");

            data =
              payments?.map((p) => ({
                "Student Name": `${p.students?.first_name} ${p.students?.last_name}`,
                "Student Number": p.students?.student_number || "",
                Amount: p.amount_paid,
                Method: p.payment_method,
                Reference: p.payment_reference || "",
                Date: p.payment_date,
              })) || [];
            filename = "fees_export.xlsx";
            break;
        }
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Data");
      worksheet.columns =
        data.length > 0
          ? Object.keys(data[0]).map((key) => ({ header: key, key }))
          : [];
      data.forEach((row) => worksheet.addRow(row));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Export downloaded successfully");
    } catch (err: unknown) {
      console.error("Export error:", err);
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Export Data" subtitle="Export school data to Excel" />

      <UICard className="max-w-2xl p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--on-surface)] mb-2">
              What do you want to export?
            </label>
            <select
              value={exportType}
              onChange={(e) =>
                setExportType(
                  e.target.value as
                    | "students"
                    | "uneb"
                    | "grades"
                    | "attendance"
                    | "fees",
                )
              }
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
            >
              <option value="students">Student List</option>
              <option value="uneb">UNEB Candidate List</option>
              <option value="grades">Grades</option>
              <option value="attendance">Attendance Records</option>
              <option value="fees">Fee Payments</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--on-surface)] mb-2">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
            >
              <option value="all">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 bg-[var(--surface-container)] rounded-lg">
            <div className="text-sm text-[var(--t3)]">
              {exportType === "students" &&
                `${filteredStudents.length} students will be exported`}
              {exportType === "uneb" &&
                `${filteredStudents.filter((s) => s.ple_index_number).length} students with PLE index numbers`}
              {exportType === "grades" &&
                "All grade records for selected class"}
              {exportType === "attendance" && "Last 30 days attendance records"}
              {exportType === "fees" && "All fee payment records"}
            </div>
          </div>

          <Button
            onClick={exportToExcel}
            disabled={exporting}
            className="w-full"
            size="lg"
          >
            {exporting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Exporting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <MaterialIcon icon="download" />
                Download Excel File
              </span>
            )}
          </Button>
        </div>
      </UICard>

      <UICard className="max-w-2xl p-6 mt-6">
        <h2 className="font-semibold text-[var(--on-surface)] mb-4">
          Export Tips
        </h2>
        <ul className="space-y-2 text-sm text-[var(--t3)]">
          <li className="flex items-start gap-2">
            <MaterialIcon
              icon="check_circle"
              className="text-[var(--green)] mt-0.5"
            />
            <span>
              <strong>UNEB Export:</strong> Use this to fill UNEB registration
              forms. Make sure students have PLE index numbers.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <MaterialIcon
              icon="check_circle"
              className="text-[var(--green)] mt-0.5"
            />
            <span>
              <strong>Student List:</strong> Export all student records
              including parent contacts.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <MaterialIcon
              icon="check_circle"
              className="text-[var(--green)] mt-0.5"
            />
            <span>
              <strong>Grades:</strong> Export all grade records for analysis or
              backup.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <MaterialIcon
              icon="check_circle"
              className="text-[var(--green)] mt-0.5"
            />
            <span>
              <strong>Fees:</strong> Export payment records for accounting or
              audits.
            </span>
          </li>
        </ul>
      </UICard>
    </div>
    </PageErrorBoundary>
  );
}
