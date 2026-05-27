"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/index";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import {
  mapParentStudentLinks,
  normalizeHomeworkAssignments,
  ParentPortalChild,
  ParentPortalHomeworkAssignment,
  resolveSelectedChild,
} from "@/lib/parent-portal";
import { getDemoChildren, getDemoHomework } from "@/lib/parent-portal-demo";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Not Submitted", color: "bg-amber-50 text-amber-700 border-amber-200" },
  submitted: { label: "Submitted", color: "bg-blue-50 text-blue-700 border-blue-200" },
  graded: { label: "Graded", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  late: { label: "Late", color: "bg-red-50 text-red-700 border-red-200" },
};

function getDueDateStatus(dueDate: string, submission: ParentPortalHomeworkAssignment["submission"]): {
  label: string;
  urgent: boolean;
  overdue: boolean;
} {
  const now = new Date();
  const due = new Date(dueDate + "T23:59:59");
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (submission?.status === "graded" || submission?.status === "submitted") {
    return { label: "Completed", urgent: false, overdue: false };
  }
  if (diffDays < 0) return { label: "Overdue", urgent: true, overdue: true };
  if (diffDays <= 2) return { label: "Due soon", urgent: true, overdue: false };
  return { label: `${diffDays} days left`, urgent: false, overdue: false };
}

