"use client";
import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useClasses, useSubjects } from "@/lib/hooks";
import { useAcademic } from "@/lib/academic-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/index";
import { Card } from "@/components/ui/Card";
import {
  useSyllabusTracker,
  useTopicPerformance,
  useAutoPlannerConfig,
  useLessonPlanGeneration,
} from "@/lib/hooks/useSyllabusPlanner";
import SyllabusTimelineView from "@/components/syllabus/SyllabusTimelineView";
import TopicPerformanceCard from "@/components/syllabus/TopicPerformanceCard";
import AutoPlannerPanel from "@/components/syllabus/AutoPlannerPanel";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";

export default function SyllabusTrackerPage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id, false);
  const { academicYear, currentTerm } = useAcademic();

  // UI State
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTerm, setSelectedTerm] = useState(currentTerm?.toString() || "1");
  const [activeTab, setActiveTab] = useState<"timeline" | "performance" | "auto-planner">("timeline");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Data hooks
  const {
    syllabi,
    loading: syllabusLoading,
    refetch: refetchSyllabi,
  } = useSyllabusTracker(school?.id, selectedClass, selectedSubject, parseInt(selectedTerm), academicYear);

  const { performance, loading: performanceLoading } = useTopicPerformance(
    school?.id,
    selectedClass,
    selectedSubject,
    parseInt(selectedTerm),
    academicYear,
  );

  const { config, updateConfig } = useAutoPlannerConfig(school?.id);
  const { generating, generateLessonPlans } = useLessonPlanGeneration(school?.id);

  const handleGenerateLessonPlans = useCallback(async () => {
    if (!selectedClass || !selectedSubject || syllabi.length === 0) {
      toast.error("Please select a class and subject first");
      return;
    }

    try {
      await generateLessonPlans({
        syllabusIds: syllabi.map((s) => s.id),
        classId: selectedClass,
        subjectId: selectedSubject,
        teacherId: user?.id,
        termNumber: parseInt(selectedTerm),
        academicYear,
        useAI: config.enable_ai_generation || false,
      });

      toast.success("Lesson plans generated");
      refetchSyllabi();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate lesson plans");
    }
  }, [
    selectedClass,
    selectedSubject,
    syllabi,
    selectedTerm,
    academicYear,
    config,
    generateLessonPlans,
    refetchSyllabi,
    toast,
  ]);

  const isLoading = syllabusLoading || performanceLoading;
  const completedTopicCount = syllabi.filter((syllabus) => syllabus.status === "completed").length;
  const inProgressTopicCount = syllabi.filter((syllabus) => syllabus.status === "in_progress").length;
  const averageProgress = syllabi.length
    ? Math.round(
        syllabi.reduce(
          (total, syllabus) => total + (syllabus.progress?.overall_percentage ?? syllabus.completion_percentage ?? 0),
          0,
        ) / syllabi.length,
      )
    : 0;

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 60) return "bg-blue-500";
    if (percentage >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-[var(--bg)]">
        <PageHeader
          title="Syllabus Tracker & Auto Lesson Planner"
          subtitle="Track syllabus progress, view topic performance, and auto-generate lesson plans with AI."
          actions={
            <Button
              onClick={handleGenerateLessonPlans}
              disabled={generating || !selectedClass || !selectedSubject}
              className="gap-2"
            >
              <MaterialIcon>auto_awesome</MaterialIcon>
              {generating ? "Generating..." : "Generate Lesson Plans"}
            </Button>
          }
        />

        {/* Filters */}
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-6 md:sticky md:top-0 md:z-40">
          <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap sm:gap-3">
            {/* Class Filter */}
            <div className="min-w-0 flex-1">
              <label className="block text-xs font-semibold text-[var(--t3)] mb-1.5">Class</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input w-full">
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Filter */}
            <div className="min-w-0 flex-1">
              <label className="block text-xs font-semibold text-[var(--t3)] mb-1.5">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="input w-full"
              >
                <option value="">All Subjects</option>
                {subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Term Filter */}
            <div className="min-w-0 flex-1">
              <label className="block text-xs font-semibold text-[var(--t3)] mb-1.5">Term</label>
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="input w-full">
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="col-span-2 flex justify-self-end gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 p-1 sm:col-span-1 sm:ml-auto">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded transition-colors ${
                  viewMode === "grid" ? "bg-[var(--primary)] text-white" : "text-[var(--t3)] hover:text-[var(--t2)]"
                }`}
                title="Grid view"
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
              >
                <MaterialIcon>grid_view</MaterialIcon>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-2 rounded transition-colors ${
                  viewMode === "list" ? "bg-[var(--primary)] text-white" : "text-[var(--t3)] hover:text-[var(--t2)]"
                }`}
                title="List view"
                aria-label="List view"
                aria-pressed={viewMode === "list"}
              >
                <MaterialIcon>list</MaterialIcon>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)]">
          <div role="tablist" aria-label="Syllabus views" className="flex min-w-max px-4 sm:px-6">
            {[
              { id: "timeline", label: "Timeline & Progress" },
              { id: "performance", label: "Topic Performance" },
              { id: "auto-planner", label: "Auto Planner Config" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`min-h-12 shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4 ${
                  activeTab === tab.id
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--t3)] hover:text-[var(--t2)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6">
          {!isLoading && activeTab === "timeline" && syllabi.length > 0 && (
            <section
              aria-label="syllabus overview"
              className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--t3)]">
                    Syllabus overview
                  </p>
                  <h2 className="mt-1 truncate text-base font-semibold text-[var(--t1)]">
                    {subjects.find((subject) => subject.id === selectedSubject)?.name || "Selected subject"}
                    {selectedClass
                      ? ` · ${classes.find((classItem) => classItem.id === selectedClass)?.name || "Class"}`
                      : ""}
                  </h2>
                </div>
                <span className="shrink-0 rounded-xl bg-[var(--primary)]/10 px-3 py-2 text-sm font-bold text-[var(--primary)]">
                  {averageProgress}%
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Topics", value: syllabi.length },
                  { label: "In progress", value: inProgressTopicCount },
                  { label: "Completed", value: completedTopicCount },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-[var(--surface-container-low)] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">{item.label}</p>
                    <p className="mt-1 text-lg font-bold text-[var(--t1)]">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-4 border-[var(--border)] border-t-[var(--primary)] animate-spin mx-auto mb-3" />
                <p className="text-[var(--t3)]">Loading data...</p>
              </div>
            </div>
          )}

          {!isLoading && activeTab === "timeline" && (
            <div className="space-y-4">
              {syllabi.length === 0 ? (
                <Card className="p-8 text-center">
                  <MaterialIcon className="text-4xl text-[var(--t3)] mb-3">schedule</MaterialIcon>
                  <p className="text-[var(--t2)] font-medium mb-2">No syllabus data available</p>
                  <p className="text-[var(--t3)] text-sm">Select a class and subject to view syllabus timeline</p>
                </Card>
              ) : (
                syllabi.map((syllabus) => (
                  <SyllabusTimelineView key={syllabus.id} syllabus={syllabus} viewMode={viewMode} />
                ))
              )}
            </div>
          )}

          {!isLoading && activeTab === "performance" && (
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-4"}>
              {performance.length === 0 ? (
                <Card className="p-8 text-center col-span-full">
                  <MaterialIcon className="text-4xl text-[var(--t3)] mb-3">trending_up</MaterialIcon>
                  <p className="text-[var(--t2)] font-medium mb-2">No performance data yet</p>
                  <p className="text-[var(--t3)] text-sm">Performance analytics will appear after assessments</p>
                </Card>
              ) : (
                performance.map((perf) => <TopicPerformanceCard key={perf.id} performance={perf} />)
              )}
            </div>
          )}

          {!isLoading && activeTab === "auto-planner" && (
            <AutoPlannerPanel
              config={config}
              onConfigUpdate={updateConfig}
              onGeneratePlans={handleGenerateLessonPlans}
              isGenerating={generating}
            />
          )}
        </div>
      </div>
    </PageErrorBoundary>
  );
}
