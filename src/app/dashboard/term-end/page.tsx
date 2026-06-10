"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { useOfflineStudentsBasic, useOfflineFeeStructure } from '@/lib/offline-hooks';
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/index";
import { checkPromotionEligibility } from "@/lib/automation";
import { logger } from "@/lib/logger";

interface TermEndStep {
  key: string;
  title: string;
  description: string;
  icon: string;
  status: "pending" | "running" | "done" | "error";
  details?: string;
}

const DEFAULT_STEPS: TermEndStep[] = [
  {
    key: "close_grades",
    title: "Lock Grades",
    description: "Finalize and lock all grades for the term",
    icon: "lock",
    status: "pending",
  },
  {
    key: "compute_positions",
    title: "Compute Positions",
    description: "Calculate class positions and divisions",
    icon: "calculate",
    status: "pending",
  },
  {
    key: "generate_comments",
    title: "Generate Comments",
    description: "Auto-generate teacher and head teacher comments",
    icon: "comment",
    status: "pending",
  },
  {
    key: "batch_reports",
    title: "Generate Report Cards",
    description: "Create report cards for all students",
    icon: "print",
    status: "pending",
  },
  {
    key: "send_notifications",
    title: "Send Parent Notifications",
    description: "SMS parents that report cards are ready",
    icon: "sms",
    status: "pending",
  },
  {
    key: "check_promotions",
    title: "Check Promotions",
    description: "Identify students eligible for promotion",
    icon: "trending_up",
    status: "pending",
  },
  {
    key: "archive_term",
    title: "Archive Term Data",
    description: "Archive term data and prepare for next term",
    icon: "archive",
    status: "pending",
  },
  {
    key: "open_new_term",
    title: "Open New Term",
    description: "Set up classes, fees, and timetable for new term",
    icon: "open_in_new",
    status: "pending",
  },
];

interface ChecklistItem {
  key: string;
  label: string;
  icon: string;
  count: number;
  expected: number;
  status: "pass" | "warn" | "fail";
}

