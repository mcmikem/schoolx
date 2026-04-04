"use client";
import { useRef } from "react";
import { Printer, Download } from "lucide-react";

interface ReportCardProps {
  report: {
    student: {
      first_name: string;
      last_name: string;
      student_number: string;
      gender: string;
      ple_index_number?: string;
      classes?: { name: string; level: string };
    };
    school?: {
      name: string;
      district: string;
      uneab_center_number?: string;
      logo_url?: string;
    };
    term: number;
    academicYear: string;
    subjects: Array<{
      name: string;
      code: string;
      ca1: number;
      ca2: number;
      ca3: number;
      ca4: number;
      project: number;
      exam: number;
      totalCA: number;
      finalScore: number;
      grade: string;
    }>;
    attendance: {
      total: number;
      present: number;
      absent: number;
      late: number;
    };
    overall: {
      average: number;
      grade: string;
      division: string;
      position?: number | null;
    };
  };
}

function sanitizeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function ReportCard({ report }: ReportCardProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (reportRef.current) {
      const printContent = reportRef.current.innerHTML;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const studentName = sanitizeHTML(
          `${report.student.first_name} ${report.student.last_name}`,
        );
        printWindow.document.write(`
          <html>
            <head>
              <title>Report Card - ${studentName}</title>
              <style>
                * { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
                body { padding: 20px; }
                .report-card { max-width: 800px; margin: 0 auto; border: 2px solid #1e3a5f; }
                .header { background: #1e3a5f; color: white; padding: 15px; text-align: center; }
                .school-name { font-size: 20px; font-weight: bold; }
                .subtitle { font-size: 12px; margin-top: 4px; }
                .student-info { padding: 15px; display: flex; justify-content: space-between; border-bottom: 1px solid #eee; }
                .info-block { flex: 1; }
                .info-label { font-size: 10px; color: #666; }
                .info-value { font-size: 13px; font-weight: 500; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th { background: #f5f5f5; padding: 8px 6px; text-align: center; border: 1px solid #ddd; font-weight: 600; }
                td { padding: 6px; text-align: center; border: 1px solid #ddd; }
                td:first-child { text-align: left; padding-left: 8px; }
                .total-row { font-weight: bold; background: #f0f9ff; }
                .summary { padding: 15px; border-top: 2px solid #1e3a5f; }
                .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 15px; }
                .summary-item { text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
                .summary-label { font-size: 10px; color: #666; }
                .summary-value { font-size: 16px; font-weight: bold; }
                .division-1 { color: #16a34a; }
                .division-2 { color: #2563eb; }
                .division-3 { color: #ca8a04; }
                .division-4 { color: #ea580c; }
                .footer { padding: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; border-top: 1px solid #eee; }
                .signature { text-align: center; }
                .sig-line { border-top: 1px solid #333; margin-top: 30px; padding-top: 5px; font-size: 11px; }
                @media print { body { padding: 0; } }
              </style>
            </head>
            <body>${printContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleDownloadPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();

    // Header
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, 210, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(report.school?.name || "School Name", 105, 15, {
      align: "center",
    });
    doc.setFontSize(10);
    doc.text(
      `${report.school?.district || ""} District | Report Card`,
      105,
      23,
      { align: "center" },
    );
    doc.text(`Term ${report.term}, ${report.academicYear}`, 105, 30, {
      align: "center",
    });

    // Student Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    const studentY = 45;
    doc.text(
      `Name: ${report.student.first_name} ${report.student.last_name}`,
      14,
      studentY,
    );
    doc.text(`Class: ${report.student.classes?.name || "N/A"}`, 120, studentY);
    doc.text(`Student No: ${report.student.student_number}`, 14, studentY + 7);
    doc.text(
      `Gender: ${report.student.gender === "M" ? "Male" : "Female"}`,
      120,
      studentY + 7,
    );

    // Grades Table
    const tableData = report.subjects.map((s) => [
      s.name,
      s.ca1,
      s.ca2,
      s.ca3,
      s.ca4,
      s.project,
      Math.round(s.totalCA),
      s.exam,
      Math.round(s.finalScore),
      s.grade,
    ]);

    autoTable(doc, {
      startY: 60,
      head: [
        [
          "Subject",
          "CA1",
          "CA2",
          "CA3",
          "CA4",
          "Proj",
          "CA Avg",
          "Exam",
          "Total",
          "Grade",
        ],
      ],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 45, halign: "left" },
        9: { fontStyle: "bold" },
      },
    });

    // Summary
    const finalY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Overall Average: ${report.overall.average}%`, 14, finalY);
    doc.text(`Grade: ${report.overall.grade}`, 80, finalY);
    doc.text(`Division: ${report.overall.division}`, 140, finalY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Attendance: ${report.attendance.present} present, ${report.attendance.absent} absent, ${report.attendance.late} late`,
      14,
      finalY + 8,
    );

    // Signature lines
    const sigY = finalY + 25;
    doc.line(14, sigY + 15, 60, sigY + 15);
    doc.line(80, sigY + 15, 130, sigY + 15);
    doc.line(150, sigY + 15, 196, sigY + 15);
    doc.setFontSize(8);
    doc.text("Class Teacher", 30, sigY + 20, { align: "center" });
    doc.text("Head Teacher", 105, sigY + 20, { align: "center" });
    doc.text("Parent/Guardian", 173, sigY + 20, { align: "center" });

    doc.save(
      `Report_${report.student.first_name}_${report.student.last_name}_T${report.term}.pdf`,
    );
  };

  return (
    <div>
      {/* Action buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={handlePrint}
          aria-label="Print report card"
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
        <button
          onClick={handleDownloadPDF}
          aria-label="Download report card as PDF"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {/* Report Card Preview */}
      <div
        ref={reportRef}
        className="bg-white rounded-xl border-2 border-primary-800 overflow-hidden max-w-2xl"
      >
        {/* Header */}
        <div className="bg-primary-800 text-white p-4 text-center">
          <div className="text-xl font-bold">
            {report.school?.name || "School Name"}
          </div>
          <div className="text-sm opacity-90">
            {report.school?.district || ""} District
            {report.school?.uneab_center_number &&
              ` | Center: ${report.school.uneab_center_number}`}
          </div>
          <div className="text-sm font-medium mt-1">
            TERM {report.term} REPORT CARD — {report.academicYear}
          </div>
        </div>

        {/* Student Info */}
        <div className="p-4 grid grid-cols-4 gap-4 border-b border-gray-200">
          <div>
            <div className="text-xs text-gray-500">Student Name</div>
            <div className="font-medium text-sm">
              {report.student.first_name} {report.student.last_name}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Class</div>
            <div className="font-medium text-sm">
              {report.student.classes?.name || "N/A"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Student No.</div>
            <div className="font-medium text-sm">
              {report.student.student_number}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Gender</div>
            <div className="font-medium text-sm">
              {report.student.gender === "M" ? "Male" : "Female"}
            </div>
          </div>
        </div>

        {/* Grades Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">
                  Subject
                </th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600">
                  CA1
                </th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600">
                  CA2
                </th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600">
                  CA3
                </th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600">
                  CA4
                </th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600">
                  Proj
                </th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600 bg-blue-50">
                  CA Avg
                </th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600">
                  Exam
                </th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600 bg-blue-50">
                  Total
                </th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600">
                  Grade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.subjects.map((subject, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-900 font-medium">
                    {subject.name}
                  </td>
                  <td className="text-center px-2 py-2">{subject.ca1}</td>
                  <td className="text-center px-2 py-2">{subject.ca2}</td>
                  <td className="text-center px-2 py-2">{subject.ca3}</td>
                  <td className="text-center px-2 py-2">{subject.ca4}</td>
                  <td className="text-center px-2 py-2">{subject.project}</td>
                  <td className="text-center px-2 py-2 font-medium bg-blue-50">
                    {Math.round(subject.totalCA)}
                  </td>
                  <td className="text-center px-2 py-2">{subject.exam}</td>
                  <td className="text-center px-2 py-2 font-bold bg-blue-50">
                    {Math.round(subject.finalScore)}
                  </td>
                  <td className="text-center px-2 py-2 font-bold">
                    {subject.grade}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="p-4 border-t-2 border-primary-800">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Overall Average</div>
              <div className="text-2xl font-bold text-gray-900">
                {report.overall.average}%
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Grade</div>
              <div className="text-2xl font-bold text-primary-700">
                {report.overall.grade}
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Division</div>
              <div
                className={`text-xl font-bold ${
                  report.overall.division === "Division I"
                    ? "text-green-600"
                    : report.overall.division === "Division II"
                      ? "text-blue-600"
                      : report.overall.division === "Division III"
                        ? "text-yellow-600"
                        : "text-red-600"
                }`}
              >
                {report.overall.division}
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Attendance</div>
              <div className="text-lg font-bold text-gray-900">
                {report.attendance.present}/{report.attendance.total}
              </div>
              <div className="text-xs text-gray-500">days present</div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="border-t border-gray-400 mt-10 pt-2">
                <div className="text-xs text-gray-500">Class Teacher</div>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 mt-10 pt-2">
                <div className="text-xs text-gray-500">Head Teacher</div>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 mt-10 pt-2">
                <div className="text-xs text-gray-500">Parent/Guardian</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
