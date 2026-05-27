"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";

interface StudentTimelineProps {
  studentId: string;
  schoolId: string;
}

type EventType =
  | "attendance"
  | "grade"
  | "exam"
  | "health"
  | "behavior"
  | "fee"
  | "comment"
  | "promotion";

interface TimelineEvent {
  id: string;
  type: EventType;
  date: string;
  title: string;
  description: string;
}

const EVENT_META: Record<
  EventType,
  { icon: string; label: string; color: string; border: string }
> = {
  attendance: {
    icon: "fact_check",
    label: "Attendance",
    color: "text-emerald-600",
    border: "#10b981",
  },
  grade: {
    icon: "school",
    label: "Grade",
    color: "text-blue-600",
    border: "#3b82f6",
  },
  exam: {
    icon: "school",
    label: "Exam Score",
    color: "text-indigo-600",
    border: "#6366f1",
  },
  health: {
    icon: "local_hospital",
    label: "Health Visit",
    color: "text-rose-600",
    border: "#f43f5e",
  },
  behavior: {
    icon: "warning",
    label: "Behavior",
    color: "text-amber-600",
    border: "#f59e0b",
  },
  fee: {
    icon: "payments",
    label: "Payment",
    color: "text-violet-600",
    border: "#8b5cf6",
  },
  comment: {
    icon: "chat",
    label: "Comment",
    color: "text-cyan-600",
    border: "#06b6d4",
  },
  promotion: {
    icon: "trending_up",
    label: "Promotion",
    color: "text-indigo-600",
    border: "#6366f1",
  },
};

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getDateKey(dateStr: string): string {
  return new Date(dateStr).toDateString();
}