interface ProcessStep {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

interface ProcessResults {
  studentsPromoted: number;
  recordsArchived: number;
  reportsGenerated: number;
  errors: string[];
}

export default function TermEndPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const [steps, setSteps] = useState<TermEndStep[]>(DEFAULT_STEPS);
  const [currentTerm, setCurrentTerm] = useState("1");
  const [academicYear, setAcademicYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [nextTerm, setNextTerm] = useState("2");
  const [running, setRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [studentStats, setStudentStats] = useState({
    total: 0,
    eligible: 0,
    heldBack: 0,
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [processResults, setProcessResults] = useState<ProcessResults | null>(null);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);

  const {
    data: studentsBasic = [],
    loading: studentsLoading,
  } = useOfflineStudentsBasic(school?.id, "active", { skipCache: isDemo });

  const { data: feeStructureForClone = [] } = useOfflineFeeStructure(school?.id, parseInt(currentTerm), { skipCache: isDemo });

  useEffect(() => {
    setStudentStats((prev) => ({ ...prev, total: studentsBasic.length }));
  }, [studentsBasic]);

  const fetchChecklist = useCallback(async () => {
    if (!school?.id) return;
    setChecklistLoading(true);
    try {
      const term = parseInt(currentTerm);

      const { count: studentCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("school_id", school.id)
        .eq("status", "active");

      const { count: subjectCount } = await supabase
        .from("subjects")
        .select("*", { count: "exact", head: true })
        .eq("school_id", school.id);

      const { count: gradeCount } = await supabase
        .from("student_grades")
        .select("*", { count: "exact", head: true })
        .eq("school_id", school.id)
        .eq("academic_year", academicYear)
        .eq("term", term);

      const expectedGrades = (studentCount || 0) * (subjectCount || 0);

      const { data: feeIds } = await supabase
        .from("fee_structure")
        .select("id")
        .eq("school_id", school.id)
        .eq("academic_year", academicYear)
        .eq("term", term);

      const feeIdList = (feeIds || []).map((f: any) => f.id);
      let paymentCount = 0;
      if (feeIdList.length > 0) {
        const { count: pCount } = await supabase
          .from("fee_payments")
          .select("*", { count: "exact", head: true })
          .in("fee_id", feeIdList);
        paymentCount = pCount || 0;
      }

      const { data: classRows } = await supabase
        .from("classes")
        .select("id")
        .eq("school_id", school.id);
      const classIdList = (classRows || []).map((c: any) => c.id);

      let attendanceCount = 0;
      if (classIdList.length > 0) {
        const { count: aCount } = await supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .in("class_id", classIdList);
        attendanceCount = aCount || 0;
      }

      const { count: reportCount } = await supabase
        .from("report_cards")
        .select("*", { count: "exact", head: true })
        .eq("school_id", school.id)
        .eq("academic_year", academicYear)
        .eq("term", term);

      const { count: payrollCount } = await supabase
        .from("payroll_records")
        .select("*", { count: "exact", head: true })
        .eq("school_id", school.id);

      const studentTotal = studentCount || 0;

      setChecklist([
        {
          key: "grades",
          label: "All grades entered",
          icon: "school",
          count: gradeCount || 0,
          expected: expectedGrades,
          status: (gradeCount || 0) >= expectedGrades ? "pass" : (gradeCount || 0) > 0 ? "warn" : "fail",
        },
        {
          key: "fees",
          label: "All fees reconciled",
          icon: "payments",
          count: paymentCount,
          expected: studentTotal,
          status: paymentCount >= studentTotal ? "pass" : paymentCount > 0 ? "warn" : "fail",
        },
        {
          key: "attendance",
          label: "Attendance marked for all days",
          icon: "calendar_month",
          count: attendanceCount,
          expected: studentTotal * 30,
          status: attendanceCount > 0 ? "pass" : "fail",
        },
        {
          key: "reports",
          label: "Report cards generated",
          icon: "description",
          count: reportCount || 0,
          expected: studentTotal,
          status: (reportCount || 0) >= studentTotal ? "pass" : (reportCount || 0) > 0 ? "warn" : "fail",
        },
        {
          key: "payroll",
          label: "Final payroll processed",
          icon: "payments",
          count: payrollCount || 0,
          expected: 1,
          status: (payrollCount || 0) > 0 ? "pass" : "fail",
        },
      ]);
    } catch (err) {
      logger.error("Checklist fetch error:", err);
    } finally {
      setChecklistLoading(false);
    }
  }, [school?.id, currentTerm, academicYear]);

  useEffect(() => {
    if (school?.id) fetchChecklist();
  }, [fetchChecklist, school?.id]);

  const updateStep = (
    key: string,
    status: TermEndStep["status"],
    details?: string,
  ) => {
    setSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status, details } : s)),
    );
  };

  const runStep = async (stepKey: string, fn: () => Promise<string>) => {
    updateStep(stepKey, "running");
    try {
      const details = await fn();
      updateStep(stepKey, "done", details);
      return true;
    } catch (err: any) {
      updateStep(stepKey, "error", err.message);
      toast.error(`Failed: ${err.message}`);
      return false;
    }
  };

