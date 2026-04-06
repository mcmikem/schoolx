"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Tabs } from "@/components/ui/Tabs";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

interface Warning {
  student_id: string;
  student_name: string;
  student_number: string;
  class_name: string;
  warning_type: string;
  details: string;
  severity: "low" | "medium" | "high";
}

interface WarningThresholds {
  attendance: number;
  grade: number;
  fee: number;
}

export default function EarlyWarningsPage() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [thresholds, setThresholds] = useState<WarningThresholds>({
    attendance: 80,
    grade: 50,
    fee: 50000,
  });

  const fetchThresholds = useCallback(async () => {
    if (!school?.id) return;
    try {
      const { data } = await supabase
        .from("school_settings")
        .select("key, value")
        .eq("school_id", school.id)
        .in("key", [
          "attendance_threshold",
          "grade_threshold",
          "fee_threshold",
        ]);

      if (data) {
        const map: Record<string, string> = {};
        data.forEach((s: { key: string; value: string }) => {
          map[s.key] = s.value;
        });
        setThresholds({
          attendance: parseInt(map.attendance_threshold) || 80,
          grade: parseInt(map.grade_threshold) || 50,
          fee: parseInt(map.fee_threshold) || 50000,
        });
      }
    } catch (err) {
      console.error("Error:", err);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }, [school?.id]);

  const fetchWarnings = useCallback(async () => {
    if (!school?.id || students.length === 0) {
      setWarnings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const studentIds = students.map((s) => s.id);
    const allWarnings: Warning[] = [];

    // Batch fetch all grades for all students
    const { data: allGrades } = await supabase
      .from("grades")
      .select("*, subjects(name)")
      .in("student_id", studentIds)
      .eq("term", currentTerm)
      .eq("academic_year", academicYear);

    // Batch fetch all attendance
    const { data: allAttendance } = await supabase
      .from("attendance")
      .select("student_id, status")
      .in("student_id", studentIds);

    // Batch fetch all payments
    const { data: allPayments } = await supabase
      .from("fee_payments")
      .select("student_id, amount_paid")
      .in("student_id", studentIds);

    // Process data in memory (fast)
    for (const student of students) {
      // Grades analysis
      const studentGrades =
        allGrades?.filter((g) => g.student_id === student.id) || [];
      if (studentGrades.length > 0) {
        const subjectScores: Record<string, number[]> = {};
        studentGrades.forEach((g) => {
          const subject = g.subjects?.name || "Unknown";
          if (!subjectScores[subject]) subjectScores[subject] = [];
          subjectScores[subject].push(Number(g.score));
        });

        let weakSubjects = 0;
        Object.entries(subjectScores).forEach(([subject, scores]) => {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          if (avg < thresholds.grade) {
            weakSubjects++;
          }
        });

        if (weakSubjects >= 2) {
          allWarnings.push({
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`,
            student_number: student.student_number || "",
            class_name: student.classes?.name || "",
            warning_type: "Academic Performance",
            details: `Below 50% in ${weakSubjects} subjects`,
            severity: weakSubjects >= 3 ? "high" : "medium",
          });
        }
      }

      // Attendance analysis
      const studentAttendance =
        allAttendance?.filter((a) => a.student_id === student.id) || [];
      if (studentAttendance.length > 0) {
        const present = studentAttendance.filter(
          (a) => a.status === "present",
        ).length;
        const rate = (present / studentAttendance.length) * 100;

        if (rate < thresholds.attendance) {
          allWarnings.push({
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`,
            student_number: student.student_number || "",
            class_name: student.classes?.name || "",
            warning_type: "Attendance",
            details: `Attendance rate: ${Math.round(rate)}%`,
            severity: rate < 60 ? "high" : "medium",
          });
        }
      }

      // Fee analysis
      const studentPayments =
        allPayments?.filter((p) => p.student_id === student.id) || [];
      if (studentPayments.length > 0) {
        const totalPaid = studentPayments.reduce(
          (sum, p) => sum + Number(p.amount_paid),
          0,
        );
        if (totalPaid < thresholds.fee) {
          allWarnings.push({
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`,
            student_number: student.student_number || "",
            class_name: student.classes?.name || "",
            warning_type: "Fee Payment",
            details: `Low fee payments: UGX ${totalPaid.toLocaleString()}`,
            severity: totalPaid === 0 ? "high" : "medium",
          });
        }
      }
    }

    setWarnings(allWarnings);
  }, [school?.id, students, currentTerm, academicYear, thresholds]);

  useEffect(() => {
    if (school?.id) fetchThresholds();
  }, [school?.id, fetchThresholds]);

  useEffect(() => {
    if (students.length > 0) fetchWarnings();
  }, [students, fetchWarnings]);

  const sendBulkSMS = async () => {
    if (filteredWarnings.length === 0) return;

    toast.success(`Sending SMS to ${filteredWarnings.length} guardians...`);

    const message = `Dear Parent, Your child ${filteredWarnings[0].student_name} has been flagged for academic concerns. Please contact the school to discuss how we can support your child's progress. - SkulMate OS`;

    try {
      const { data: studentData } = await supabase
        .from("students")
        .select("id, parent_phone, first_name")
        .in(
          "id",
          filteredWarnings.map((w) => w.student_id),
        );

      const phones =
        studentData?.map((s) => s.parent_phone).filter(Boolean) || [];

      if (phones.length === 0) {
        toast.error("No parent phone numbers found");
        return;
      }

      const response = await fetch("/api/sms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones, message, schoolId: school?.id }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(
          `SMS sent to ${result.data?.totalSent || phones.length} parents`,
        );
      } else {
        toast.error("Failed to send SMS");
      }
    } catch (err) {
      toast.error("SMS error");
    }
  };

  const filteredWarnings = warnings.filter((w) => {
    if (filterSeverity === "all") return true;
    return w.severity === filterSeverity;
  });

  const stats = useMemo(
    () => ({
      total: warnings.length,
      high: warnings.filter((w) => w.severity === "high").length,
      medium: warnings.filter((w) => w.severity === "medium").length,
      low: warnings.filter((w) => w.severity === "low").length,
    }),
    [warnings],
  );

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-[var(--red-soft)] text-[var(--red)]";
      case "medium":
        return "bg-[var(--amber-soft)] text-[var(--amber)]";
      default:
        return "bg-[var(--navy-soft)] text-[var(--navy)]";
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Early Warnings"
        subtitle="Students who need attention"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="text-center">
          <CardBody>
            <div className="text-2xl font-bold text-[var(--t1)]">
              {stats.total}
            </div>
            <div className="text-sm text-[var(--t3)] mt-1">Total Warnings</div>
          </CardBody>
        </Card>
        <Card className="text-center">
          <CardBody>
            <div className="text-2xl font-bold text-[var(--red)]">
              {stats.high}
            </div>
            <div className="text-sm text-[var(--t3)] mt-1">High Priority</div>
          </CardBody>
        </Card>
        <Card className="text-center">
          <CardBody>
            <div className="text-2xl font-bold text-[var(--amber)]">
              {stats.medium}
            </div>
            <div className="text-sm text-[var(--t3)] mt-1">Medium</div>
          </CardBody>
        </Card>
        <Card className="text-center">
          <CardBody>
            <div className="text-2xl font-bold text-[var(--t1)]">
              {stats.low}
            </div>
            <div className="text-sm text-[var(--t3)] mt-1">Low</div>
          </CardBody>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: "all", label: "All", count: warnings.length },
          { id: "high", label: "High", count: stats.high },
          { id: "medium", label: "Medium", count: stats.medium },
          { id: "low", label: "Low", count: stats.low },
        ]}
        activeTab={filterSeverity}
        onChange={setFilterSeverity}
        className="mb-6"
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <Button
          onClick={fetchWarnings}
          variant="secondary"
          icon={<MaterialIcon icon="refresh" className="text-lg" />}
        >
          Refresh
        </Button>
        {filteredWarnings.length > 0 && (
          <Button
            onClick={() => sendBulkSMS()}
            icon={<MaterialIcon icon="sms" className="text-lg" />}
          >
            SMS Guardians ({filteredWarnings.length})
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <CardBody className="p-0">
            <TableSkeleton rows={3} />
          </CardBody>
        </Card>
      ) : filteredWarnings.length === 0 ? (
        <EmptyState
          icon="check_circle"
          title="No warnings"
          description="All students are performing well"
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--surface-container-low)]">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--t1)]">
                      Student
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--t1)]">
                      Class
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--t1)]">
                      Warning Type
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--t1)]">
                      Details
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-[var(--t1)]">
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWarnings.map((warning, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="p-4">
                        <div className="font-medium text-[var(--t1)]">
                          {warning.student_name}
                        </div>
                        <div className="text-xs text-[var(--t3)]">
                          {warning.student_number}
                        </div>
                      </td>
                      <td className="p-4 text-[var(--t1)]">
                        {warning.class_name}
                      </td>
                      <td className="p-4 text-[var(--t1)]">
                        {warning.warning_type}
                      </td>
                      <td className="p-4 text-[var(--t3)]">
                        {warning.details}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-medium ${getSeverityBadge(warning.severity)}`}
                        >
                          {warning.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
