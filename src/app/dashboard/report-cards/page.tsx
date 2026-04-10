"use client";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import {
  useClasses,
  useStudents,
  useSubjects,
  useFeePayments,
  useFeeStructure,
} from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { DEMO_GRADES, DEMO_SUBJECTS } from "@/lib/demo-data";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

interface StudentReport {
  studentId: string;
  name: string;
  studentNumber: string;
  gender: string;
  className: string;
  subjects: {
    name: string;
    score: number;
    grade: string;
    gradeColor: string;
  }[];
  totalMarks: number;
  maxMarks: number;
  average: number;
  position: number;
  division: string;
  classTeacherComment: string;
  hmComment: string;
  feeBalance: number;
}

function getGradeLabel(score: number): { grade: string; color: string } {
  if (score >= 80) return { grade: "D1", color: "text-green-600" };
  if (score >= 70) return { grade: "D2", color: "text-green-500" };
  if (score >= 65) return { grade: "C3", color: "text-blue-600" };
  if (score >= 60) return { grade: "C4", color: "text-blue-500" };
  if (score >= 55) return { grade: "C5", color: "text-indigo-500" };
  if (score >= 50) return { grade: "C6", color: "text-indigo-400" };
  if (score >= 45) return { grade: "P7", color: "text-yellow-600" };
  if (score >= 40) return { grade: "P8", color: "text-yellow-500" };
  return { grade: "F9", color: "text-red-500" };
}

function getDivision(total: number, maxTotal: number): string {
  const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  if (pct >= 80) return "Division 1";
  if (pct >= 60) return "Division 2";
  if (pct >= 40) return "Division 3";
  if (pct >= 20) return "Division 4";
  return "Division U";
}

function getAutoComment(position: number): string {
  if (position >= 1 && position <= 5)
    return "Excellent performance. Keep it up!";
  if (position >= 6 && position <= 15) return "Good work. Strive for better.";
  return "Needs more effort. Work harder.";
}

