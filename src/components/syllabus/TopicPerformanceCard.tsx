"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import type { TopicPerformance } from "@/lib/hooks/useSyllabusPlanner";

interface TopicPerformanceCardProps {
  performance: TopicPerformance;
}

export default function TopicPerformanceCard({
  performance,
}: TopicPerformanceCardProps) {
  const getMasteryIcon = (level: string) => {
    switch (level) {
      case "advanced":
        return "star";
      case "proficient":
        return "check_circle";
      case "developing":
        return "info";
      default:
        return "help";
    }
  };

  const getMasteryColor = (
    level: string
  ): "text-amber-600" | "text-green-600" | "text-blue-600" | "text-red-600" => {
    switch (level) {
      case "advanced":
        return "text-amber-600";
      case "proficient":
        return "text-green-600";
      case "developing":
        return "text-blue-600";
      default:
        return "text-red-600";
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return "bg-gray-100 text-gray-700";
    if (score >= 80) return "bg-green-100 text-green-700";
    if (score >= 65) return "bg-blue-100 text-blue-700";
    if (score >= 50) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  const totalStudents = performance.student_count || 1;
  const passRate = Math.round(
    (((totalStudents - performance.students_below_50) / totalStudents) * 100)
  );

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-[var(--t1)] mb-1">
            {performance.topic}
          </h3>
          <div className="flex items-center gap-2">
            <MaterialIcon
              className={`text-lg ${getMasteryColor(performance.mastery_level)}`}
            >
              {getMasteryIcon(performance.mastery_level)}
            </MaterialIcon>
            <span className="text-xs font-medium text-[var(--t3)] capitalize">
              {performance.mastery_level} Level
            </span>
          </div>
        </div>

        {/* Revision Badge */}
        {performance.revision_required && (
          <div className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold flex items-center gap-1">
            <MaterialIcon className="text-sm">warning</MaterialIcon>
            Revision
          </div>
        )}
      </div>

      {/* Score Card */}
      {performance.average_score !== undefined && (
        <div
          className={`${getScoreColor(performance.average_score)} rounded-lg p-3 mb-3 text-center`}
        >
          <div className="text-2xl font-bold">
            {performance.average_score.toFixed(1)}%
          </div>
          <div className="text-xs font-medium">Average Score</div>
        </div>
      )}

      {/* Student Distribution */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[var(--t3)]">Student Performance Distribution</span>
          <span className="font-semibold text-[var(--t2)]">
            {totalStudents} students
          </span>
        </div>

        {/* Distribution Bars */}
        <div className="space-y-1.5">
          {/* Above 75 */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs font-medium text-[var(--t2)]">
                Above 75%
              </span>
              <span className="text-xs text-[var(--t3)]">
                {performance.students_above_75} students
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{
                  width: `${Math.round((performance.students_above_75 / totalStudents) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* 50-75 */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs font-medium text-[var(--t2)]">
                50-75%
              </span>
              <span className="text-xs text-[var(--t3)]">
                {performance.students_50_to_75} students
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{
                  width: `${Math.round((performance.students_50_to_75 / totalStudents) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Below 50 */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs font-medium text-[var(--t2)]">
                Below 50%
              </span>
              <span className="text-xs text-[var(--t3)]">
                {performance.students_below_50} students
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all"
                style={{
                  width: `${Math.round((performance.students_below_50 / totalStudents) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pass Rate Summary */}
      <div className="bg-[var(--bg)]/50 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--t2)] font-medium">Pass Rate</span>
          <span className="text-lg font-bold text-[var(--t1)]">{passRate}%</span>
        </div>
        <div className="w-full h-2 bg-[var(--border)] rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full transition-all ${
              passRate >= 75 ? "bg-green-500" : passRate >= 60 ? "bg-blue-500" : "bg-red-500"
            }`}
            style={{ width: `${passRate}%` }}
          />
        </div>
      </div>

      {/* Notes */}
      {performance.common_misconceptions && (
        <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <h4 className="text-xs font-semibold text-amber-900 mb-1">
            Common Misconceptions
          </h4>
          <p className="text-xs text-amber-800">
            {performance.common_misconceptions}
          </p>
        </div>
      )}

      {performance.differentiation_needed && (
        <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <h4 className="text-xs font-semibold text-blue-900 mb-1">
            Differentiation Needed
          </h4>
          <p className="text-xs text-blue-800">
            {performance.differentiation_needed}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-3 border-t border-[var(--border)]">
        <Button variant="ghost" size="sm" className="flex-1">
          <MaterialIcon className="text-sm">assessment</MaterialIcon>
          Details
        </Button>
        {performance.revision_required && (
          <Button variant="ghost" size="sm" className="flex-1">
            <MaterialIcon className="text-sm">edit</MaterialIcon>
            Plan Revision
          </Button>
        )}
      </div>
    </Card>
  );
}