export default function StudentTimeline({
  studentId,
  schoolId,
}: StudentTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const ms = 15000;

      const [
        att,
        gr,
        exam,
        health,
        beh,
        fee,
        cmt,
        promo,
      ] = await Promise.all([
        withTimeout(
          supabase
            .from("attendance")
            .select("id, date, status, remarks")
            .eq("student_id", studentId),
          ms,
          { data: [], error: null } as any,
        ),
        withTimeout(
          supabase
            .from("grades")
            .select(
              "id, created_at, score, max_score, assessment_type, subject:subject_id(name)",
            )
            .eq("student_id", studentId),
          ms,
          { data: [], error: null } as any,
        ),
        withTimeout(
          supabase
            .from("exam_scores")
            .select(
              "id, created_at, score, max_score, exam_type, subject:subject_id(name)",
            )
            .eq("student_id", studentId),
          ms,
          { data: [], error: null } as any,
        ),
        withTimeout(
          supabase
            .from("health_visits")
            .select("id, created_at, complaint, diagnosis")
            .eq("student_id", studentId),
          ms,
          { data: [], error: null } as any,
        ),
        withTimeout(
          supabase
            .from("behavior_logs")
            .select("id, created_at, incident_type, description, category")
            .eq("student_id", studentId),
          ms,
          { data: [], error: null } as any,
        ),
        withTimeout(
          supabase
            .from("fee_payments")
            .select("id, payment_date, amount_paid, payment_method, payment_reference")
            .eq("student_id", studentId),
          ms,
          { data: [], error: null } as any,
        ),
        withTimeout(
          supabase
            .from("activity_comments")
            .select("id, created_at, content, author_name, comment_type")
            .eq("entity_type", "student")
            .eq("entity_id", studentId),
          ms,
          { data: [], error: null } as any,
        ),
        withTimeout(
          supabase
            .from("promotion_history")
            .select("id, created_at, from_class, to_class, promotion_type")
            .eq("student_id", studentId),
          ms,
          { data: [], error: null } as any,
        ),
      ]);

      const all: TimelineEvent[] = [];

      for (const r of att.data ?? []) {
        const s: Record<string, string> = {
          present: "Present",
          absent: "Absent",
          late: "Late",
          excused: "Excused",
        };
        const label = s[r.status] || r.status;
        all.push({
          id: `att-${r.id}`,
          type: "attendance",
          date: r.date || r.created_at,
          title: label,
          description: r.remarks || "",
        });
      }

      for (const r of gr.data ?? []) {
        const sub = (r.subject as any)?.name || "Subject";
        const pct = r.max_score
          ? Math.round((r.score / r.max_score) * 100)
          : r.score;
        all.push({
          id: `gr-${r.id}`,
          type: "grade",
          date: r.created_at,
          title: `${sub}: ${pct}%`,
          description: `${(r.assessment_type || "").toUpperCase()} — ${r.score}/${r.max_score}`,
        });
      }

      for (const r of exam.data ?? []) {
        const sub = (r.subject as any)?.name || "Subject";
        const pct = r.max_score
          ? Math.round((r.score / r.max_score) * 100)
          : r.score;
        all.push({
          id: `exam-${r.id}`,
          type: "exam",
          date: r.created_at,
          title: `${sub}: ${pct}%`,
          description: `${r.exam_type || "Exam"} — ${r.score}/${r.max_score}`,
        });
      }

      for (const r of health.data ?? []) {
        all.push({
          id: `h-${r.id}`,
          type: "health",
          date: r.created_at,
          title: r.complaint || "Health Visit",
          description: r.diagnosis || "",
        });
      }

      for (const r of beh.data ?? []) {
        all.push({
          id: `beh-${r.id}`,
          type: "behavior",
          date: r.created_at,
          title: r.category || r.incident_type || "Incident",
          description: r.description || "",
        });
      }

      for (const r of fee.data ?? []) {
        all.push({
          id: `fee-${r.id}`,
          type: "fee",
          date: r.payment_date || r.created_at,
          title: `UGX ${Number(r.amount_paid).toLocaleString()}`,
          description:
            r.payment_reference
              ? `Ref: ${r.payment_reference} · ${r.payment_method || ""}`
              : r.payment_method || "Payment recorded",
        });
      }

      for (const r of cmt.data ?? []) {
        all.push({
          id: `cmt-${r.id}`,
          type: "comment",
          date: r.created_at,
          title: r.author_name || "Comment",
          description: r.content || "",
        });
      }

      for (const r of promo.data ?? []) {
        all.push({
          id: `promo-${r.id}`,
          type: "promotion",
          date: r.created_at,
          title: r.promotion_type || "Promotion",
          description: `${r.from_class || "?"} → ${r.to_class || "?"}`,
        });
      }

      all.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setEvents(all);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load timeline",
      );
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) fetchTimeline();
  }, [fetchTimeline, studentId]);

  const grouped = events.reduce<Record<string, TimelineEvent[]>>(
    (acc, ev) => {
      const key = getDateKey(ev.date);
      if (!acc[key]) acc[key] = [];
      acc[key].push(ev);
      return acc;
    },
    {},
  );

  const dateKeys = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse" role="status" aria-label="Loading timeline">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-2xl border border-[var(--border)] bg-[var(--bg)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--red-soft)] flex items-center justify-center mb-4">
          <MaterialIcon
            icon="error_outline"
            className="text-2xl text-[var(--red)]"
          />
        </div>
        <p className="text-sm font-semibold text-[var(--t1)] mb-1">
          Failed to load timeline
        </p>
        <p className="text-xs text-[var(--t3)] mb-4">{error}</p>
        <button
          onClick={fetchTimeline}
          className="btn btn-primary text-xs px-5 py-2"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--bg)] flex items-center justify-center mb-4">
          <MaterialIcon icon="timeline" className="text-2xl text-[var(--t3)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--t1)]">
          No timeline events
        </p>
        <p className="text-xs text-[var(--t3)] mt-1 max-w-xs">
          Events like attendance, grades, payments, and health visits will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="relative" role="feed" aria-label="Student timeline">
      <div className="absolute left-[18px] top-0 bottom-0 w-px bg-[var(--border)] pointer-events-none" />

      {dateKeys.map((dk) => {
        const dayEvents = grouped[dk];
        return (
          <div key={dk} className="mb-5 last:mb-0">
            <div className="sticky top-0 z-10 py-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--t3)] bg-[var(--bg)]/80 backdrop-blur-sm px-0">
                {getDateLabel(dayEvents[0].date)}
              </span>
            </div>

            <div className="space-y-2 ml-[42px]">
              {dayEvents.map((ev) => {
                const meta = EVENT_META[ev.type];
                return (
                  <div
                    key={ev.id}
                    className="relative rounded-xl border border-[var(--border)] bg-white p-3.5 shadow-sm hover:shadow-md transition-shadow"
                    style={{ borderLeft: `3px solid ${meta.border}` }}
                  >
                    <div className="absolute -left-[39px] top-3.5 w-7 h-7 rounded-full bg-white border-2 border-[var(--border)] flex items-center justify-center z-[1]">
                      <MaterialIcon
                        icon={meta.icon}
                        size={14}
                        className={meta.color}
                      />
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--t1)] truncate">
                          {ev.title}
                        </p>
                        {ev.description && (
                          <p className="text-[12px] text-[var(--t3)] mt-0.5 line-clamp-2 leading-relaxed">
                            {ev.description}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] font-medium text-[var(--t3)] whitespace-nowrap mt-0.5">
                        {new Date(ev.date).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