export default function ReportCardsPage() {
  const { school, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { students: classStudents } = useStudents(school?.id);
  const { payments } = useFeePayments(school?.id);
  const { feeStructure } = useFeeStructure(school?.id);

  const [selectedClass, setSelectedClass] = useState("");
  const [generated, setGenerated] = useState(false);
  const [hideWithFees, setHideWithFees] = useState(false);
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [comments, setComments] = useState<
    Record<string, { classTeacher: string; hm: string }>
  >({});
  const [sendingSms, setSendingSms] = useState(false);

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    return classStudents.filter((s) => s.class_id === selectedClass);
  }, [classStudents, selectedClass]);

  const selectedClassObj = classes.find((c) => c.id === selectedClass);
  const selectedClassName = selectedClassObj ? `${selectedClassObj.name}${selectedClassObj.stream ? ` ${selectedClassObj.stream}` : ''}` : "";

  const totalFeePerStudent = useMemo(() => {
    return feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  }, [feeStructure]);

  const getStudentFeeBalance = (studentId: string): number => {
    const studentPayments = payments.filter((p) => p.student_id === studentId);
    const paid = studentPayments.reduce(
      (sum, p) => sum + Number(p.amount_paid || 0),
      0,
    );
    return Math.max(0, totalFeePerStudent - paid);
  };

  const displayedReports = useMemo(() => {
    if (!hideWithFees) return reports;
    return reports.filter((r) => getStudentFeeBalance(r.studentId) === 0);
  }, [reports, hideWithFees, payments, totalFeePerStudent]);

  const stats = useMemo(() => {
    if (reports.length === 0) return { avgTotal: 0, div1: 0, withFees: 0 };
    
    const avg = reports.reduce((sum, r) => sum + r.average, 0) / reports.length;
    const div1 = reports.filter(r => r.division === "Division 1").length;
    const withFees = reports.filter(r => getStudentFeeBalance(r.studentId) > 0).length;
    
    return {
      avgTotal: Math.round(avg * 10) / 10,
      div1,
      withFees
    };
  }, [reports, payments, totalFeePerStudent]);

  const handleGenerate = async () => {
    if (!selectedClass) {
      toast.error("Please select a class first");
      return;
    }
    if (filteredStudents.length === 0) {
      toast.error("No students in this class");
      return;
    }

    try {
      let gradesData: any[] = [];

      if (isDemo) {
        gradesData = DEMO_GRADES.filter(
          (grade) => grade.class_id === selectedClass,
        ).map((grade) => ({
          ...grade,
          subjects:
            DEMO_SUBJECTS.find((subject) => subject.id === grade.subject_id) ||
            null,
        }));
      } else {
        const { supabase: sb } = await import("@/lib/supabase");

        const { data, error } = await sb
          .from("grades")
          .select("*, subjects(id, name)")
          .eq("class_id", selectedClass)
          .eq("term", currentTerm)
          .eq("academic_year", academicYear);

        if (error) throw error;
        gradesData = data || [];
      }

      const studentSubjectScores: Record<
        string,
        Record<string, { total: number; name: string }>
      > = {};

      for (const g of gradesData) {
        if (!studentSubjectScores[g.student_id]) {
          studentSubjectScores[g.student_id] = {};
        }
        const subjName = g.subjects?.name || "Unknown";
        if (!studentSubjectScores[g.student_id][g.subject_id]) {
          studentSubjectScores[g.student_id][g.subject_id] = {
            total: 0,
            name: subjName,
          };
        }
        studentSubjectScores[g.student_id][g.subject_id].total += Number(
          g.score || 0,
        );
      }

      const subjectList =
        Object.values(studentSubjectScores).length > 0
          ? Object.values(Object.values(studentSubjectScores)[0]).map(
              (s) => s.name,
            )
          : subjects.map((s: any) => s.name);
      const numSubjects = subjectList.length || 1;

      const reportList: StudentReport[] = filteredStudents.map((student) => {
        const subjScores = studentSubjectScores[student.id] || {};
        const subjectDetails = Object.entries(subjScores).map(([, data]) => {
          const gradeInfo = getGradeLabel(data.total);
          return {
            name: data.name,
            score: data.total,
            grade: gradeInfo.grade,
            gradeColor: gradeInfo.color,
          };
        });

        const allSubjectDetails = subjects.map((sub: any) => {
          const existing = subjectDetails.find((sd) => sd.name === sub.name);
          return (
            existing || {
              name: sub.name,
              score: 0,
              grade: "F9",
              gradeColor: "text-red-500",
            }
          );
        });

        const totalMarks = allSubjectDetails.reduce(
          (sum, s) => sum + s.score,
          0,
        );
        const maxMarks = numSubjects * 100;
        const average =
          numSubjects > 0
            ? Math.round((totalMarks / numSubjects) * 10) / 10
            : 0;

        return {
          studentId: student.id,
          name: `${student.first_name} ${student.last_name}`,
          studentNumber: student.student_number || "",
          gender: student.gender,
          className: selectedClassName,
          subjects: allSubjectDetails,
          totalMarks,
          maxMarks,
          average,
          position: 0,
          division: "",
          classTeacherComment: "",
          hmComment: "",
          feeBalance: getStudentFeeBalance(student.id),
        };
      });

      reportList.sort((a, b) => b.totalMarks - a.totalMarks);
      reportList.forEach((r, i) => {
        r.position = i + 1;
        r.division = getDivision(r.totalMarks, r.maxMarks);
        r.classTeacherComment = getAutoComment(r.position);
        r.hmComment = getAutoComment(r.position);
      });

      const initialComments: Record<
        string,
        { classTeacher: string; hm: string }
      > = {};
      for (const r of reportList) {
        initialComments[r.studentId] = {
          classTeacher: r.classTeacherComment,
          hm: r.hmComment,
        };
      }

      setReports(reportList);
      setComments(initialComments);
      setGenerated(true);
      toast.success(`Report cards generated for ${reportList.length} students`);
    } catch (err) {
      console.error("Error generating report cards:", err);
      toast.error("Failed to generate report cards");
    }
  };

  const handleCommentChange = (
    studentId: string,
    field: "classTeacher" | "hm",
    value: string,
  ) => {
    setComments((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleSuggestComment = (studentId: string, position: number) => {
    const auto = getAutoComment(position);
    setComments((prev) => ({
      ...prev,
      [studentId]: { classTeacher: auto, hm: auto },
    }));
  };

  const handlePrintReport = (report: StudentReport) => {
    const studentComment = comments[report.studentId] || {
      classTeacher: "",
      hm: "",
    };
    const schoolName = school?.name || "School Name";
    const schoolColor = school?.primary_color || "#002045";
    const logoUrl = school?.logo_url || "";
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const subjectRows = report.subjects
      .map(
        (s) =>
          `<tr>
        <td style="padding:6px 10px;border:1px solid #ddd">${escapeHtml(s.name)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${s.score}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold">${escapeHtml(s.grade)}</td>
      </tr>`,
      )
      .join("");

    const feeBlock =
      report.feeBalance > 0
        ? `<div style="background:#fff3f3;border:1px solid #fca5a5;border-radius:8px;padding:10px;margin-top:12px;text-align:center">
           <strong style="color:#dc2626">Fees outstanding: UGX ${report.feeBalance.toLocaleString()}</strong>
         </div>`
        : "";

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document
      .write(`<html><head><title>Report Card - ${escapeHtml(report.name)}</title><style>
      body{font-family:Arial,sans-serif;padding:20px;max-width:700px;margin:0 auto}
      .header{text-align:center;border-bottom:3px solid ${schoolColor};padding-bottom:15px;margin-bottom:15px}
      .logo{max-width:80px;max-height:60px;margin-bottom:10px}
      .school-name{font-size:22px;font-weight:bold;color:${schoolColor}}
      .school-info{font-size:11px;color:#666;margin:3px 0}
      .report-title{font-size:16px;font-weight:bold;color:${schoolColor};margin:10px 0}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0;font-size:13px}
      .info-grid div{padding:4px 0}
      .info-label{color:#888;display:inline-block;width:120px}
      .info-value{font-weight:bold}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th{background:${schoolColor}15;padding:8px 10px;border:1px solid #ddd;text-align:left;font-size:12px;text-transform:uppercase}
      .summary{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin:15px 0}
      .summary-card{border:1px solid #ddd;border-radius:8px;padding:10px;text-align:center}
      .summary-value{font-size:20px;font-weight:bold;color:${schoolColor}}
      .summary-label{font-size:10px;color:#888;text-transform:uppercase}
      .comment-box{border:1px solid #ddd;border-radius:8px;padding:10px;margin:8px 0}
      .comment-label{font-size:11px;font-weight:bold;text-transform:uppercase;color:#888;margin-bottom:4px}
      .footer{text-align:center;margin-top:25px;font-size:11px;color:#999;border-top:2px solid ${schoolColor};padding-top:15px}
    </style></head><body>
      <div class="header">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="logo" alt="${escapeHtml(schoolName)}">` : ""}
        <div class="school-name">${escapeHtml(schoolName)}</div>
        <div class="school-info">Tel: ${escapeHtml(school?.phone || "")} | Email: ${escapeHtml(school?.email || "")}</div>
        <div class="report-title">STUDENT REPORT CARD</div>
        <div class="school-info">Term ${currentTerm}, ${academicYear}</div>
      </div>
      <div class="info-grid">
        <div><span class="info-label">Student Name:</span> <span class="info-value">${escapeHtml(report.name)}</span></div>
        <div><span class="info-label">Student No:</span> <span class="info-value">${escapeHtml(report.studentNumber)}</span></div>
        <div><span class="info-label">Class:</span> <span class="info-value">${escapeHtml(report.className)}</span></div>
        <div><span class="info-label">Gender:</span> <span class="info-value">${report.gender === "M" ? "Male" : "Female"}</span></div>
      </div>
      <table>
        <thead>
          <tr><th>Subject</th><th style="text-align:center">Score</th><th style="text-align:center">Grade</th></tr>
        </thead>
        <tbody>${subjectRows}</tbody>
      </table>
      <div class="summary">
        <div class="summary-card"><div class="summary-value">${report.totalMarks}/${report.maxMarks}</div><div class="summary-label">Total</div></div>
        <div class="summary-card"><div class="summary-value">${report.average}%</div><div class="summary-label">Average</div></div>
        <div class="summary-card"><div class="summary-value">${report.position}</div><div class="summary-label">Position</div></div>
        <div class="summary-card"><div class="summary-value">${escapeHtml(report.division)}</div><div class="summary-label">Division</div></div>
      </div>
      <div class="comment-box">
        <div class="comment-label">Class Teacher's Comment</div>
        <div>${escapeHtml(studentComment.classTeacher || report.classTeacherComment)}</div>
      </div>
      <div class="comment-box">
        <div class="comment-label">Headteacher's Comment</div>
        <div>${escapeHtml(studentComment.hm || report.hmComment)}</div>
      </div>
      ${feeBlock}
      <div class="footer">
        <div>Generated by SkoolMate OS</div>
      </div>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintAll = () => {
    if (displayedReports.length === 0) return;
    
    const schoolName = school?.name || "School Name";
    const schoolColor = school?.primary_color || "#002045";
    const logoUrl = school?.logo_url || "";
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    let allHtml = "";

    displayedReports.forEach((report, index) => {
      const studentComment = comments[report.studentId] || {
        classTeacher: "",
        hm: "",
      };
      
      const subjectRows = report.subjects
        .map(
          (s) =>
            `<tr>
          <td style="padding:6px 10px;border:1px solid #ddd">${escapeHtml(s.name)}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${s.score}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold">${escapeHtml(s.grade)}</td>
        </tr>`,
        )
        .join("");

      const feeBlock =
        report.feeBalance > 0
          ? `<div style="background:#fff3f3;border:1px solid #fca5a5;border-radius:8px;padding:10px;margin-top:12px;text-align:center">
             <strong style="color:#dc2626">Fees outstanding: UGX ${report.feeBalance.toLocaleString()}</strong>
           </div>`
          : "";

      allHtml += `
        <div class="report-page ${index > 0 ? 'page-break' : ''}">
          <div class="header">
            ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="logo" alt="${escapeHtml(schoolName)}">` : ""}
            <div class="school-name text-nowrap">${escapeHtml(schoolName)}</div>
            <div class="school-info">Tel: ${escapeHtml(school?.phone || "")} | Email: ${escapeHtml(school?.email || "")}</div>
            <div class="report-title">STUDENT REPORT CARD</div>
            <div class="school-info">Term ${currentTerm}, ${academicYear}</div>
          </div>
          <div class="info-grid">
            <div><span class="info-label">Student Name:</span> <span class="info-value text-nowrap">${escapeHtml(report.name)}</span></div>
            <div><span class="info-label">Student No:</span> <span class="info-value">${escapeHtml(report.studentNumber)}</span></div>
            <div><span class="info-label">Class:</span> <span class="info-value">${escapeHtml(report.className)}</span></div>
            <div><span class="info-label">Gender:</span> <span class="info-value">${report.gender === "M" ? "Male" : "Female"}</span></div>
          </div>
          <table>
            <thead>
              <tr><th>Subject</th><th style="text-align:center">Score</th><th style="text-align:center">Grade</th></tr>
            </thead>
            <tbody>${subjectRows}</tbody>
          </table>
          <div class="summary">
            <div class="summary-card"><div class="summary-value">${report.totalMarks}/${report.maxMarks}</div><div class="summary-label">Total</div></div>
            <div class="summary-card"><div class="summary-value">${report.average}%</div><div class="summary-label">Average</div></div>
            <div class="summary-card"><div class="summary-value">${report.position}</div><div class="summary-label">Position</div></div>
            <div class="summary-card"><div class="summary-value text-nowrap">${escapeHtml(report.division)}</div><div class="summary-label">Division</div></div>
          </div>
          <div class="comment-box">
            <div class="comment-label">Class Teacher's Comment</div>
            <div class="text-xs">${escapeHtml(studentComment.classTeacher || report.classTeacherComment)}</div>
          </div>
          <div class="comment-box">
            <div class="comment-label">Headteacher's Comment</div>
            <div class="text-xs">${escapeHtml(studentComment.hm || report.hmComment)}</div>
          </div>
          ${feeBlock}
          <div class="footer">
            <div>Result Slip Summary - Generated by SkoolMate OS</div>
            <div style="font-size:8px; margin-top:5px;">Page ${index + 1} of ${displayedReports.length}</div>
          </div>
        </div>
      `;
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`<html><head><title>Mass Report Printing - ${selectedClassName}</title><style>
      @media print { .page-break { page-break-before: always; } }
      body{font-family:Arial,sans-serif;padding:0;margin:0;background:#f5f5f5}
      .report-page{background:white;padding:40px;max-width:800px;margin:20px auto;box-shadow:0 0 10px rgba(0,0,0,0.1);min-height:297mm}
      @media print { .report-page{margin:0;box-shadow:none;width:100%;max-width:none} body{background:white} }
      .header{text-align:center;border-bottom:3px solid ${schoolColor};padding-bottom:15px;margin-bottom:15px}
      .logo{max-width:80px;max-height:60px;margin-bottom:10px}
      .school-name{font-size:24px;font-weight:bold;color:${schoolColor};text-transform:uppercase}
      .school-info{font-size:11px;color:#666;margin:3px 0}
      .report-title{font-size:18px;font-weight:bold;color:${schoolColor};margin:10px 0;letter-spacing:1px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:15px 0;font-size:14px}
      .info-label{color:#888;display:inline-block;width:120px}
      .info-value{font-weight:bold;color:#333}
      table{width:100%;border-collapse:collapse;margin:15px 0}
      th{background:${schoolColor}15;padding:10px;border:1px solid #ddd;text-align:left;font-size:11px;text-transform:uppercase;color:${schoolColor}}
      td{padding:8px 10px;border:1px solid #ddd;font-size:13px}
      .summary{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:15px;margin:20px 0}
      .summary-card{border:2px solid ${schoolColor}20;border-radius:12px;padding:12px;text-align:center;background:${schoolColor}05}
      .summary-value{font-size:22px;font-weight:bold;color:${schoolColor}}
      .summary-label{font-size:9px;color:#888;text-transform:uppercase;margin-top:4px;font-weight:bold}
      .comment-box{border:1px solid #eee;border-radius:12px;padding:15px;margin:12px 0;background:#fafafa}
      .comment-label{font-size:10px;font-weight:bold;text-transform:uppercase;color:#aaa;margin-bottom:6px}
      .text-nowrap{white-space:nowrap}
      .text-xs{font-size:12px;line-height:1.4}
      .footer{text-align:center;margin-top:30px;font-size:10px;color:#bbb;border-top:1px dashed #ddd;padding-top:20px}
    </style></head><body>
      ${allHtml}
      <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
    </body></html>`);
    printWindow.document.close();
  };

  const handleSendSms = async (report: StudentReport) => {
    const student = classStudents.find(s => s.id === report.studentId);
    if (!student || !student.parent_phone) {
      toast.error(`Phone number missing for ${report.name}`);
      return;
    }

    setSendingSms(true);
    try {
      const { supabase: sb } = await import("@/lib/supabase");
      const message = `SkoolMate Alert: ${report.name} (Term ${currentTerm} Results). Avg: ${report.average}%, Pos: ${report.position}, Div: ${report.division}. Balance: UGX ${report.feeBalance.toLocaleString()}.`;
      
      const { error } = await sb.from("messages").insert({
        school_id: school?.id,
        recipient_phone: student.parent_phone,
        message,
        status: "sent",
        type: "report_card"
      });

      if (error) throw error;
      toast.success(`Result summary sent to ${student.parent_phone}`);
    } catch (err) {
      console.error("SMS Error:", err);
      toast.error("Failed to send results via SMS");
    } finally {
      setSendingSms(false);
    }
  };

  const actions = (
    <div className="flex gap-2">
      {generated && reports.length > 0 && (
        <Button variant="ghost" onClick={handlePrintAll} className="border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100">
          <MaterialIcon icon="print_connect" style={{ fontSize: "18px" }} />
          Print All Class ({displayedReports.length})
        </Button>
      )}
      <Button onClick={handleGenerate} className="bg-indigo-600 shadow-indigo-600/20">
        <MaterialIcon icon="bolt" style={{ fontSize: "18px" }} />
        Generate Now
      </Button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Report Cards"
        subtitle="Generate and manage student report cards"
        actions={actions}
      />

      <Card className="mb-5">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="report-cards-class"
                className="block text-sm font-medium mb-2 text-[var(--on-surface)]"
              >
                Select Class
              </label>
              {classes.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                  No classes available
                </div>
              ) : (
                <select
                  id="report-cards-class"
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setGenerated(false);
                    setReports([]);
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.stream ? ` ${c.stream}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">
                Term
              </label>
              <div className="px-4 py-3 rounded-xl bg-[var(--surface-container)] text-[var(--primary)] font-semibold">
                Term {currentTerm}, {academicYear}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">
                Students
              </label>
              <div className="px-4 py-3 rounded-xl bg-[var(--surface-container)] text-[var(--primary)] font-semibold">
                {filteredStudents.length} students
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {generated && reports.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
          <Card>
            <CardBody className="text-center">
              <div className="text-xs font-semibold text-[var(--t3)] mb-1">
                Class Average
              </div>
              <div className="text-2xl font-bold text-[var(--primary)]">
                {stats.avgTotal}%
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-xs font-semibold text-[var(--t3)] mb-1">
                Division 1
              </div>
              <div className="text-2xl font-bold text-green-600">
                {stats.div1} students
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-xs font-semibold text-[var(--t3)] mb-1">
                Fee Defaulters
              </div>
              <div className="text-2xl font-bold text-red-600">
                {stats.withFees} students
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-xs font-semibold text-[var(--t3)] mb-1">
                Total Students
              </div>
              <div className="text-2xl font-bold text-[var(--on-surface)]">
                {reports.length}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {generated && (
        <div className="flex items-center gap-3 mb-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideWithFees}
              onChange={(e) => setHideWithFees(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-semibold text-[var(--on-surface)]">
              Hide students with outstanding fees
            </span>
          </label>
        </div>
      )}

      {generated && displayedReports.length > 0 && (
        <Card>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--surface-container)] text-left">
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)]">
                      Student
                    </th>
                    <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)] text-center">
                      Total
                    </th>
                    <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)] text-center">
                      Average
                    </th>
                    <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)] text-center">
                      Position
                    </th>
                    <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)] text-center">
                      Division
                    </th>
                    <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)]">
                      Fees
                    </th>
                    <th className="px-4 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)]">
                      Comments
                    </th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-semibold text-[var(--t1)] text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {displayedReports.map((report) => {
                    const studentComment = comments[report.studentId] || {
                      classTeacher: "",
                      hm: "",
                    };
                    return (
                      <tr
                        key={report.studentId}
                        className="hover:bg-[var(--surface-container)] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white"
                              style={{
                                background:
                                  report.gender === "M"
                                    ? "var(--navy, #002045)"
                                    : "#c0392b",
                              }}
                            >
                              {report.name
                                .split(" ")
                                .map((n) => n.charAt(0))
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-[var(--primary)]">
                                {report.name}
                              </div>
                              <div className="text-xs text-[var(--t3)] font-mono">
                                {report.studentNumber}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-bold text-lg text-[var(--primary)]">
                            {report.totalMarks}
                          </span>
                          <span className="text-xs text-[var(--t3)]">
                            /{report.maxMarks}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-semibold">
                          {report.average}%
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary)] text-white font-bold text-sm">
                            {report.position}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${report.division === "Division 1" ? "bg-green-100 text-green-700" : report.division === "Division 2" ? "bg-blue-100 text-blue-700" : report.division === "Division 3" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
                          >
                            {report.division}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {report.feeBalance > 0 ? (
                            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                              {report.feeBalance.toLocaleString()} UGX
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                              Clear
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1.5 max-w-[260px]">
                            <div>
                              <label className="text-[10px] font-semibold uppercase text-[var(--t3)]">
                                Class Teacher
                              </label>
                              <input
                                type="text"
                                value={studentComment.classTeacher}
                                onChange={(e) =>
                                  handleCommentChange(
                                    report.studentId,
                                    "classTeacher",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-container)] text-sm border-none"
                                placeholder="Class teacher comment..."
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold uppercase text-[var(--t3)]">
                                Headteacher
                              </label>
                              <input
                                type="text"
                                value={studentComment.hm}
                                onChange={(e) =>
                                  handleCommentChange(
                                    report.studentId,
                                    "hm",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-container)] text-sm border-none"
                                placeholder="HM comment..."
                              />
                            </div>
                            <button
                              onClick={() =>
                                handleSuggestComment(
                                  report.studentId,
                                  report.position,
                                )
                              }
                              className="text-[10px] font-semibold text-[var(--primary)] hover:underline"
                            >
                              Auto-suggest
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handlePrintReport(report)}
                              title="Print Report Card"
                              className="p-2 rounded-lg hover:bg-[var(--surface-container)] text-[var(--t3)]"
                            >
                              <MaterialIcon className="text-xl">
                                print
                              </MaterialIcon>
                            </button>
                            <button
                              onClick={() => handleSendSms(report)}
                              disabled={sendingSms}
                              title="Send SMS"
                              className="p-2 rounded-lg hover:bg-[var(--surface-container)] text-[var(--t3)] disabled:opacity-40"
                            >
                              <MaterialIcon className="text-xl">
                                sms
                              </MaterialIcon>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {!generated && (
        <Card>
          <CardBody>
            <EmptyState
              icon="summarize"
              title="Generate Report Cards"
              description="Select a class and click Generate to create report cards with positions, divisions, and comments."
            />
          </CardBody>
        </Card>
      )}

      {generated && displayedReports.length === 0 && reports.length > 0 && (
        <Card>
          <CardBody>
            <EmptyState
              icon="filter_alt_off"
              title="All Hidden"
              description="All students have outstanding fees. Uncheck the filter to view."
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
