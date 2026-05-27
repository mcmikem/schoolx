"use client";

import { useCallback, useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useToast } from "@/components/Toast";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/index";
import { useAuth } from "@/lib/auth-context";
import {
  evaluateDataQuality,
  type DataQualityIssue,
  type DataQualityReport,
} from "@/lib/data-quality-rules";
import { withTimeout } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

const EMPTY_REPORT: DataQualityReport = {
  issues: [],
  checkedStudents: 0,
  checkedUsers: 0,
  criticalCount: 0,
  warningCount: 0,
};

export default function DataQualityPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<DataQualityReport>(EMPTY_REPORT);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const studentsQuery = supabase
        .from("students")
        .select("id, admission_number, parent_phone, parent_phone2, parent_name");

      const usersQuery = supabase
        .from("users")
        .select("id, full_name, email, phone, role, status");

      const schoolId = school?.id;
      const scopedStudentsQuery = schoolId ? studentsQuery.eq("school_id", schoolId) : studentsQuery;
      const scopedUsersQuery = schoolId ? usersQuery.eq("school_id", schoolId) : usersQuery;

      const [studentsResult, usersResult] = await Promise.all([
        withTimeout(scopedStudentsQuery, 12000, { data: [] } as any),
        withTimeout(scopedUsersQuery, 12000, { data: [] } as any),
      ]);

      const students = Array.isArray(studentsResult?.data) ? studentsResult.data : [];
      const users = Array.isArray(usersResult?.data) ? usersResult.data : [];

      setReport(evaluateDataQuality({ students, users }));
    } catch (error) {
      logger.error("Failed to run data quality checks:", error);
      toast.error("Failed to load data quality report");
      setReport(EMPTY_REPORT);
    } finally {
      setLoading(false);
    }
  }, [school?.id, toast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const badgeClasses = (issue: DataQualityIssue) =>
    issue.severity === "critical"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";

  return (
    <PageErrorBoundary>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Data Quality"
          subtitle="Catch missing and duplicate records before they affect reports, fees, and communication."
          actions={
            <Button onClick={loadReport} loading={loading} icon={<MaterialIcon icon="refresh" />}>
              Re-run checks
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-wide text-[var(--t3)]">Checked Students</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--t1)]">{report.checkedStudents}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-wide text-[var(--t3)]">Checked Users</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--t1)]">{report.checkedUsers}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-wide text-[var(--t3)]">Critical Issues</p>
              <p className="mt-1 text-2xl font-semibold text-rose-700">{report.criticalCount}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-wide text-[var(--t3)]">Warnings</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{report.warningCount}</p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            {loading ? (
              <div className="py-10 text-center text-[var(--t3)]">Running quality checks...</div>
            ) : report.issues.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                No issues detected. Core student and staff records look healthy.
              </div>
            ) : (
              <div className="space-y-3">
                {report.issues.map((issue) => (
                  <div
                    key={issue.code}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[var(--t1)]">{issue.message}</p>
                        <p className="text-xs text-[var(--t3)]">
                          {issue.area === "students" ? "Student records" : "Staff records"}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(issue)}`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--t2)]">Affected records: {issue.count}</p>
                    <p className="mt-1 text-xs text-[var(--t3)] break-all">
                      Sample IDs: {issue.sampleIds.join(", ") || "-"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </PageErrorBoundary>
  );
}
