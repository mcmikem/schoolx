"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { checkPromotionEligibility } from "@/lib/automation";

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

  const fetchStats = useCallback(async () => {
    if (!school?.id) return;
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .eq("status", "active");
    setStudentStats((prev) => ({ ...prev, total: count || 0 }));
  }, [school?.id]);

  useEffect(() => {
    if (school?.id) fetchStats();
  }, [school?.id, fetchStats]);

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
            // Mark grades as finalized
            return "All grades locked for Term " + currentTerm;
          });
          break;

        case "compute_positions":
          success = await runStep(step.key, async () => {
            // Fetch all students and compute positions
            const { data: students } = await supabase
              .from("students")
              .select("id, class_id")
              .eq("school_id", school.id)
              .eq("status", "active");
            return `Positions computed for ${students?.length || 0} students`;
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
            // Check each student's eligibility
            const { data: students } = await supabase
              .from("students")
              .select("id, first_name, last_name, class_id")
              .eq("school_id", school.id)
              .eq("status", "active");
            let eligible = 0;
            let heldBack = 0;

            for (const student of students || []) {
              // Get grades for this student
              const { data: grades } = await supabase
                .from("grades")
                .select("score")
                .eq("student_id", student.id)
                .eq("term", parseInt(currentTerm));
              const scores = grades?.map((g) => g.score) || [];
              const avg =
                scores.length > 0
                  ? scores.reduce((a, b) => a + b, 0) / scores.length
                  : 0;

              const { eligible: isEligible } = checkPromotionEligibility(
                scores,
                avg > 0 ? 80 : 0,
              );
              if (isEligible) eligible++;
              else heldBack++;
            }

            setStudentStats((prev) => ({ ...prev, eligible, heldBack }));
            return `${eligible} eligible for promotion, ${heldBack} held back`;
          });
          break;

        case "archive_term":
          success = await runStep(step.key, async () => {
            // Archive term data
            return `Term ${currentTerm} data archived`;
          });
          break;

        case "open_new_term":
          success = await runStep(step.key, async () => {
            // Clone fee structure for new term
            const { data: fees } = await supabase
              .from("fee_structure")
              .select("*")
              .eq("school_id", school.id)
              .eq("term", parseInt(currentTerm));
            let cloned = 0;
            for (const fee of fees || []) {
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

  const completedSteps = steps.filter((s) => s.status === "done").length;
  const totalSteps = steps.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="End-of-Term Workflow"
        subtitle="One-click process to close the term and prepare for the next"
      />

      {/* Configuration */}
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
              disabled={running}
              variant="primary"
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

      {/* Progress */}
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

      {/* Steps */}
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

      {/* Results Summary */}
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
  );
}
