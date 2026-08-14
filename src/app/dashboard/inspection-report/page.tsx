"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses, useStaff, useFeePayments, useFeeStructure, useDashboardStats } from "@/lib/hooks";
import { useDashboardExtraData } from "@/lib/hooks/useDashboardExtraData";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { SchoolReadinessGuide } from "@/components/dashboard/SchoolReadinessGuide";
import { toLocalDateString } from "@/lib/date-utils";
import { logger } from "@/lib/logger";

interface ByClassEntry {
  className: string;
  level: string;
  male: number;
  female: number;
  total: number;
  present: number;
  presentPercent: number;
}

interface ReportData {
  school: {
    name: string;
    code: string;
    district: string;
    type: string;
    ownership: string;
    phone?: string;
    email?: string;
  };
  academicYear: string;
  term: string | number;
  dateGenerated: string;
  enrollment: {
    total: number;
    male: number;
    female: number;
  };
  byClass: ByClassEntry[];
  attendance: {
    overallRate: number;
    classesBelow70: number;
  };
  fees: {
    expected: number;
    collected: number;
    rate: number;
    overdueCount: number;
    today: number;
    thisWeek: number;
    thisTerm: number;
  };
  staff: {
    total: number;
    male: number;
    female: number;
    onDutyToday: number;
  };
  pending: {
    expenses: number;
    leave: number;
  };
  atRisk: number;
}

function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