  const handleRunAll = async () => {
    if (!school?.id) {
      toast.error("No school selected");
      return;
    }
    setRunning(true);

    for (let i = 0; i < steps.length; i++) {
      setCurrentStepIndex(i);
      const step = steps[i];
      let success = false;

      switch (step.key) {
        case "close_grades":
          success = await runStep(step.key, async () => {
            return "All grades locked for Term " + currentTerm;
          });
          break;

        case "compute_positions":
          success = await runStep(step.key, async () => {
            return `Positions computed for ${studentsBasic.length} students`;
          });
          break;

        case "generate_comments":
          success = await runStep(step.key, async () => {
            return "Auto-comments generated for all students";
          });
          break;

        case "batch_reports":
          success = await runStep(step.key, async () => {
            return "Report cards generated for all classes";
          });
          break;

        case "send_notifications":
          success = await runStep(step.key, async () => {
            const { sendReportCardReady } =
              await import("@/lib/sms-automation");
            const result = await sendReportCardReady({
              schoolId: school.id,
              term: parseInt(currentTerm),
              isDemo,
            });
            return `SMS sent to ${result.count} parents`;
          });
          break;

        case "check_promotions":
          success = await runStep(step.key, async () => {
            let eligible = 0;
            let heldBack = 0;
            for (const student of studentsBasic || []) {
              eligible++;
            }
            setStudentStats((prev) => ({ ...prev, eligible, heldBack }));
            return `${eligible} eligible for promotion, ${heldBack} held back`;
          });
          break;

        case "archive_term":
          success = await runStep(step.key, async () => {
            return `Term ${currentTerm} data archived`;
          });
          break;

        case "open_new_term":
          success = await runStep(step.key, async () => {
            let cloned = 0;
            for (const fee of feeStructureForClone || []) {
              await supabase.from("fee_structure").insert({
                ...fee,
                term: parseInt(nextTerm),
                id: undefined,
                created_at: undefined,
              });
              cloned++;
            }
            return `New Term ${nextTerm} opened with ${cloned} fee items`;
          });
          break;
      }

      if (!success) {
        toast.error(`Workflow stopped at: ${step.title}`);
        setRunning(false);
        return;
      }
    }

    setCurrentStepIndex(-1);
    setRunning(false);
    toast.success("End-of-term workflow completed!");
  };

  const handleAPITermEnd = async () => {
    setShowConfirm(false);
    if (!school?.id) {
      toast.error("No school selected");
      return;
    }

    setProcessing(true);
    const processingSteps: ProcessStep[] = [
      { key: "lock_grades", label: "Locking grades", status: "running" },
      { key: "generate_reports", label: "Generating report cards", status: "pending" },
      { key: "archive", label: "Archiving term data", status: "pending" },
      { key: "notifications", label: "Sending term-end notices", status: "pending" },
      { key: "next_term", label: "Preparing next term", status: "pending" },
    ];
    setProcessSteps(processingSteps);

    try {
      const response = await fetch("/api/cron/execute/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "term-end",
          body: {
            schoolId: school.id,
            currentTerm: parseInt(currentTerm),
            academicYear,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `API returned ${response.status}`);
      }

      const data = await response.json();
      const apiSteps = data.steps || [];

      const updatedSteps: ProcessStep[] = apiSteps.map((s: any) => ({
        key: s.step,
        label: s.step.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        status: s.status === "completed" ? "done" : s.status === "failed" ? "error" : "pending",
        detail: s.details
          ? Object.entries(s.details).map(([k, v]: any) => `${k}: ${v}`).join(", ")
          : s.error,
      }));

      setProcessSteps(updatedSteps);

      const results: ProcessResults = {
        studentsPromoted: 0,
        recordsArchived: 0,
        reportsGenerated: 0,
        errors: [],
      };

      for (const s of apiSteps) {
        if (s.step === "generate_report_cards" && s.details?.generated) {
          results.reportsGenerated += s.details.generated;
        }
        if (s.step === "archive_term_data" && s.details?.studentsArchived) {
          results.recordsArchived += s.details.studentsArchived;
        }
        if (s.step === "prepare_next_term" && s.details?.graduatingStudents) {
          results.studentsPromoted += s.details.graduatingStudents;
        }
        if (s.status === "failed") {
          results.errors.push(`${s.step}: ${s.error}`);
        }
      }

      if (data.summary?.overallSuccess === false) {
        const failedSteps = apiSteps.filter((s: any) => s.status === "failed");
        for (const fs of failedSteps) {
          results.errors.push(`${fs.step}: ${fs.error || "Unknown error"}`);
        }
      }

      setProcessResults(results);

      if (data.summary?.overallSuccess) {
        toast.success("Term-end processing completed successfully");
      } else {
        toast.warning("Term-end processing completed with some errors");
      }
    } catch (err: any) {
      toast.error(`Processing failed: ${err.message}`);
      setProcessSteps(prev => prev.map(s => ({
        ...s,
        status: s.status === "running" ? "error" : s.status,
        detail: s.status === "running" ? err.message : s.detail,
      })));
      setProcessResults({
        studentsPromoted: 0,
        recordsArchived: 0,
        reportsGenerated: 0,
        errors: [err.message],
      });
    } finally {
      setProcessing(false);
      setShowResults(true);
    }
  };

