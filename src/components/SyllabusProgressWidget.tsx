"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import { useSubjects } from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { Card, CardBody } from "@/components/ui/Card";
import { buildAcademicYear } from "@/lib/academics-utils";
import { logger } from "@/lib/logger";

interface SubjectProgress {
  subjectId: string;
  subjectName: string;
  total: number;
  completed: number;
  percentage: number;
}

export default function SyllabusProgressWidget() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { subjects } = useSubjects(school?.id, false);

  const [progressData, setProgressData] = useState<SubjectProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!school?.id || !academicYear || !currentTerm) {
      setLoading(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        const targetYear = buildAcademicYear(academicYear);
        const termNumber = Number(currentTerm);

        const { data: syllabus, error } = await supabase
          .from("syllabus")
          .select("id, subject_id, topic_coverage(status)")
          .eq("school_id", school.id)
          .eq("term", termNumber)
          .eq("academic_year", targetYear);

        if (error) throw error;

        const grouped: Record<string, { total: number; completed: number }> = {};

        for (const row of syllabus || []) {
          if (!grouped[row.subject_id]) {
            grouped[row.subject_id] = { total: 0, completed: 0 };
          }
          grouped[row.subject_id].total++;
          if (row.topic_coverage?.[0]?.status === "completed") {
            grouped[row.subject_id].completed++;
          }
        }

        const subjectNames = new Map(subjects.map((s) => [s.id, s.name]));

        const result: SubjectProgress[] = Object.entries(grouped)
          .map(([subjectId, data]) => ({
            subjectId,
            subjectName: subjectNames.get(subjectId) || "Unknown",
            total: data.total,
            completed: data.completed,
            percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
          }))
          .sort((a, b) => b.total - a.total);

        setProgressData(result);
      } catch (err) {
        logger.error("Failed to load syllabus progress:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [school?.id, academicYear, currentTerm, subjects]);

  const overallTotal = progressData.reduce((sum, s) => sum + s.total, 0);
  const overallCompleted = progressData.reduce((sum, s) => sum + s.completed, 0);
  const overallPercentage = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

  const barColor = (pct: number) =>
    pct >= 80 ? "#1f8a70" : pct >= 40 ? "#b45309" : "#c2472b";

  return (
    <Card>
      <CardBody>
        <Link
          href="/dashboard/syllabus"
          className="flex items-center justify-between mb-4 group"
        >
          <div>
            <h3 className="text-sm font-bold text-[#17325f]">
              Syllabus Progress
            </h3>
            <p className="text-[11px] text-[#7f91aa]">
              Curriculum coverage this term
            </p>
          </div>
          <span className="material-symbols-outlined text-[#17325f] text-xl group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin w-6 h-6 border-2 border-[#17325F] border-t-transparent rounded-full" />
          </div>
        ) : progressData.length === 0 ? (
          <div className="text-center py-6">
            <MaterialIcon
              icon="menu_book"
              className="text-3xl text-[#c7d4e4] mb-2"
            />
            <p className="text-xs text-[#7f91aa]">No syllabus data yet</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#17325f]">
                Overall
              </span>
              <span className="text-xs font-bold text-[#17325f]">
                {overallPercentage}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${overallPercentage}%`,
                  backgroundColor: barColor(overallPercentage),
                }}
              />
            </div>

            <div className="space-y-3">
              {progressData.slice(0, 6).map((subject) => (
                <div key={subject.subjectId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#60748f] truncate max-w-[70%]">
                      {subject.subjectName}
                    </span>
                    <span className="text-[11px] font-semibold text-[#17325f]">
                      {subject.completed}/{subject.total}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${subject.percentage}%`,
                        backgroundColor: barColor(subject.percentage),
                      }}
                    />
                  </div>
                </div>
              ))}
              {progressData.length > 6 && (
                <Link
                  href="/dashboard/syllabus"
                  className="block text-center text-[11px] font-semibold text-[#60748f] hover:text-[#17325f] pt-1"
                >
                  +{progressData.length - 6} more subjects
                </Link>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