export default function ParentHomeworkPage() {
  const { user, isDemo } = useAuth();
  const [children, setChildren] = useState<ParentPortalChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentPortalChild | null>(null);
  const [homework, setHomework] = useState<ParentPortalHomeworkAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchChildren = useCallback(async () => {
    if (isDemo) {
      setChildren(getDemoChildren());
      return;
    }
    const parentId = user?.id;
    if (!parentId) return;
    const { data } = await supabase
      .from("parent_students")
      .select("student:students(id, first_name, last_name, school_id, class_id, class:classes(name))")
      .eq("parent_id", parentId);
    setChildren(mapParentStudentLinks(data || []));
  }, [user?.id, isDemo]);

  useEffect(() => {
    setSelectedChild((current) => resolveSelectedChild(children, current?.id));
  }, [children]);

  const fetchHomework = useCallback(
    async (child: ParentPortalChild | null) => {
      const scopedChild = resolveSelectedChild(children, child?.id);
      if (!scopedChild || !scopedChild.class_id) return;
      setLoading(true);

      if (isDemo) {
        const demoHW = getDemoHomework(scopedChild.id);
        setHomework(demoHW);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("homework")
        .select(
          "id, title, description, subject_id, class_id, due_date, marks, academic_year, term, created_at, subjects(name), classes(name), homework_submissions(status, submitted_at, marks, feedback)",
        )
        .eq("class_id", scopedChild.class_id)
        .order("due_date", { ascending: false });

      const mapped = normalizeHomeworkAssignments(data || []);
      setHomework(mapped);
      setLoading(false);
    },
    [isDemo, children],
  );

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    if (selectedChild) {
      fetchHomework(selectedChild);
    }
  }, [selectedChild, fetchHomework]);

  const subjects = Array.from(new Set(homework.map((h) => h.subject_name)));

  const filtered = homework.filter((h) => {
    if (filterSubject !== "all" && h.subject_name !== filterSubject) return false;
    if (filterStatus !== "all") {
      const status = h.submission?.status || "pending";
      if (status !== filterStatus) return false;
    }
    return true;
  });

  const stats = {
    total: homework.length,
    completed: homework.filter((h) => h.submission?.status === "graded" || h.submission?.status === "submitted").length,
    overdue: homework.filter(
      (h) => !h.submission || h.submission.status === "pending"
        ? new Date(h.due_date + "T23:59:59") < new Date()
        : false,
    ).length,
  };

  return (
    <ParentPortalShell pageTitle="Homework">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader
          title="Homework"
          subtitle="View your child&apos;s assignments, track submissions, and check feedback"
          variant="premium"
        />

        {children.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all border ${
                  selectedChild?.id === child.id
                    ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent shadow-[0_12px_24px_rgba(0,92,230,0.18)]"
                    : "bg-white text-[var(--on-surface-variant)] border-[var(--border)] hover:bg-[var(--surface-container-low)]"
                }`}
              >
                {child.first_name} {child.last_name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardBody className="text-center">
              <p className="text-4xl font-black text-[var(--on-surface)]">{stats.total}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)] mt-1">
                Total
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <p className="text-4xl font-black text-emerald-600">{stats.completed}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)] mt-1">
                Completed
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <p className="text-4xl font-black text-red-600">{stats.overdue}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)] mt-1">
                Overdue
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                Subject:
              </span>
              {["all", ...subjects].map((sub) => (
                <button
                  key={sub}
                  onClick={() => setFilterSubject(sub)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all border ${
                    filterSubject === sub
                      ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent"
                      : "bg-white text-[var(--on-surface-variant)] border-[var(--border)] hover:bg-[var(--surface-container-low)]"
                  }`}
                >
                  {sub === "all" ? "All Subjects" : sub}
                </button>
              ))}
              <span className="ml-4 text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                Status:
              </span>
              {["all", "pending", "submitted", "graded", "late"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all border ${
                    filterStatus === st
                      ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent"
                      : "bg-white text-[var(--on-surface-variant)] border-[var(--border)] hover:bg-[var(--surface-container-low)]"
                  }`}
                >
                  {STATUS_LABELS[st]?.label || st}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 bg-[var(--surface-container)] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-8">
                  <MaterialIcon icon="assignment" className="text-4xl text-[var(--on-surface-variant)] mb-2" />
                  <p className="text-[var(--on-surface-variant)] font-medium">
                    No homework assignments found
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : (
            filtered.map((hw) => {
              const dueInfo = getDueDateStatus(hw.due_date, hw.submission);
              const statusInfo = STATUS_LABELS[hw.submission?.status || "pending"];

              return (
                <Card key={hw.id}>
                  <CardBody>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--surface-container-low)] border border-[var(--border)] text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
                            <MaterialIcon icon="book" className="text-[14px]" />
                            {hw.subject_name}
                          </span>
                          {hw.class_name && (
                            <span className="text-[10px] text-[var(--on-surface-variant)]">
                              {hw.class_name}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-[var(--on-surface)] mt-1">
                          {hw.title}
                        </h3>
                        {hw.description && (
                          <p className="text-sm text-[var(--on-surface-variant)] mt-1 line-clamp-2">
                            {hw.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                            statusInfo?.color || "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          {statusInfo?.label || "Unknown"}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            dueInfo.urgent ? "text-red-600" : "text-[var(--on-surface-variant)]"
                          }`}
                        >
                          {dueInfo.overdue ? "Overdue: " : "Due: "}
                          {new Date(hw.due_date + "T00:00:00").toLocaleDateString("en-UG", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                          <span className="ml-1">({dueInfo.label})</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border)]">
                      <div className="text-[11px] text-[var(--on-surface-variant)]">
                        Marks: <span className="font-bold text-[var(--on-surface)]">{hw.marks}</span>
                      </div>
                      {hw.submission?.marks != null && (
                        <div className="text-[11px] text-[var(--on-surface-variant)]">
                          Score:{" "}
                          <span className="font-bold text-emerald-600">
                            {hw.submission.marks}/{hw.marks}
                          </span>
                        </div>
                      )}
                      {hw.submission?.submitted_at && (
                        <div className="text-[11px] text-[var(--on-surface-variant)]">
                          Submitted:{" "}
                          <span className="font-medium text-[var(--on-surface)]">
                            {new Date(hw.submission.submitted_at).toLocaleDateString("en-UG", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {hw.submission?.feedback && (
                      <div className="mt-3 p-3 rounded-xl bg-[var(--surface-container-low)] border border-[var(--border)]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MaterialIcon icon="feedback" className="text-[14px] text-[var(--primary)]" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
                            Teacher Feedback
                          </span>
                        </div>
                        <p className="text-sm text-[var(--on-surface-variant)] italic">
                          &ldquo;{hw.submission.feedback}&rdquo;
                        </p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </ParentPortalShell>
  );
}
