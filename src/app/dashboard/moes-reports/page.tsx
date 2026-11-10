"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { logger } from "@/lib/logger";

type ClassSummary = { name: string; level: string; male: number; female: number; total: number };
type PrepReport = {
  school: { name: string; code: string; district: string; type: string; ownership: string };
  academicYear: string;
  term: number;
  generatedAt: string;
  students: { total: number; male: number; female: number; withoutDateOfBirth: number; withoutParentContact: number };
  classes: ClassSummary[];
  staff: { total: number };
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CheckRow({ label, complete, detail }: { label: string; complete: boolean; detail: string }) {
  return (
    <li className="flex items-start gap-3 py-3 border-b border-[var(--outline-variant)] last:border-0">
      <MaterialIcon
        icon={complete ? "check_circle" : "error_outline"}
        className={complete ? "text-green-600" : "text-amber-600"}
        style={{ fontSize: 20 }}
      />
      <div className="min-w-0">
        <p className="font-medium text-[var(--t1)]">{label}</p>
        <p className="text-sm text-[var(--t3)]">{detail}</p>
      </div>
    </li>
  );
}

export default function MOESReportsPage() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<PrepReport | null>(null);
  const [error, setError] = useState("");

  const generateReport = async () => {
    if (!school?.id) {
      setError("Your school profile is not available. Refresh the page and try again.");
      return;
    }
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const [studentsResult, staffResult, classesResult] = await Promise.all([
        supabase
          .from("students")
          .select("id, gender, date_of_birth, parent_phone, status, class_id")
          .eq("school_id", school.id)
          .eq("status", "active"),
        supabase.from("users").select("id").eq("school_id", school.id).eq("role", "teacher").eq("is_active", true),
        supabase.from("classes").select("id, name, level").eq("school_id", school.id),
      ]);
      if (studentsResult.error) throw studentsResult.error;
      if (staffResult.error) throw staffResult.error;
      if (classesResult.error) throw classesResult.error;

      const students = studentsResult.data ?? [];
      const classes = classesResult.data ?? [];
      const byClass = classes.map((cls) => {
        const members = students.filter((student) => student.class_id === cls.id);
        const male = members.filter((student) => student.gender === "M").length;
        const female = members.filter((student) => student.gender === "F").length;
        return { name: cls.name, level: cls.level, male, female, total: members.length };
      });
      setReport({
        school: {
          name: school.name || "",
          code: school.school_code || "",
          district: school.district || "",
          type: school.school_type || "",
          ownership: school.ownership || "",
        },
        academicYear: String(academicYear || ""),
        term: Number(currentTerm || 1),
        generatedAt: new Date().toISOString(),
        students: {
          total: students.length,
          male: students.filter((student) => student.gender === "M").length,
          female: students.filter((student) => student.gender === "F").length,
          withoutDateOfBirth: students.filter((student) => !student.date_of_birth).length,
          withoutParentContact: students.filter((student) => !student.parent_phone?.trim()).length,
        },
        classes: byClass,
        staff: { total: staffResult.data?.length ?? 0 },
      });
    } catch (err) {
      logger.error("Failed to prepare school data summary", err);
      setError("We could not load the school records. Check your connection and access, then try again.");
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "SkoolMate";
      workbook.subject = "School data preparation summary; not an official EMIS submission template";
      const summary = workbook.addWorksheet("School Summary");
      summary.addRows([
        ["SKOOLMATE SCHOOL DATA PREPARATION SUMMARY"],
        ["Working summary only. Not an official MoES or EMIS submission template."],
        [],
        ["School name", report.school.name],
        ["School code", report.school.code],
        ["District", report.school.district],
        ["School type", report.school.type],
        ["Ownership", report.school.ownership],
        ["Academic year", report.academicYear],
        ["Term", report.term],
        ["Generated", new Date(report.generatedAt).toLocaleString()],
        [],
        ["Active learners", report.students.total],
        ["Male learners", report.students.male],
        ["Female learners", report.students.female],
        ["Active teachers", report.staff.total],
        ["Classes", report.classes.length],
        ["Learners missing date of birth", report.students.withoutDateOfBirth],
        ["Learners missing parent contact", report.students.withoutParentContact],
      ]);
      summary.columns = [{ width: 36 }, { width: 32 }];
      summary.getRow(1).font = { bold: true, size: 15, color: { argb: "FF0B2E59" } };
      summary.getRow(2).font = { italic: true, color: { argb: "FFB45309" } };
      const classSheet = workbook.addWorksheet("By Class");
      classSheet.addRow(["Class", "Level", "Male", "Female", "Total"]);
      report.classes.forEach((item) => classSheet.addRow([item.name, item.level, item.male, item.female, item.total]));
      classSheet.getRow(1).font = { bold: true, color: { argb: "FF0B2E59" } };
      classSheet.columns = [{ width: 22 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }];
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `SkoolMate_School_Data_Summary_${report.school.code || "school"}_${report.academicYear}.xlsx`,
      );
    } catch (err) {
      logger.error("Failed to export school data summary", err);
      setError("The spreadsheet could not be created. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const exportJson = () => {
    if (!report) return;
    downloadBlob(
      new Blob(
        [
          JSON.stringify(
            { ...report, documentType: "SkoolMate school data preparation summary", officialEmisTemplate: false },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      `SkoolMate_School_Data_Summary_${report.school.code || "school"}_${report.academicYear}.json`,
    );
  };

  const profileChecks = report
    ? [
        { label: "School name", value: report.school.name },
        { label: "School code", value: report.school.code },
        { label: "District", value: report.school.district },
        { label: "School type", value: report.school.type },
        { label: "Ownership", value: report.school.ownership },
      ]
    : [];

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="print:hidden">
          <PageHeader
            title="School Data Preparation"
            subtitle="Review your school records and prepare a clear summary for your reporting workflow."
          />
        </div>

        <Card className="mb-6 border-l-4 border-l-blue-600 print:hidden">
          <CardBody>
            <div className="flex items-start gap-3">
              <MaterialIcon icon="info" className="text-blue-700" style={{ fontSize: 22 }} />
              <div>
                <p className="font-semibold text-[var(--t1)]">Designed to support preparation, not replace EMIS</p>
                <p className="mt-1 text-sm text-[var(--t3)]">
                  This summary is generated from SkoolMate records. It is not an official Ministry template, EMIS
                  submission, or confirmation that your school has completed its Ministry reporting. Use the current
                  MoES instructions and verify every figure before submitting through the official channel.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Prepare school summary</CardTitle>
            <div className="flex flex-wrap gap-2 print:hidden">
              {report && (
                <Button
                  variant="secondary"
                  onClick={() => window.print()}
                  icon={<MaterialIcon icon="print" style={{ fontSize: 17 }} />}
                >
                  Print / Save PDF
                </Button>
              )}
              <Button
                onClick={generateReport}
                disabled={loading}
                icon={<MaterialIcon icon="fact_check" style={{ fontSize: 17 }} />}
              >
                {loading ? "Checking records…" : report ? "Refresh summary" : "Check my records"}
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-[var(--t3)]">School</span>
                <p className="font-semibold">{school?.name || "Not set"}</p>
              </div>
              <div>
                <span className="text-[var(--t3)]">School code</span>
                <p className="font-semibold">{school?.school_code || "Not set"}</p>
              </div>
              <div>
                <span className="text-[var(--t3)]">Academic year</span>
                <p className="font-semibold">{academicYear || "Not set"}</p>
              </div>
              <div>
                <span className="text-[var(--t3)]">Term</span>
                <p className="font-semibold">{currentTerm || "Not set"}</p>
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}
          </CardBody>
        </Card>

        {report && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div>
                <h2 className="text-xl font-bold text-[var(--t1)]">Preparation review</h2>
                <p className="text-sm text-[var(--t3)]">Generated {new Date(report.generatedAt).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={exportJson}
                  icon={<MaterialIcon icon="data_object" style={{ fontSize: 17 }} />}
                >
                  Download JSON
                </Button>
                <Button
                  variant="secondary"
                  onClick={exportExcel}
                  disabled={exporting}
                  icon={<MaterialIcon icon="download" style={{ fontSize: 17 }} />}
                >
                  {exporting ? "Preparing…" : "Download Excel summary"}
                </Button>
              </div>
            </div>

            <div className="hidden print:block">
              <h1 className="text-2xl font-bold">SkoolMate School Data Preparation Summary</h1>
              <p>Working summary only - not an official MoES or EMIS submission template.</p>
              <p>
                {report.school.name} · {report.school.district} · {report.academicYear} · Term {report.term}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>School profile checks</CardTitle>
              </CardHeader>
              <CardBody>
                <ul>
                  {profileChecks.map((item) => (
                    <CheckRow
                      key={item.label}
                      label={item.label}
                      complete={Boolean(item.value)}
                      detail={item.value || "Add this to the school profile in SkoolMate."}
                    />
                  ))}
                </ul>
                <p className="mt-3 text-xs text-[var(--t3)]">
                  These checks reflect fields in SkoolMate. They are not a Ministry-defined compliance checklist.
                </p>
              </CardBody>
            </Card>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Active learners", report.students.total],
                ["Male learners", report.students.male],
                ["Female learners", report.students.female],
                ["Active teachers", report.staff.total],
              ].map(([label, value]) => (
                <Card key={String(label)}>
                  <CardBody>
                    <p className="text-2xl font-bold text-[var(--t1)]">{value}</p>
                    <p className="text-sm text-[var(--t3)]">{label}</p>
                  </CardBody>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Record checks</CardTitle>
              </CardHeader>
              <CardBody>
                <ul>
                  <CheckRow
                    label="Learner date of birth"
                    complete={report.students.withoutDateOfBirth === 0}
                    detail={`${report.students.withoutDateOfBirth} of ${report.students.total} active learner records are missing a date of birth.`}
                  />
                  <CheckRow
                    label="Parent contact"
                    complete={report.students.withoutParentContact === 0}
                    detail={`${report.students.withoutParentContact} of ${report.students.total} active learner records are missing a parent phone number.`}
                  />
                  <CheckRow
                    label="Class allocation"
                    complete={report.students.total === report.classes.reduce((sum, cls) => sum + cls.total, 0)}
                    detail={`${report.students.total - report.classes.reduce((sum, cls) => sum + cls.total, 0)} active learner records are not counted in a listed class.`}
                  />
                </ul>
                <p className="mt-3 text-xs text-[var(--t3)]">
                  A missing value here is a prompt to review your records. Required EMIS fields and validation rules
                  must be confirmed with MoES.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Learners by class</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="table-wrapper">
                  <table className="tbl w-full">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Level</th>
                        <th>Male</th>
                        <th>Female</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.classes.map((item) => (
                        <tr key={`${item.level}-${item.name}`}>
                          <td>{item.name}</td>
                          <td>{item.level}</td>
                          <td>{item.male}</td>
                          <td>{item.female}</td>
                          <td className="font-semibold">{item.total}</td>
                        </tr>
                      ))}
                      {report.classes.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-[var(--t3)]">
                            No classes were found for this school.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
            <p className="text-xs text-[var(--t3)] print:mt-4">
              Prepared in SkoolMate on {new Date(report.generatedAt).toLocaleString()}. Review and reconcile this
              summary with the current official Ministry process before use.
            </p>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
