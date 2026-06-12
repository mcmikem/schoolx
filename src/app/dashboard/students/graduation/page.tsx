"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { useStudents, useClasses } from "@/lib/hooks";
import { Button } from "@/components/ui";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

const FINAL_LEVELS = ["P.7", "S.4", "S.6"];

export default function GraduationPage() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const { students, loading: studentsLoading } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);

  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [showCertificate, setShowCertificate] = useState<any>(null);

  useEffect(() => {
    if (!students.length || !classes.length) return;
    const finalClassIds = classes
      .filter((c) => FINAL_LEVELS.includes(c.level))
      .map((c) => c.id);
    const eligible = students.filter(
      (s) => s.status === "active" && finalClassIds.includes(s.class_id),
    );
    setEligibleStudents(eligible);
  }, [students, classes]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === eligibleStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleStudents.map((s) => s.id)));
    }
  };

  const handleGraduate = async () => {
    if (!selectedIds.size || !school?.id) return;
    setProcessing(true);
    try {
      let userId = "system";
      if (!isDemo) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id || userId;
      }

      let completed = 0;
      for (const studentId of selectedIds) {
        if (isDemo) {
          const student = eligibleStudents.find((s) => s.id === studentId);
          if (student) {
            student.status = "completed";
          }
          completed++;
          continue;
        }

        const { error: updateError } = await supabase
          .from("students")
          .update({ status: "completed" })
          .eq("id", studentId);
        if (updateError) throw updateError;

        await supabase.from("student_promotions").insert({
          school_id: school.id,
          student_id: studentId,
          academic_year: academicYear,
          promoted_by: userId,
          promoted_at: new Date().toISOString(),
          notes: "graduation",
        });
        completed++;
      }

      toast.success(`${completed} student(s) marked as completed`);
      setEligibleStudents((prev) =>
        prev.filter((s) => !selectedIds.has(s.id)),
      );
      setSelectedIds(new Set());
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to process graduation",
      );
    } finally {
      setProcessing(false);
    }
  };

  const generateCertificate = (student: any) => {
    setShowCertificate(student);
  };

  const printCertificate = () => {
    if (!showCertificate) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Certificate of Completion</title>
      <style>
        body { font-family: 'Georgia', serif; margin: 0; padding: 0; background: #faf8f0; }
        .certificate { width: 800px; margin: 40px auto; padding: 60px; background: #fff; border: 8px double #1e3a5f; box-shadow: 0 8px 32px rgba(0,0,0,0.1); text-align: center; }
        .border-inner { border: 2px solid #1e3a5f; padding: 40px; position: relative; }
        h1 { font-size: 14px; letter-spacing: 4px; text-transform: uppercase; color: #1e3a5f; margin: 0 0 8px; }
        .school-name { font-size: 28px; font-weight: 700; color: #1e3a5f; margin: 8px 0; }
        .deco { width: 60%; height: 2px; background: linear-gradient(90deg,transparent,#1e3a5f,transparent); margin: 12px auto; }
        .title { font-size: 22px; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; color: #1e3a5f; margin: 16px 0; }
        .student-name { font-size: 36px; font-weight: 700; color: #000; margin: 16px 0; letter-spacing: 2px; }
        .text { font-size: 16px; line-height: 1.8; color: #333; }
        .details { font-size: 14px; color: #555; margin: 12px 0; }
        .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
        .sig-block { text-align: center; width: 200px; }
        .sig-line { border-top: 2px solid #333; margin-top: 60px; padding-top: 6px; font-size: 13px; font-weight: 600; }
        .stamp { width: 100px; height: 100px; border: 2px solid #1e3a5f; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #1e3a5f; margin: 0 auto; }
        @media print { body { background: #fff; } .certificate { box-shadow: none; border: 8px double #1e3a5f; } }
      </style>
      </head><body>
      <div class="certificate">
        <div class="border-inner">
          <h1>${school?.name || "School Name"}</h1>
          <div class="deco"></div>
          <div class="title">Certificate of Completion</div>
          <div class="deco"></div>
          <p class="text">This is to certify that</p>
          <div class="student-name">${showCertificate.first_name} ${showCertificate.last_name}</div>
          <p class="text">has successfully completed the course of study at</p>
          <p class="school-name">${school?.name || "our school"}</p>
          <p class="text">and is hereby awarded this certificate of completion.</p>
          <div class="details">
            Student Number: ${showCertificate.student_number || "N/A"}<br/>
            Class: ${showCertificate.classes?.name || "N/A"}<br/>
            Date: ${new Date().toLocaleDateString("en-UG", { year: "numeric", month: "long", day: "numeric" })}<br/>
            Academic Year: ${academicYear}
          </div>
          <div class="signatures">
            <div class="sig-block">
              <div class="stamp">School Seal</div>
            </div>
            <div class="sig-block">
              <div class="sig-line">Head Teacher</div>
            </div>
          </div>
        </div>
      </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <PageErrorBoundary>
      <div className="space-y-6 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
        <PageHeader
          title="Graduation / Completion"
          subtitle="Mark students as completed and generate certificates"
          variant="premium"
        />

        <Card>
          <CardHeader>
            <CardTitle>
              Students Eligible for Graduation
              <span className="ml-2 text-sm font-normal text-[var(--t3)]">
                ({eligibleStudents.length} students)
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            {studentsLoading ? (
              <TableSkeleton rows={5} />
            ) : eligibleStudents.length === 0 ? (
              <EmptyState
                icon="school"
                title="No eligible students"
                description="Students must be active and in a final class level (P.7, S.4, or S.6)"
              />
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === eligibleStudents.length &&
                        eligibleStudents.length > 0
                      }
                      onChange={toggleAll}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">
                      Select All ({eligibleStudents.length} students)
                    </span>
                  </label>
                  <span className="text-sm text-[var(--t3)]">
                    {selectedIds.size} selected
                  </span>
                </div>

                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Name</th>
                        <th>Student #</th>
                        <th>Class</th>
                        <th>Gender</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleStudents.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(student.id)}
                              onChange={() => toggleStudent(student.id)}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="font-medium">
                            {student.first_name} {student.last_name}
                          </td>
                          <td className="text-sm font-mono">
                            {student.student_number || "-"}
                          </td>
                          <td>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              {student.classes?.name || "N/A"}
                            </span>
                          </td>
                          <td className="text-sm">
                            {student.gender === "M" ? "Male" : "Female"}
                          </td>
                          <td>
                            <button
                              onClick={() => generateCertificate(student)}
                              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <MaterialIcon icon="print" className="text-sm" />
                              Certificate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end mt-6">
                  <Button
                    onClick={handleGraduate}
                    disabled={processing || selectedIds.size === 0}
                    loading={processing}
                  >
                    <MaterialIcon icon="check_circle" style={{ fontSize: 18 }} />
                    {processing
                      ? "Processing..."
                      : `Mark ${selectedIds.size} as Completed`}
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {showCertificate && (
        <Modal
          isOpen={!!showCertificate}
          onClose={() => setShowCertificate(null)}
          title="Certificate Preview"
          size="lg"
        >
          <div className="p-4 text-center">
            <div className="text-lg font-bold mb-2">
              {showCertificate.first_name} {showCertificate.last_name}
            </div>
            <p className="text-sm text-[var(--t3)] mb-4">
              {showCertificate.classes?.name} ·{" "}
              {showCertificate.student_number || "N/A"}
            </p>
            <Button onClick={printCertificate}>
              <MaterialIcon icon="print" style={{ fontSize: 18 }} />
              Print Certificate
            </Button>
          </div>
        </Modal>
      )}
    </PageErrorBoundary>
  );
}