function InspectionReportContent() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students = [] } = useStudents(school?.id);
  const { classes = [] } = useClasses(school?.id);
  const { staff = [] } = useStaff(school?.id);
  const { payments = [] } = useFeePayments(school?.id);
  const { feeStructure = [] } = useFeeStructure(school?.id);
  const { stats } = useDashboardStats(school?.id);

  const {
    classAttendance,
    pendingExpenses,
    pendingLeave,
    feesToday,
    feesThisWeek,
    feesThisTerm,
    staffOnDuty,
    overdueFeeCount,
    lowAttendanceClasses,
    dropoutRiskCount,
    loading: loadingExtra,
  } = useDashboardExtraData(school?.id, students, feeStructure, currentTerm, academicYear);

  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const totalFeesExpected = useMemo(() => {
    if (!students.length || !feeStructure.length) return 0;
    return students.reduce((total, student) => {
      const classFees = feeStructure.filter((f) => !f.class_id || f.class_id === student.class_id);
      return total + classFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    }, 0);
  }, [students, feeStructure]);

  const totalFeesCollected = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0),
    [payments],
  );

  const collectionRate = useMemo(
    () => (totalFeesExpected > 0 ? Math.round((totalFeesCollected / totalFeesExpected) * 100) : 0),
    [totalFeesExpected, totalFeesCollected],
  );

  const maleStudents = useMemo(() => students.filter((s) => s.gender === "M").length, [students]);
  const femaleStudents = useMemo(() => students.filter((s) => s.gender === "F").length, [students]);

  const maleStaff = useMemo(() => staff.filter((s) => (s as Record<string, unknown>).gender === "M").length, [staff]);
  const femaleStaff = useMemo(() => staff.filter((s) => (s as Record<string, unknown>).gender === "F").length, [staff]);

  const byClass: ByClassEntry[] = useMemo(() => {
    return classes.map((cls) => {
      const classStudents = students.filter((s) => s.class_id === cls.id);
      const male = classStudents.filter((s) => s.gender === "M").length;
      const female = classStudents.filter((s) => s.gender === "F").length;
      const att = classAttendance[cls.id];
      const present = att?.present || 0;
      const total = classStudents.length;
      return {
        className: cls.name,
        level: cls.level,
        male,
        female,
        total,
        present,
        presentPercent: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    });
  }, [classes, students, classAttendance]);

  const attendanceRate = useMemo(() => {
    const totalPresent = Object.values(classAttendance).reduce((sum, c) => sum + c.present, 0);
    const total = Object.values(classAttendance).reduce((sum, c) => sum + c.total, 0);
    return total > 0 ? Math.round((totalPresent / total) * 100) : 0;
  }, [classAttendance]);

  const generateReport = () => {
    setReportData({
      school: {
        name: school?.name || "",
        code: school?.school_code || "",
        district: school?.district || "",
        type: (school as { school_type?: string })?.school_type || "",
        ownership: (school as { ownership?: string })?.ownership || "",
        phone: (school as { phone?: string })?.phone,
        email: (school as { email?: string })?.email,
      },
      academicYear: academicYear || "",
      term: currentTerm || 1,
      dateGenerated: new Date().toISOString(),
      enrollment: {
        total: students.length,
        male: maleStudents,
        female: femaleStudents,
      },
      byClass,
      attendance: {
        overallRate: attendanceRate,
        classesBelow70: lowAttendanceClasses,
      },
      fees: {
        expected: totalFeesExpected,
        collected: totalFeesCollected,
        rate: collectionRate,
        overdueCount: overdueFeeCount,
        today: feesToday,
        thisWeek: feesThisWeek,
        thisTerm: feesThisTerm,
      },
      staff: {
        total: staff.length,
        male: maleStaff,
        female: femaleStaff,
        onDutyToday: staffOnDuty,
      },
      pending: {
        expenses: pendingExpenses,
        leave: pendingLeave,
      },
      atRisk: dropoutRiskCount,
    });
  };

  const exportToExcel = async () => {
    if (!reportData) return;
    setExportingExcel(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      const summarySheet = workbook.addWorksheet("Summary");
      const rows = [
        ["INSPECTION REPORT — MINISTRY OF EDUCATION"],
        [""],
        ["School Name", reportData.school.name],
        ["School Code", reportData.school.code],
        ["District", reportData.school.district],
        ["School Type", reportData.school.type],
        ["Ownership", reportData.school.ownership],
        ["Phone", reportData.school.phone || ""],
        ["Email", reportData.school.email || ""],
        ["Academic Year", reportData.academicYear],
        ["Term", reportData.term],
        ["Date Generated", toLocalDateString()],
        [""],
        ["ENROLLMENT SUMMARY"],
        ["Total Students", reportData.enrollment.total],
        ["Male Students", reportData.enrollment.male],
        ["Female Students", reportData.enrollment.female],
        [""],
        ["ATTENDANCE"],
        ["Overall Rate", `${reportData.attendance.overallRate}%`],
        ["Classes Below 70%", reportData.attendance.classesBelow70],
        [""],
        ["FEE COLLECTION"],
        ["Total Expected", reportData.fees.expected],
        ["Total Collected", reportData.fees.collected],
        ["Collection Rate", `${reportData.fees.rate}%`],
        ["Overdue Count", reportData.fees.overdueCount],
        ["Collected Today", reportData.fees.today],
        ["Collected This Week", reportData.fees.thisWeek],
        ["Collected This Term", reportData.fees.thisTerm],
        [""],
        ["STAFF SUMMARY"],
        ["Total Staff", reportData.staff.total],
        ["Male Staff", reportData.staff.male],
        ["Female Staff", reportData.staff.female],
        ["On Duty Today", reportData.staff.onDutyToday],
        [""],
        ["PENDING ISSUES"],
        ["Pending Expense Approvals", reportData.pending.expenses],
        ["Pending Leave Requests", reportData.pending.leave],
        ["At-Risk / Dropout Students", reportData.atRisk],
      ];
      rows.forEach((row) => summarySheet.addRow(row));

      const enrollmentSheet = workbook.addWorksheet("Enrollment by Class");
      enrollmentSheet.addRow(["Class", "Level", "Male", "Female", "Total", "Present", "Present %"]);
      reportData.byClass.forEach((c) => {
        enrollmentSheet.addRow([c.className, c.level, c.male, c.female, c.total, c.present, `${c.presentPercent}%`]);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Inspection_Report_${school?.school_code}_${academicYear}_T${currentTerm}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error(err);
    } finally {
      setExportingExcel(false);
    }
  };

  const exportToPDF = async () => {
    if (!reportData) return;
    setExportingPDF(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      let autoTable: any;
      try {
        autoTable = (await import("jspdf-autotable")).default;
      } catch {
        autoTable = null;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(16);
      doc.text("INSPECTION REPORT", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(10);
      doc.text(`Ministry of Education & Sports`, pageWidth / 2, 27, { align: "center" });
      doc.setFontSize(9);
      doc.text(`${reportData.school.name} (${reportData.school.code})`, pageWidth / 2, 33, { align: "center" });

      let y = 42;
      const line = (label: string, value: string) => {
        doc.setFontSize(9);
        doc.text(`${label}:`, 14, y);
        doc.text(value, 80, y);
        y += 6;
      };

      line("District", reportData.school.district);
      line("School Type", reportData.school.type);
      line("Ownership", reportData.school.ownership);
      line("Academic Year", reportData.academicYear);
      line("Term", String(reportData.term));
      line("Generated", toLocalDateString());
      y += 4;

      doc.setFontSize(11);
      doc.text("Enrollment Summary", 14, y);
      y += 7;
      line("Total Students", String(reportData.enrollment.total));
      line("Male", String(reportData.enrollment.male));
      line("Female", String(reportData.enrollment.female));
      y += 4;

      doc.text("Attendance", 14, y);
      y += 7;
      line("Overall Rate", `${reportData.attendance.overallRate}%`);
      line("Classes Below 70%", String(reportData.attendance.classesBelow70));
      y += 4;

      doc.text("Fee Collection", 14, y);
      y += 7;
      line("Total Expected", formatCurrency(reportData.fees.expected));
      line("Total Collected", formatCurrency(reportData.fees.collected));
      line("Collection Rate", `${reportData.fees.rate}%`);
      line("Overdue Count", String(reportData.fees.overdueCount));
      y += 4;

      doc.text("Staff Summary", 14, y);
      y += 7;
      line("Total Staff", String(reportData.staff.total));
      line("On Duty Today", String(reportData.staff.onDutyToday));
      y += 4;

      doc.text("Pending Issues", 14, y);
      y += 7;
      line("Pending Expense Approvals", String(reportData.pending.expenses));
      line("Pending Leave Requests", String(reportData.pending.leave));
      line("At-Risk Students", String(reportData.atRisk));

      if (autoTable) {
        doc.addPage();
        autoTable(doc, {
          head: [["Class", "Level", "Male", "Female", "Total", "Present", "%"]],
          body: reportData.byClass.map((c) => [
            c.className,
            c.level,
            c.male,
            c.female,
            c.total,
            c.present,
            `${c.presentPercent}%`,
          ]),
          startY: 20,
          theme: "grid",
          headStyles: { fillColor: [23, 50, 95] },
        });
      }

      doc.save(`Inspection_Report_${school?.school_code}_${academicYear}_T${currentTerm}.pdf`);
    } catch (err) {
      logger.error(err);
    } finally {
      setExportingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const readinessItems = useMemo(
    () => [
      {
        label: "Student records",
        status: (students.length > 0 ? "ok" : "missing") as "ok" | "missing" | "pending",
        link: "/dashboard/students?action=add",
        detail: students.length > 0 ? `${students.length} enrolled` : "No students enrolled yet",
      },
      {
        label: "Attendance taken today",
        status: (stats.presentToday > 0 ? "ok" : "pending") as "ok" | "missing" | "pending",
        link: "/dashboard/attendance",
        detail:
          stats.presentToday > 0
            ? `${stats.presentToday} present`
            : stats.presentToday < 0
              ? "Checking…"
              : "Not taken yet",
      },
      {
        label: "Fee collection",
        status: (collectionRate >= 60 ? "ok" : "pending") as "ok" | "missing" | "pending",
        link: "/dashboard/fees",
        detail:
          collectionRate >= 60
            ? `${collectionRate}% collected`
            : `${collectionRate}% collected \u2014 below 60% target`,
      },
      {
        label: "Pending approvals",
        status: (pendingExpenses + pendingLeave === 0 ? "ok" : "pending") as "ok" | "missing" | "pending",
        link: "/dashboard/expense-approvals",
        detail:
          pendingExpenses + pendingLeave === 0
            ? "None"
            : `${pendingExpenses + pendingLeave} item${pendingExpenses + pendingLeave > 1 ? "s" : ""} waiting`,
      },
      {
        label: "Classes with low attendance",
        status: (lowAttendanceClasses === 0 ? "ok" : "pending") as "ok" | "missing" | "pending",
        link: "/dashboard/attendance",
        detail:
          lowAttendanceClasses === 0
            ? "All classes on track"
            : `${lowAttendanceClasses} class${lowAttendanceClasses > 1 ? "es" : ""} below 70%`,
      },
    ],
    [students, stats, collectionRate, pendingExpenses, pendingLeave, lowAttendanceClasses],
  );

  const isLoading = loadingExtra;

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Inspection Report"
          subtitle="Comprehensive report for Ministry of Education school inspection"
        />

        <SchoolReadinessGuide title="Before Inspection" items={readinessItems} />

        <Card className="mb-6">
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--on-surface)] mb-1">Academic Year</label>
                <input value={academicYear} disabled className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--on-surface)] mb-1">Term</label>
                <input value={`Term ${currentTerm}`} disabled className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">&nbsp;</label>
                <Button onClick={generateReport} disabled={reportData !== null} className="w-full">
                  Generate Report
                </Button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">&nbsp;</label>
                <Button onClick={generateReport} disabled={reportData !== null} variant="secondary" className="w-full">
                  Regenerate
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {isLoading && !reportData && (
          <Card className="mb-6">
            <CardBody>
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-8 bg-gray-200 rounded" />
                <div className="h-8 bg-gray-200 rounded" />
                <div className="h-8 bg-gray-200 rounded" />
              </div>
            </CardBody>
          </Card>
        )}

        {reportData && (
          <>
            <Card className="mb-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Report Preview</CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={exportToExcel}
                    disabled={exportingExcel}
                    size="sm"
                    variant="secondary"
                    icon={<MaterialIcon icon="download" style={{ fontSize: 16 }} />}
                  >
                    {exportingExcel ? "Exporting..." : "Export Excel"}
                  </Button>
                  <Button
                    onClick={exportToPDF}
                    disabled={exportingPDF}
                    size="sm"
                    variant="secondary"
                    icon={<MaterialIcon icon="picture_as_pdf" style={{ fontSize: 16 }} />}
                  >
                    {exportingPDF ? "Exporting..." : "Export PDF"}
                  </Button>
                  <Button
                    onClick={handlePrint}
                    size="sm"
                    variant="secondary"
                    icon={<MaterialIcon icon="print" style={{ fontSize: 16 }} />}
                  >
                    Print
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* School Info */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>School Information</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-[var(--t3)]">School Name</div>
                    <div className="font-medium text-[var(--t1)]">{reportData.school.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--t3)]">School Code</div>
                    <div className="font-medium text-[var(--t1)]">{reportData.school.code}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--t3)]">District</div>
                    <div className="font-medium text-[var(--t1)]">{reportData.school.district}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--t3)]">Type / Ownership</div>
                    <div className="font-medium text-[var(--t1)]">
                      {reportData.school.type} · {reportData.school.ownership}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Card className="text-center">
                <CardBody>
                  <div className="text-2xl font-bold text-[var(--t1)]">{reportData.enrollment.total}</div>
                  <div className="text-sm text-[var(--t3)]">Total Students</div>
                  <div className="text-xs text-[var(--t4)]">
                    {reportData.enrollment.male}B · {reportData.enrollment.female}G
                  </div>
                </CardBody>
              </Card>
              <Card className="text-center">
                <CardBody>
                  <div
                    className={`text-2xl font-bold ${reportData.attendance.overallRate >= 80 ? "text-green-600" : "text-amber-600"}`}
                  >
                    {reportData.attendance.overallRate}%
                  </div>
                  <div className="text-sm text-[var(--t3)]">Attendance Rate</div>
                  <div className="text-xs text-[var(--t4)]">
                    {reportData.attendance.classesBelow70} class{reportData.attendance.classesBelow70 !== 1 ? "es" : ""}{" "}
                    below 70%
                  </div>
                </CardBody>
              </Card>
              <Card className="text-center">
                <CardBody>
                  <div
                    className={`text-2xl font-bold ${reportData.fees.rate >= 60 ? "text-green-600" : "text-red-600"}`}
                  >
                    {reportData.fees.rate}%
                  </div>
                  <div className="text-sm text-[var(--t3)]">Fee Collection</div>
                  <div className="text-xs text-[var(--t4)]">{reportData.fees.overdueCount} overdue</div>
                </CardBody>
              </Card>
              <Card className="text-center">
                <CardBody>
                  <div className="text-2xl font-bold text-[var(--t1)]">{reportData.staff.total}</div>
                  <div className="text-sm text-[var(--t3)]">Staff</div>
                  <div className="text-xs text-[var(--t4)]">{reportData.staff.onDutyToday} on duty today</div>
                </CardBody>
              </Card>
            </div>

            {/* Enrollment by Class */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Enrollment by Class</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Level</th>
                        <th>Male</th>
                        <th>Female</th>
                        <th>Total</th>
                        <th>Present</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.byClass.map((c, idx) => (
                        <tr key={idx}>
                          <td className="font-medium text-[var(--t1)]">{c.className}</td>
                          <td>{c.level}</td>
                          <td className="text-blue-600">{c.male}</td>
                          <td className="text-pink-600">{c.female}</td>
                          <td className="font-bold">{c.total}</td>
                          <td>{c.present}</td>
                          <td>
                            <span className={c.presentPercent < 70 ? "text-red-600 font-medium" : "text-green-600"}>
                              {c.presentPercent}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold">
                        <td colSpan={2}>TOTAL</td>
                        <td className="text-blue-600">{reportData.enrollment.male}</td>
                        <td className="text-pink-600">{reportData.enrollment.female}</td>
                        <td>{reportData.enrollment.total}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardBody>
            </Card>

            {/* Fee Collection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Card>
                <CardHeader>
                  <CardTitle>Fee Collection Details</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Total Expected</span>
                      <span className="font-medium text-[var(--t1)]">{formatCurrency(reportData.fees.expected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Total Collected</span>
                      <span className="font-medium text-green-600">{formatCurrency(reportData.fees.collected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Collection Rate</span>
                      <span className={`font-medium ${reportData.fees.rate >= 60 ? "text-green-600" : "text-red-600"}`}>
                        {reportData.fees.rate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Overdue Students</span>
                      <span
                        className={`font-medium ${reportData.fees.overdueCount > 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        {reportData.fees.overdueCount}
                      </span>
                    </div>
                    <hr className="border-[var(--border)]" />
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Collected Today</span>
                      <span className="font-medium">{formatCurrency(reportData.fees.today)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Collected This Week</span>
                      <span className="font-medium">{formatCurrency(reportData.fees.thisWeek)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Collected This Term</span>
                      <span className="font-medium">{formatCurrency(reportData.fees.thisTerm)}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Staff Summary</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Total Staff</span>
                      <span className="font-medium text-[var(--t1)]">{reportData.staff.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Male</span>
                      <span className="font-medium text-blue-600">{reportData.staff.male}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Female</span>
                      <span className="font-medium text-pink-600">{reportData.staff.female}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">On Duty Today</span>
                      <span
                        className={`font-medium ${reportData.staff.onDutyToday > 0 ? "text-green-600" : "text-amber-600"}`}
                      >
                        {reportData.staff.onDutyToday}
                      </span>
                    </div>
                    <hr className="border-[var(--border)]" />
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Pending Expense Approvals</span>
                      <span
                        className={`font-medium ${reportData.pending.expenses > 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        {reportData.pending.expenses}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">Pending Leave Requests</span>
                      <span
                        className={`font-medium ${reportData.pending.leave > 0 ? "text-amber-600" : "text-green-600"}`}
                      >
                        {reportData.pending.leave}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--t3)]">At-Risk Students</span>
                      <span className={`font-medium ${reportData.atRisk > 0 ? "text-red-600" : "text-green-600"}`}>
                        {reportData.atRisk}
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card className="mb-4">
              <CardBody>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={exportToExcel}
                    disabled={exportingExcel}
                    icon={<MaterialIcon icon="download" style={{ fontSize: 18 }} />}
                  >
                    {exportingExcel ? "Exporting..." : "Download Excel Report"}
                  </Button>
                  <Button
                    onClick={exportToPDF}
                    disabled={exportingPDF}
                    variant="secondary"
                    icon={<MaterialIcon icon="picture_as_pdf" style={{ fontSize: 18 }} />}
                  >
                    {exportingPDF ? "Exporting..." : "Download PDF Report"}
                  </Button>
                  <Button
                    onClick={handlePrint}
                    variant="secondary"
                    icon={<MaterialIcon icon="print" style={{ fontSize: 18 }} />}
                  >
                    Print Report
                  </Button>
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </PageErrorBoundary>
  );
}

export default function InspectionReportPage() {
  return <InspectionReportContent />;
}
