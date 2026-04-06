"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Printer, Download, Settings } from "lucide-react";

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
      primary_color?: string;
      accent_color?: string;
      school_motto?: string;
      report_header_text?: string;
      report_footer_text?: string;
      signature_headteacher_url?: string;
      signature_class_teacher_url?: string;
      report_template?: string;
      show_position_in_report?: boolean;
      show_conduct_in_report?: boolean;
      show_attendance_in_report?: boolean;
      show_remarks_in_report?: boolean;
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
    conduct?: {
      punctuality: number;
      neatness: number;
      honesty: number;
      discipline: number;
      respect: number;
      leadership: number;
      cooperation: number;
    };
    overall: {
      average: number;
      grade: string;
      division: string;
      position?: number | null;
    };
    class_teacher_remark?: string;
    head_teacher_remark?: string;
    next_term_opens?: string;
  };
  onCustomize?: () => void;
}

function sanitizeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const CONDUCT_LABELS = [
  { key: "punctuality", label: "Punctuality" },
  { key: "neatness", label: "Neatness" },
  { key: "honesty", label: "Honesty" },
  { key: "discipline", label: "Discipline" },
  { key: "respect", label: "Respect for Others" },
  { key: "leadership", label: "Leadership" },
  { key: "cooperation", label: "Cooperation" },
];

const CONDUCT_RATINGS: Record<number, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

