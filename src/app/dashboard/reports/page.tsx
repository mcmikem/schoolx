"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses } from "@/lib/hooks";
import { getUNEBGrade, getUNEBDivision } from "@/lib/grading";
import ReportCard from "@/components/reports/ReportCard";
import type { ReportCard as ReportCardType } from "@/types";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { PageHeader } from "@/components/ui/PageHeader";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/Card";
import PersonInitials from "@/components/ui/PersonInitials";

export default function ReportsPage() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students, loading: studentsLoading } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );
  const [reportData, setReportData] = useState<ReportCardType | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      `${s.first_name} ${s.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      s.student_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === "" || s.class_id === selectedClass;
    return matchesSearch && matchesClass;
  });

  const fetchStudentReport = useCallback(
    async (studentId: string) => {
      try {
        setLoadingReport(true);
        const student = students.find((s) => s.id === studentId);
        if (!student) return;

        const response = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            schoolId: school?.id,
            term: currentTerm,
            academicYear,
          }),
        });

        if (!response.ok) {
          console.error("Failed to fetch report from API");
          return;
        }

        const { data } = await response.json();

        const subjectGrades: Record<
          string,
          { name: string; code: string; scores: Record<string, number> }
        > = {};
        data.subjects?.forEach((s: any) => {
          if (!subjectGrades[s.name]) {
            subjectGrades[s.name] = {
              name: s.name,
              code: s.code,
              scores: {},
            };
          }
        });

        const subjects =
          data.subjects?.map((s: any) => ({
            name: s.name,
            code: s.code,
            ca1: s.ca1 || 0,
            ca2: s.ca2 || 0,
            ca3: s.ca3 || 0,
            ca4: s.ca4 || 0,
            project: s.project || 0,
            exam: s.exam || 0,
            totalCA: s.totalCA || 0,
            finalScore: s.finalScore || 0,
            grade: s.grade || "F9",
          })) || [];

        setReportData({
          student: {
            first_name: data.student?.first_name || student.first_name,
            last_name: data.student?.last_name || student.last_name,
            student_number:
              data.student?.student_number || student.student_number || "N/A",
            gender: data.student?.gender || student.gender,
            photo_url: data.student?.photo_url || student.photo_url,
            classes: data.student?.classes || student.classes,
          },
          school: {
            name: data.school?.name || school?.name || "SkoolMate OS",
            district: data.school?.district || school?.district || "Uganda",
          },
          term: data.term || currentTerm,
          academicYear: data.academicYear || academicYear,
          subjects,
          attendance: data.attendance || {
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
          },
          overall: data.overall || {
            average: 0,
            grade: "F9",
            division: "Ungraded",
          },
        });

        setSelectedStudentId(studentId);
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoadingReport(false);
      }
    },
    [students, currentTerm, academicYear, school],
  );

  const handleBulkPrint = useCallback(async () => {
    try {
      setLoadingReport(true);
      const reports = [];

      for (const student of filteredStudents) {
        const response = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: student.id,
            schoolId: school?.id,
            term: currentTerm,
            academicYear,
          }),
        });

        if (response.ok) {
          const { data } = await response.json();
          reports.push(data);
        }
      }

      if (reports.length === 0) return;

      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      const primaryColor = school?.primary_color || "#002045";

      printWindow.document.write(`
        <html>
          <head>
            <title>Bulk Report Cards - ${school?.name || "School"}</title>
            <style>
              * { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
              body { padding: 15px; }
              .report-card { max-width: 800px; margin: 0 auto 30px; border: 2px solid ${primaryColor}; page-break-after: always; }
              .report-card:last-child { page-break-after: auto; }
              .header { background: ${primaryColor}; color: white; padding: 20px; text-align: center; }
              .school-name { font-size: 22px; font-weight: bold; }
              .student-info { padding: 15px; display: flex; justify-content: space-between; border-bottom: 2px solid ${primaryColor}; background: #fafbfc; }
              .info-label { font-size: 10px; color: #666; text-transform: uppercase; }
              .info-value { font-size: 13px; font-weight: 600; color: #1a1a1a; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; }
              th { background: ${primaryColor}; color: white; padding: 8px 4px; text-align: center; border: 1px solid ${primaryColor}; }
              td { padding: 6px 4px; text-align: center; border: 1px solid #ddd; }
              td:first-child { text-align: left; padding-left: 8px; font-weight: 500; }
              .summary { padding: 15px; border-top: 2px solid ${primaryColor}; }
              .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
              .summary-item { text-align: center; padding: 12px; border: 1px solid #eee; border-radius: 8px; background: #fafbfc; }
              .summary-value { font-size: 18px; font-weight: 800; color: ${primaryColor}; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            ${reports
              .map(
                (report) => `
              <div class="report-card">
                <div class="header">
                  <div class="school-name">${report.school?.name || school?.name}</div>
                  <div>TERM ${report.term} REPORT CARD — ${report.academicYear}</div>
                </div>
                <div class="student-info">
                  <div>
                    <div class="info-label">Student Name</div>
                    <div class="info-value">${report.student?.first_name} ${report.student?.last_name}</div>
                  </div>
                  <div>
                    <div class="info-label">Class</div>
                    <div class="info-value">${report.student?.classes?.name || "N/A"}</div>
                  </div>
                  <div>
                    <div class="info-label">Student No.</div>
                    <div class="info-value">${report.student?.student_number || "N/A"}</div>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>CA Avg</th>
                      <th>Exam</th>
                      <th>Total</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(report.subjects || [])
                      .map(
                        (s: any) => `
                      <tr>
                        <td>${s.name}</td>
                        <td>${Math.round(s.totalCA || 0)}</td>
                        <td>${s.exam || 0}</td>
                        <td>${Math.round(s.finalScore || 0)}</td>
                        <td>${s.grade || "F9"}</td>
                      </tr>
                    `,
                      )
                      .join("")}
                  </tbody>
                </table>
                <div class="summary">
                  <div class="summary-grid">
                    <div class="summary-item">
                      <div class="summary-value">${report.overall?.average || 0}%</div>
                      <div>Average</div>
                    </div>
                    <div class="summary-item">
                      <div class="summary-value">${report.overall?.grade || "F9"}</div>
                      <div>Grade</div>
                    </div>
                    <div class="summary-item">
                      <div class="summary-value">${report.overall?.division || "Ungraded"}</div>
                      <div>Division</div>
                    </div>
                  </div>
                </div>
              </div>
            `,
              )
              .join("")}
          </body>
        </html>
      `);

      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch (err) {
      console.error("Error in bulk print:", err);
    } finally {
      setLoadingReport(false);
    }
  }, [filteredStudents, school, currentTerm, academicYear]);

  const handleGenerateReport = useCallback(
    async (studentId: string) => {
      try {
        const response = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            schoolId: school?.id,
            term: currentTerm,
            academicYear,
          }),
        });

        if (!response.ok) {
          console.error("Failed to generate report");
          return;
        }

        const { data } = await response.json();

        const subjectGrades: Record<
          string,
          { name: string; code: string; scores: Record<string, number> }
        > = {};
        data.subjects?.forEach((s: any) => {
          if (!subjectGrades[s.name]) {
            subjectGrades[s.name] = {
              name: s.name,
              code: s.code,
              scores: {},
            };
          }
        });

        const subjects =
          data.subjects?.map((s: any) => ({
            name: s.name,
            code: s.code,
            ca1: s.ca1 || 0,
            ca2: s.ca2 || 0,
            ca3: s.ca3 || 0,
            ca4: s.ca4 || 0,
            project: s.project || 0,
            exam: s.exam || 0,
            totalCA: s.totalCA || 0,
            finalScore: s.finalScore || 0,
            grade: s.grade || "F9",
          })) || [];

        const reportDataForPDF = {
          student: {
            first_name: data.student?.first_name || "N/A",
            last_name: data.student?.last_name || "N/A",
            student_number: data.student?.student_number || "N/A",
            gender: data.student?.gender || "M",
            photo_url: data.student?.photo_url,
            classes: data.student?.classes,
          },
          school: {
            name: data.school?.name || school?.name || "SkoolMate OS",
            district: data.school?.district || school?.district || "Uganda",
            primary_color: data.school?.primary_color,
          },
          term: data.term || currentTerm,
          academicYear: data.academicYear || academicYear,
          subjects,
          attendance: data.attendance || {
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
          },
          overall: data.overall || {
            average: 0,
            grade: "F9",
            division: "Ungraded",
          },
        };

        const { jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");

        const doc = new jsPDF();
        const primaryColor =
          data.school?.primary_color || school?.primary_color || "#002045";

        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result
            ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16),
              }
            : { r: 0, g: 32, b: 69 };
        };

        const pc = hexToRgb(primaryColor);

        doc.setFillColor(pc.r, pc.g, pc.b);
        doc.rect(0, 0, 210, 40, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.text(reportDataForPDF.school.name, 105, 15, { align: "center" });
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(
          `TERM ${reportDataForPDF.term} REPORT CARD — ${reportDataForPDF.academicYear}`,
          105,
          37,
          { align: "center" },
        );

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const studentY = 50;
        doc.text(
          `Name: ${reportDataForPDF.student.first_name} ${reportDataForPDF.student.last_name}`,
          14,
          studentY,
        );
        doc.text(
          `Class: ${reportDataForPDF.student.classes?.name || "N/A"}`,
          120,
          studentY,
        );
        doc.text(
          `Student No: ${reportDataForPDF.student.student_number}`,
          14,
          studentY + 7,
        );

        const tableData = reportDataForPDF.subjects.map((s) => [
          s.name,
          Math.round(s.totalCA),
          s.exam,
          Math.round(s.finalScore),
          s.grade,
        ]);

        autoTable(doc, {
          startY: 65,
          head: [["Subject", "CA Avg", "Exam", "Total", "Grade"]],
          body: tableData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [pc.r, pc.g, pc.b], textColor: 255 },
        });

        const summaryY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(
          `Overall Average: ${reportDataForPDF.overall.average}%`,
          14,
          summaryY,
        );
        doc.text(`Grade: ${reportDataForPDF.overall.grade}`, 80, summaryY);
        doc.text(
          `Division: ${reportDataForPDF.overall.division}`,
          140,
          summaryY,
        );

        doc.save(
          `Report_${reportDataForPDF.student.first_name}_${reportDataForPDF.student.last_name}_T${reportDataForPDF.term}.pdf`,
        );
      } catch (err) {
        console.error("Error generating report:", err);
      }
    },
    [school, currentTerm, academicYear],
  );

  return (
    <PageErrorBoundary>
      <div className="space-y-6 pb-24 md:pb-6">
        <PageHeader
          title="Reporting Analytics"
          subtitle={`Term ${currentTerm}, ${academicYear} Academic Cycle`}
          variant="premium"
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkPrint}
              icon={<MaterialIcon icon="print" />}
              disabled={filteredStudents.length === 0}
            >
              Bulk Print ({filteredStudents.length})
            </Button>
          }
        />

        <div className="dashboard-soft-grid">
          <div className="dashboard-kpi-card">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)]">
              Students
            </div>
            <div className="text-3xl font-extrabold text-[var(--t1)] mt-2">
              {filteredStudents.length}
            </div>
            <div className="text-sm text-[var(--t3)] mt-2">
              Available for reporting
            </div>
          </div>
          <div className="dashboard-kpi-card">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)]">
              Classes
            </div>
            <div className="text-3xl font-extrabold text-[var(--t1)] mt-2">
              {classes.length}
            </div>
            <div className="text-sm text-[var(--t3)] mt-2">
              Selectable report groups
            </div>
          </div>
          <div className="dashboard-kpi-card">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)]">
              Current term
            </div>
            <div className="text-3xl font-extrabold text-[var(--t1)] mt-2">
              {currentTerm}
            </div>
            <div className="text-sm text-[var(--t3)] mt-2">
              {academicYear} academic cycle
            </div>
          </div>
          <div className="dashboard-kpi-card">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)]">
              Report status
            </div>
            <div className="text-3xl font-extrabold text-[var(--t1)] mt-2">
              {selectedStudentId ? "Ready" : "Idle"}
            </div>
            <div className="text-sm text-[var(--t3)] mt-2">
              Select a learner to preview
            </div>
          </div>
        </div>

        <Card className="dashboard-toolbar mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input"
              />
            </div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input sm:w-48"
            >
              <option value="">All Classes</option>
              {classes.length > 0 ? (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              ) : (
                <option disabled>No classes</option>
              )}
            </select>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
              Select Student
            </h2>
            {studentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[var(--surface-container)] rounded-full" />
                    <div className="flex-1">
                      <div className="w-32 h-4 bg-[var(--border)] rounded mb-2" />
                      <div className="w-20 h-3 bg-[var(--border)] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <EmptyState
                icon="group"
                title="No students found"
                description="Try adjusting your search or filter criteria"
              />
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      selectedStudentId === student.id
                        ? "bg-[var(--surface-container)] border border-[var(--primary)]"
                        : "hover:bg-[var(--surface-container)] border border-transparent"
                    }`}
                  >
                    <button
                      onClick={() => fetchStudentReport(student.id)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className="w-10 h-10 bg-[var(--surface-container)] rounded-full flex items-center justify-center overflow-hidden">
                        {student.photo_url ? (
                          <Image
                            src={student.photo_url}
                            alt={`${student.first_name} ${student.last_name}`}
                            width={40}
                            height={40}
                            unoptimized
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <PersonInitials
                            name={`${student.first_name} ${student.last_name}`}
                            size={40}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[var(--t1)]">
                          {student.first_name} {student.last_name}
                        </div>
                        <div className="text-xs text-[var(--t3)]">
                          {student.student_number || student.classes?.name}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleGenerateReport(student.id)}
                      className="flex-shrink-0 p-2 text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white rounded-lg transition-colors"
                      title="Generate Report"
                    >
                      <MaterialIcon icon="description" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div>
            {loadingReport ? (
              <Card className="p-12 flex items-center justify-center">
                <TableSkeleton rows={3} />
              </Card>
            ) : reportData ? (
              <ReportCard report={reportData} />
            ) : (
              <Card className="p-12 flex flex-col items-center justify-center text-center">
                <EmptyState
                  icon="description"
                  title="Select a student"
                  description="Choose a student from the list to view their report card"
                />
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