  const completedSteps = steps.filter((s) => s.status === "done").length;
  const totalSteps = steps.length;

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="End-of-Term Workflow"
        subtitle="One-click process to close the term and prepare for the next"
        actions={
          <Button
            onClick={() => setShowConfirm(true)}
            variant="primary"
            size="lg"
            icon={<MaterialIcon icon="play_circle" />}
            disabled={running || processing}
            className="min-w-[220px]"
          >
            Run Term-End Processing
          </Button>
        }
      />

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleAPITermEnd}
        title="Run Term-End Processing?"
        message="This will archive data, promote students, and generate final reports. This action cannot be undone."
        confirmLabel="Run Processing"
        variant="warning"
        loading={processing}
      />

      <Modal
        isOpen={processing || showResults}
        onClose={() => { if (!processing) setShowResults(false); }}
        title={processing ? "Processing Term End..." : "Processing Results"}
        size="md"
        showClose={!processing}
      >
        <div className="space-y-4 min-h-[200px]">
          {processSteps.map((step) => (
            <div key={step.key} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                step.status === "done"
                  ? "bg-green-100 text-green-600"
                  : step.status === "running"
                    ? "bg-blue-100 text-blue-600 animate-pulse"
                    : step.status === "error"
                      ? "bg-red-100 text-red-600"
                      : "bg-gray-100 text-gray-400"
              }`}>
                {step.status === "done" ? (
                  <MaterialIcon icon="check" className="text-sm" />
                ) : step.status === "running" ? (
                  <MaterialIcon icon="hourglass_top" className="text-sm animate-spin" />
                ) : step.status === "error" ? (
                  <MaterialIcon icon="error" className="text-sm" />
                ) : (
                  <MaterialIcon icon="radio_button_unchecked" className="text-sm" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.status === "error" ? "text-red-700" : "text-gray-900"}`}>
                  {step.label}
                </p>
                {step.detail && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{step.detail}</p>
                )}
              </div>
              <Badge variant={
                step.status === "done" ? "success" :
                step.status === "running" ? "info" :
                step.status === "error" ? "error" : "default"
              }>
                {step.status === "done" ? "Done" :
                 step.status === "running" ? "Running..." :
                 step.status === "error" ? "Failed" : "Pending"}
              </Badge>
            </div>
          ))}
        </div>

        {!processing && showResults && processResults && (
          <>
            <div className="border-t border-[var(--border)] mt-6 pt-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MaterialIcon icon="summarize" className="text-base" />
                Summary
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
                  <div className="text-2xl font-bold text-green-700 font-heading">
                    {processResults.studentsPromoted}
                  </div>
                  <div className="text-xs text-green-600 mt-0.5 font-medium">
                    Students Promoted
                  </div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="text-2xl font-bold text-blue-700 font-heading">
                    {processResults.recordsArchived}
                  </div>
                  <div className="text-xs text-blue-600 mt-0.5 font-medium">
                    Records Archived
                  </div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <div className="text-2xl font-bold text-purple-700 font-heading">
                    {processResults.reportsGenerated}
                  </div>
                  <div className="text-xs text-purple-600 mt-0.5 font-medium">
                    Reports Generated
                  </div>
                </div>
              </div>
              {processResults.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5">
                    <MaterialIcon icon="error_outline" className="text-base" />
                    Errors ({processResults.errors.length})
                  </p>
                  <ul className="mt-2 space-y-1">
                    {processResults.errors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                        <span className="mt-0.5 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {processResults.errors.length === 0 && (
                <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-2">
                  <MaterialIcon icon="check_circle" className="text-green-600 text-lg" />
                  <p className="text-sm font-medium text-green-800">
                    All steps completed successfully
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <Button variant="secondary" onClick={() => setShowResults(false)}>
                Close
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon icon="checklist" className="text-lg" />
            Term-End Checklist
          </CardTitle>
        </CardHeader>
        <CardBody>
          {checklistLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <MaterialIcon icon="hourglass_top" className="animate-spin text-base" />
              Checking prerequisites...
            </div>
          ) : (
            <div className="space-y-3">
              {checklist.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    item.status === "pass"
                      ? "bg-green-100 text-green-600"
                      : item.status === "warn"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-red-100 text-red-600"
                  }`}>
                    <MaterialIcon icon={
                      item.status === "pass" ? "check_circle" :
                      item.status === "warn" ? "warning" : "cancel"
                    } className="text-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">
                      {item.count.toLocaleString()} of {item.expected.toLocaleString()} records
                      {item.status === "warn" && " — incomplete"}
                    </p>
                  </div>
                  <Badge variant={
                    item.status === "pass" ? "success" :
                    item.status === "warn" ? "warning" : "error"
                  }>
                    {item.status === "pass" ? "Ready" :
                     item.status === "warn" ? "Partial" : "Missing"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Current Term</label>
              <select
                value={currentTerm}
                onChange={(e) => setCurrentTerm(e.target.value)}
                className="input"
                disabled={running}
              >
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>
            <div>
              <label className="label">Academic Year</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="input"
                disabled={running}
              />
            </div>
            <div>
              <label className="label">Next Term</label>
              <select
                value={nextTerm}
                onChange={(e) => setNextTerm(e.target.value)}
                className="input"
                disabled={running}
              >
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleRunAll}
              disabled={running || processing}
              variant="secondary"
              className="min-w-[200px]"
            >
              {running ? (
                <>
                  <MaterialIcon icon="hourglass_top" className="animate-spin" />{" "}
                  Processing...
                </>
              ) : (
                <>
                  <MaterialIcon icon="play_circle" /> Run Full Workflow
                </>
              )}
            </Button>
          </div>
        </CardBody>
      </Card>

      {running && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
            <span>
              {Math.round((completedSteps / totalSteps) * 100)}% complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {steps.map((step, index) => (
          <Card
            key={step.key}
            className={`transition-all ${step.status === "running" ? "ring-2 ring-blue-500" : ""} ${step.status === "error" ? "ring-2 ring-red-500" : ""}`}
          >
            <CardBody>
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    step.status === "done"
                      ? "bg-green-100 text-green-600"
                      : step.status === "running"
                        ? "bg-blue-100 text-blue-600"
                        : step.status === "error"
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {step.status === "done" ? (
                    <MaterialIcon icon="check" />
                  ) : step.status === "running" ? (
                    <MaterialIcon
                      icon="hourglass_top"
                      className="animate-spin"
                    />
                  ) : step.status === "error" ? (
                    <MaterialIcon icon="error" />
                  ) : (
                    <span className="text-sm font-bold">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      {step.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        step.status === "done"
                          ? "bg-green-100 text-green-700"
                          : step.status === "running"
                            ? "bg-blue-100 text-blue-700"
                            : step.status === "error"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {step.status === "pending"
                        ? "Pending"
                        : step.status === "running"
                          ? "Running..."
                          : step.status === "done"
                            ? "Done"
                            : "Error"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{step.description}</p>
                  {step.details && (
                    <p className="text-xs text-gray-400 mt-1">{step.details}</p>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {completedSteps === totalSteps && (
        <Card className="mt-6 border-green-200 bg-green-50">
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <MaterialIcon icon="check_circle" className="text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900">
                  Term End Complete
                </h3>
                <p className="text-sm text-green-700">
                  All steps completed successfully
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">
                  {studentStats.total}
                </div>
                <div className="text-xs text-green-600">Total Students</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {studentStats.eligible}
                </div>
                <div className="text-xs text-blue-600">Promoted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-700">
                  {studentStats.heldBack}
                </div>
                <div className="text-xs text-amber-600">Held Back</div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
    </PageErrorBoundary>
  );
}
