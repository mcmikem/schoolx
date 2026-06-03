"use client";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { useSyllabusTimeline } from "@/lib/hooks/useSyllabusPlanner";
import type { SyllabusWithTimeline } from "@/lib/hooks/useSyllabusPlanner";

interface SyllabusTimelineViewProps {
  syllabus: SyllabusWithTimeline;
  viewMode: "grid" | "list";
}

export default function SyllabusTimelineView({
  syllabus,
  viewMode,
}: SyllabusTimelineViewProps) {
  const [expanded, setExpanded] = useState(false);

  const timeline = syllabus.timeline || [];
  const progress = syllabus.progress || { overall_percentage: 0, weeks_completed: 0, weeks_total: 0, on_track: true };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "check_circle";
      case "in_progress":
        return "schedule";
      case "postponed":
        return "pause_circle";
      case "accelerated":
        return "fast_forward";
      default:
        return "radio_button_unchecked";
    }
  };

  const getStatusColor = (
    status: string
  ): "bg-green-100 text-green-700" | "bg-blue-100 text-blue-700" | "bg-amber-100 text-amber-700" | "bg-gray-100 text-gray-700" => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "postponed":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getProgressBarColor = (percentage: number): string => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 60) return "bg-blue-500";
    if (percentage >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card className={expanded ? "" : "hover:shadow-md transition-shadow"}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-[var(--bg)]/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-[var(--t1)]">{syllabus.topic}</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  progress.on_track
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {progress.on_track ? "On Track" : "Behind"}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--t3)]">Progress</span>
                <span className="text-sm font-semibold text-[var(--t1)]">
                  {progress.overall_percentage}%
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${getProgressBarColor(progress.overall_percentage)}`}
                  style={{ width: `${progress.overall_percentage}%` }}
                />
              </div>
            </div>

            {/* Summary */}
            <p className="text-xs text-[var(--t3)]">
              {progress.weeks_completed} of {progress.weeks_total} weeks completed
            </p>
          </div>

          {/* Expand Icon */}
          <div className="text-[var(--t3)]">
            <MaterialIcon className="text-2xl">
              {expanded ? "expand_less" : "expand_more"}
            </MaterialIcon>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <>
          <div className="border-t border-[var(--border)]" />
          <div className="p-4 space-y-4">
            {/* Details */}
            {syllabus.subtopics && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--t3)] mb-2">
                  SUBTOPICS
                </h4>
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(syllabus.subtopics)
                    ? syllabus.subtopics.map((st, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs bg-[var(--bg)] rounded-full text-[var(--t2)]"
                        >
                          {st}
                        </span>
                      ))
                    : typeof syllabus.subtopics === "string"
                      ? JSON.parse(syllabus.subtopics || "[]").map((st: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-1 text-xs bg-[var(--bg)] rounded-full text-[var(--t2)]"
                          >
                            {st}
                          </span>
                        ))
                      : null}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h4 className="text-xs font-semibold text-[var(--t3)] mb-3">
                WEEKLY TIMELINE
              </h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {timeline.length === 0 ? (
                  <p className="text-xs text-[var(--t3)] italic">
                    No timeline data yet
                  </p>
                ) : (
                  timeline.map((week) => (
                    <div
                      key={week.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg)]/50 hover:bg-[var(--bg)] transition-colors"
                    >
                      {/* Status Icon */}
                      <div className="text-[var(--t3)]">
                        <MaterialIcon className="text-lg">
                          {getStatusIcon(week.status)}
                        </MaterialIcon>
                      </div>

                      {/* Week Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-[var(--t1)]">
                            Week {week.week_number}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(week.status)}`}
                          >
                            {week.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--t3)]">
                          {new Date(week.planned_start_date).toLocaleDateString()} -{" "}
                          {new Date(week.planned_end_date).toLocaleDateString()}
                        </p>

                        {/* Mini Progress */}
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProgressBarColor(week.completion_percentage)}`}
                              style={{ width: `${week.completion_percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--t3)]">
                            {week.completion_percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Lessons */}
                      <div className="text-right">
                        <div className="text-xs font-semibold text-[var(--t1)]">
                          {week.lessons_completed}/{week.lessons_planned}
                        </div>
                        <p className="text-xs text-[var(--t3)]">lessons</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Resources */}
            {syllabus.resources && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--t3)] mb-2">
                  RESOURCES
                </h4>
                <p className="text-sm text-[var(--t2)]">{syllabus.resources}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
              >
                <MaterialIcon className="text-sm">edit</MaterialIcon>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
              >
                <MaterialIcon className="text-sm">assessment</MaterialIcon>
                View Performance
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