export default function ReportCard({ report, onCustomize }: ReportCardProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  const school = (report.school || {}) as NonNullable<typeof report.school>;
  const primaryColor = school.primary_color || "#002045";
  const accentColor = school.accent_color || "#3b82f6";
  const showPosition = school.show_position_in_report !== false;
  const showConduct = school.show_conduct_in_report !== false;
  const showAttendance = school.show_attendance_in_report !== false;
  const showRemarks = school.show_remarks_in_report !== false;
  const template = school.report_template || "default";

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
                * { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
                body { padding: 15px; }
                .report-card { max-width: 800px; margin: 0 auto; border: 2px solid ${primaryColor}; }
                .header { background: ${primaryColor}; color: white; padding: 20px; text-align: center; position: relative; }
                .header-logo { max-width: 60px; max-height: 60px; margin-bottom: 8px; }
                .school-name { font-size: 22px; font-weight: bold; letter-spacing: 0.5px; }
                .school-motto { font-size: 11px; font-style: italic; margin-top: 4px; opacity: 0.9; }
                .subtitle { font-size: 12px; margin-top: 6px; }
                .term-title { font-size: 14px; font-weight: 600; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); }
                .student-info { padding: 15px; display: flex; justify-content: space-between; border-bottom: 2px solid ${primaryColor}; background: #fafbfc; }
                .info-block { flex: 1; }
                .info-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
                .info-value { font-size: 13px; font-weight: 600; color: #1a1a1a; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th { background: ${primaryColor}; color: white; padding: 8px 4px; text-align: center; border: 1px solid ${primaryColor}; font-weight: 600; font-size: 10px; }
                td { padding: 6px 4px; text-align: center; border: 1px solid #ddd; }
                td:first-child { text-align: left; padding-left: 8px; font-weight: 500; }
                tr:nth-child(even) { background: #fafbfc; }
                .total-row { font-weight: bold; background: #f0f5ff !important; }
                .conduct-section { padding: 15px; border-top: 1px solid #eee; }
                .conduct-title { font-size: 13px; font-weight: 700; color: ${primaryColor}; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
                .conduct-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
                .conduct-item { text-align: center; padding: 8px; border: 1px solid #eee; border-radius: 6px; }
                .conduct-label { font-size: 9px; color: #666; text-transform: uppercase; }
                .conduct-value { font-size: 14px; font-weight: 700; color: ${primaryColor}; }
                .conduct-rating { font-size: 9px; color: #888; }
                .summary { padding: 15px; border-top: 2px solid ${primaryColor}; }
                .summary-grid { display: grid; grid-template-columns: repeat(${showPosition ? 4 : 3}, 1fr); gap: 12px; margin-bottom: 15px; }
                .summary-item { text-align: center; padding: 12px; border: 1px solid #eee; border-radius: 8px; background: #fafbfc; }
                .summary-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
                .summary-value { font-size: 18px; font-weight: 800; color: ${primaryColor}; }
                .remarks-section { padding: 15px; border-top: 1px solid #eee; }
                .remark-block { margin-bottom: 12px; }
                .remark-label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: 600; }
                .remark-text { font-size: 12px; color: #333; font-style: italic; margin-top: 2px; }
                .footer { padding: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; border-top: 2px solid ${primaryColor}; }
                .signature { text-align: center; }
                .sig-image { max-width: 120px; max-height: 50px; margin: 0 auto 5px; }
                .sig-line { border-top: 1px solid #333; margin-top: 35px; padding-top: 5px; font-size: 10px; color: #666; }
                .parent-sig { border-top: 2px dashed #999; margin-top: 35px; padding-top: 5px; font-size: 10px; color: #666; }
                .footer-note { padding: 10px 15px; text-align: center; font-size: 9px; color: #888; border-top: 1px solid #eee; background: #fafbfc; }
                .next-term { padding: 10px 15px; text-align: center; font-size: 12px; font-weight: 600; color: ${primaryColor}; border-top: 1px solid #eee; }
                @media print { body { padding: 0; } .no-print { display: none !important; } }
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
    const pc = hexToRgb(primaryColor);
    const ac = hexToRgb(accentColor);

    // Header with school colors
    doc.setFillColor(pc.r, pc.g, pc.b);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(report.school?.name || "School Name", 105, 15, {
      align: "center",
    });

    if (school.school_motto) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(`"${school.school_motto}"`, 105, 22, { align: "center" });
      doc.setFont("helvetica", "normal");
    }

    doc.setFontSize(10);
    doc.text(
      `${report.school?.district || ""} District${report.school?.uneab_center_number ? ` | Center: ${report.school.uneab_center_number}` : ""}`,
      105,
      30,
      { align: "center" },
    );
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(
      `TERM ${report.term} REPORT CARD — ${report.academicYear}`,
      105,
      37,
      { align: "center" },
    );
    doc.setFont("helvetica", "normal");

    // Student Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const studentY = 50;
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
      startY: 65,
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
      headStyles: { fillColor: [pc.r, pc.g, pc.b], textColor: 255 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: {
        0: { cellWidth: 45, halign: "left" },
        9: { fontStyle: "bold" },
      },
    });

    // Conduct Section
    if (showConduct && report.conduct) {
      const conductY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(pc.r, pc.g, pc.b);
      doc.text("CONDUCT & BEHAVIOR", 14, conductY);

      const conductData = CONDUCT_LABELS.map((c) => [
        c.label,
        (report.conduct as any)[c.key],
        CONDUCT_RATINGS[(report.conduct as any)[c.key]] || "N/A",
      ]);

      autoTable(doc, {
        startY: conductY + 3,
        head: [["Trait", "Rating (1-5)", "Assessment"]],
        body: conductData,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [ac.r, ac.g, ac.b], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 70, halign: "left" },
          2: { fontStyle: "italic" },
        },
      });
    }

    // Summary
    const summaryY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`Overall Average: ${report.overall.average}%`, 14, summaryY);
    doc.text(`Grade: ${report.overall.grade}`, 80, summaryY);
    doc.text(`Division: ${report.overall.division}`, 140, summaryY);

    if (showPosition && report.overall.position) {
      doc.text(`Position: ${report.overall.position}`, 14, summaryY + 7);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (showAttendance) {
      doc.text(
        `Attendance: ${report.attendance.present} present, ${report.attendance.absent} absent, ${report.attendance.late} late`,
        14,
        summaryY + (showPosition ? 14 : 7),
      );
    }

    // Remarks
    if (showRemarks) {
      const remarksY = summaryY + (showPosition ? 22 : 15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(pc.r, pc.g, pc.b);
      doc.text("REMARKS", 14, remarksY);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      if (report.class_teacher_remark) {
        doc.text(
          `Class Teacher: ${report.class_teacher_remark}`,
          14,
          remarksY + 8,
        );
      }
      if (report.head_teacher_remark) {
        doc.text(
          `Head Teacher: ${report.head_teacher_remark}`,
          14,
          remarksY + 16,
        );
      }
    }

    // Signature lines
    const sigY = (doc as any).lastAutoTable?.finalY || summaryY + 30;
    doc.setDrawColor(0, 0, 0);
    doc.line(14, sigY + 15, 60, sigY + 15);
    doc.line(80, sigY + 15, 130, sigY + 15);
    doc.line(150, sigY + 15, 196, sigY + 15);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Class Teacher", 30, sigY + 20, { align: "center" });
    doc.text("Head Teacher", 105, sigY + 20, { align: "center" });
    doc.text("Parent Acknowledged", 173, sigY + 20, { align: "center" });

    if (report.next_term_opens) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(pc.r, pc.g, pc.b);
      doc.text(`Next Term Opens: ${report.next_term_opens}`, 105, sigY + 30, {
        align: "center",
      });
    }

    doc.save(
      `Report_${report.student.first_name}_${report.student.last_name}_T${report.term}.pdf`,
    );
  };

  function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 32, b: 69 };
  }

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
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90"
          style={{ backgroundColor: primaryColor }}
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
        {onCustomize && (
          <button
            onClick={onCustomize}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            Customize
          </button>
        )}
      </div>

      {/* Report Card Preview */}
      <div
        ref={reportRef}
        className="bg-white rounded-xl overflow-hidden max-w-2xl"
        style={{ border: `2px solid ${primaryColor}` }}
      >
        {/* Header */}
        <div
          className="text-white p-5 text-center"
          style={{ backgroundColor: primaryColor }}
        >
          {school.logo_url && (
            <Image
              src={school.logo_url}
              alt="School Logo"
              width={56}
              height={56}
              className="mx-auto mb-2 rounded-lg object-cover bg-white/20"
            />
          )}
          <div className="text-xl font-bold tracking-wide">
            {report.school?.name || "School Name"}
          </div>
          {school.school_motto && (
            <div className="text-xs italic mt-1 opacity-90">
              "{school.school_motto}"
            </div>
          )}
          <div className="text-sm opacity-90 mt-1.5">
            {report.school?.district || ""} District
            {report.school?.uneab_center_number &&
              ` | Center: ${report.school.uneab_center_number}`}
          </div>
          <div
            className="text-sm font-semibold mt-2 pt-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.3)" }}
          >
            TERM {report.term} REPORT CARD — {report.academicYear}
          </div>
        </div>

        {/* Student Info */}
        <div
          className="p-4 grid grid-cols-4 gap-4 border-b-2"
          style={{ borderColor: primaryColor, backgroundColor: "#fafbfc" }}
        >
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Student Name
            </div>
            <div className="font-semibold text-sm text-gray-900">
              {report.student.first_name} {report.student.last_name}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Class
            </div>
            <div className="font-semibold text-sm text-gray-900">
              {report.student.classes?.name || "N/A"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Student No.
            </div>
            <div className="font-semibold text-sm text-gray-900">
              {report.student.student_number}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Gender
            </div>
            <div className="font-semibold text-sm text-gray-900">
              {report.student.gender === "M" ? "Male" : "Female"}
            </div>
          </div>
        </div>

        {/* Grades Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: primaryColor }}>
                <th
                  className="text-left px-3 py-2 text-white font-semibold"
                  style={{ borderColor: primaryColor }}
                >
                  Subject
                </th>
                <th
                  className="text-center px-2 py-2 text-white font-semibold"
                  style={{ borderColor: primaryColor }}
                >
                  CA1
                </th>
                <th
                  className="text-center px-2 py-2 text-white font-semibold"
                  style={{ borderColor: primaryColor }}
                >
                  CA2
                </th>
                <th
                  className="text-center px-2 py-2 text-white font-semibold"
                  style={{ borderColor: primaryColor }}
                >
                  CA3
                </th>
                <th
                  className="text-center px-2 py-2 text-white font-semibold"
                  style={{ borderColor: primaryColor }}
                >
                  CA4
                </th>
                <th
                  className="text-center px-2 py-2 text-white font-semibold"
                  style={{ borderColor: primaryColor }}
                >
                  Proj
                </th>
                <th
                  className="text-center px-2 py-2 text-white font-semibold"
                  style={{ borderColor: primaryColor }}
                >
                  CA Avg
                </th>
                <th
                  className="text-center px-2 py-2 text-white font-semibold"
                  style={{ borderColor: primaryColor }}
                >
                  Exam
                </th>
                <th
                  className="text-center px-2 py-2 text-white font-semibold"
                  style={{ borderColor: primaryColor }}
                >
                  Total
                </th>
                <th
                  className="text-center px-2 py-2 text-white font-semibold"
                  style={{ borderColor: primaryColor }}
                >
                  Grade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.subjects.map((subject, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50"
                  style={i % 2 === 1 ? { backgroundColor: "#fafbfc" } : {}}
                >
                  <td className="px-3 py-2 text-gray-900 font-medium">
                    {subject.name}
                  </td>
                  <td className="text-center px-2 py-2">{subject.ca1}</td>
                  <td className="text-center px-2 py-2">{subject.ca2}</td>
                  <td className="text-center px-2 py-2">{subject.ca3}</td>
                  <td className="text-center px-2 py-2">{subject.ca4}</td>
                  <td className="text-center px-2 py-2">{subject.project}</td>
                  <td
                    className="text-center px-2 py-2 font-medium"
                    style={{ backgroundColor: `${accentColor}10` }}
                  >
                    {Math.round(subject.totalCA)}
                  </td>
                  <td className="text-center px-2 py-2">{subject.exam}</td>
                  <td
                    className="text-center px-2 py-2 font-bold"
                    style={{ backgroundColor: `${accentColor}10` }}
                  >
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

        {/* Conduct Section */}
        {showConduct && report.conduct && (
          <div
            className="p-4 border-t"
            style={{ borderColor: `${primaryColor}20` }}
          >
            <div
              className="text-sm font-bold uppercase tracking-wide mb-3"
              style={{ color: primaryColor }}
            >
              Conduct & Behavior
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {CONDUCT_LABELS.map((c) => (
                <div
                  key={c.key}
                  className="text-center p-2 rounded-lg border border-gray-100 bg-gray-50"
                >
                  <div className="text-xs text-gray-500">{c.label}</div>
                  <div
                    className="text-lg font-bold"
                    style={{ color: primaryColor }}
                  >
                    {(report.conduct as any)[c.key]}
                  </div>
                  <div className="text-xs text-gray-400">
                    {CONDUCT_RATINGS[(report.conduct as any)[c.key]] || ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="p-4 border-t-2" style={{ borderColor: primaryColor }}>
          <div
            className={`grid gap-3 mb-4 ${showPosition ? "grid-cols-4" : "grid-cols-3"}`}
          >
            <div
              className="text-center p-3 rounded-lg"
              style={{ backgroundColor: "#fafbfc", border: "1px solid #eee" }}
            >
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Overall Average
              </div>
              <div
                className="text-2xl font-black"
                style={{ color: primaryColor }}
              >
                {report.overall.average}%
              </div>
            </div>
            <div
              className="text-center p-3 rounded-lg"
              style={{ backgroundColor: "#fafbfc", border: "1px solid #eee" }}
            >
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Grade
              </div>
              <div
                className="text-2xl font-black"
                style={{ color: primaryColor }}
              >
                {report.overall.grade}
              </div>
            </div>
            <div
              className="text-center p-3 rounded-lg"
              style={{ backgroundColor: "#fafbfc", border: "1px solid #eee" }}
            >
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Division
              </div>
              <div
                className={`text-xl font-black ${
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
            {showPosition && report.overall.position && (
              <div
                className="text-center p-3 rounded-lg"
                style={{ backgroundColor: "#fafbfc", border: "1px solid #eee" }}
              >
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  Position
                </div>
                <div
                  className="text-2xl font-black"
                  style={{ color: primaryColor }}
                >
                  {report.overall.position}
                </div>
              </div>
            )}
          </div>

          {showAttendance && (
            <div
              className="text-center p-3 rounded-lg mb-4"
              style={{ backgroundColor: "#fafbfc", border: "1px solid #eee" }}
            >
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Attendance
              </div>
              <div className="text-lg font-bold text-gray-900">
                {report.attendance.present}/{report.attendance.total} days
                present
              </div>
              <div className="text-xs text-gray-500">
                {report.attendance.absent} absent, {report.attendance.late} late
              </div>
            </div>
          )}

          {/* Remarks */}
          {showRemarks &&
            (report.class_teacher_remark || report.head_teacher_remark) && (
              <div
                className="mb-4 p-4 rounded-lg"
                style={{
                  backgroundColor: "#fafbfc",
                  border: `1px solid ${primaryColor}20`,
                }}
              >
                <div
                  className="text-sm font-bold uppercase tracking-wide mb-2"
                  style={{ color: primaryColor }}
                >
                  Remarks
                </div>
                {report.class_teacher_remark && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-500 font-semibold uppercase">
                      Class Teacher
                    </div>
                    <div className="text-sm text-gray-700 italic mt-0.5">
                      "{report.class_teacher_remark}"
                    </div>
                  </div>
                )}
                {report.head_teacher_remark && (
                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase">
                      Head Teacher
                    </div>
                    <div className="text-sm text-gray-700 italic mt-0.5">
                      "{report.head_teacher_remark}"
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Next Term */}
          {report.next_term_opens && (
            <div
              className="text-center py-2 border-t"
              style={{ borderColor: `${primaryColor}20`, color: primaryColor }}
            >
              <span className="text-sm font-semibold">
                Next Term Opens: {report.next_term_opens}
              </span>
            </div>
          )}

          {/* Signatures — teachers only, parent acknowledgment */}
          <div
            className="grid grid-cols-3 gap-6 pt-4 border-t-2"
            style={{ borderColor: primaryColor }}
          >
            <div className="text-center">
              {school.signature_class_teacher_url ? (
                <Image
                  src={school.signature_class_teacher_url}
                  alt="Class Teacher Signature"
                  width={120}
                  height={40}
                  className="mx-auto mb-1 object-contain"
                />
              ) : (
                <div className="h-10" />
              )}
              <div className="border-t border-gray-400 mt-1 pt-1.5">
                <div className="text-xs text-gray-500">Class Teacher</div>
              </div>
            </div>
            <div className="text-center">
              {school.signature_headteacher_url ? (
                <Image
                  src={school.signature_headteacher_url}
                  alt="Head Teacher Signature"
                  width={120}
                  height={40}
                  className="mx-auto mb-1 object-contain"
                />
              ) : (
                <div className="h-10" />
              )}
              <div className="border-t border-gray-400 mt-1 pt-1.5">
                <div className="text-xs text-gray-500">Head Teacher</div>
              </div>
            </div>
            <div className="text-center">
              <div className="h-10" />
              <div
                className="border border-dashed rounded-lg p-2 mt-1"
                style={{
                  borderColor: `${primaryColor}40`,
                  backgroundColor: `${primaryColor}05`,
                }}
              >
                <div
                  className="text-xs font-medium"
                  style={{ color: primaryColor }}
                >
                  Parent Acknowledgment
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Report viewed via parent portal
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {school.report_footer_text && (
          <div className="px-4 py-2 text-center text-xs text-gray-400 border-t bg-gray-50">
            {school.report_footer_text}
          </div>
        )}
      </div>
    </div>
  );
}
