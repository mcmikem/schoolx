"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useClasses, useSubjects } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface SchemeWeek {
  week: number;
  topic: string;
  subtopics: string;
  objectives: string;
  resources: string;
}

export default function SchemeOfWorkPage() {
  const { school, user } = useAuth();
  const { academicYear } = useAcademic();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id, false);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [term, setTerm] = useState("1");
  const [weeks, setWeeks] = useState<SchemeWeek[]>(
    Array.from({ length: 12 }, (_, i) => ({
      week: i + 1,
      topic: "",
      subtopics: "",
      objectives: "",
      resources: "",
    })),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadScheme = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("scheme_of_work")
        .select("*")
        .eq("school_id", school.id)
        .eq("class_id", selectedClass)
        .eq("subject_id", selectedSubject)
        .eq("term", parseInt(term))
        .eq("academic_year", academicYear)
        .order("week");

      if (data && data.length > 0) {
        const weekMap = new Map(data.map((d) => [d.week, d]));
        const updated = weeks.map((w) => {
          const saved = weekMap.get(w.week);
          return saved
            ? {
                week: saved.week,
                topic: saved.topic || "",
                subtopics: saved.subtopics || "",
                objectives: saved.objectives || "",
                resources: saved.resources || "",
              }
            : w;
        });
        setWeeks(updated);
      }
    } catch (err) {
      console.error("Failed to load scheme:", err);
      toast.error("Failed to load scheme of work");
    } finally {
      setLoading(false);
    }
    setHasChanges(false);
  }, [school?.id, selectedClass, selectedSubject, term, academicYear, weeks, toast]);

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      loadScheme();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedSubject]);

  const updateWeek = (
    index: number,
    field: keyof SchemeWeek,
    value: string,
  ) => {
    const updated = [...weeks];
    updated[index] = { ...updated[index], [field]: value };
    setWeeks(updated);
    setHasChanges(true);
  };

  const saveScheme = async () => {
    if (!school?.id || !selectedClass || !selectedSubject || !user?.id) {
      toast.error("Please select class and subject");
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from("scheme_of_work")
        .delete()
        .eq("school_id", school.id)
        .eq("class_id", selectedClass)
        .eq("subject_id", selectedSubject)
        .eq("term", parseInt(term))
        .eq("academic_year", academicYear);

      const toInsert = weeks
        .filter((w) => w.topic.trim())
        .map((w) => ({
          school_id: school.id,
          class_id: selectedClass,
          subject_id: selectedSubject,
          term: parseInt(term),
          academic_year: academicYear,
          week_number: w.week,
          topic: w.topic,
          subtopics: w.subtopics,
          objectives: w.objectives,
          resources: w.resources,
          created_by: user.id,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from("scheme_of_work")
          .insert(toInsert);
        if (error) throw error;
      }

      toast.success("Scheme of work saved!");
      setHasChanges(false);
    } catch (err) {
      toast.error("Failed to save scheme");
    } finally {
      setSaving(false);
    }
  };

  const selectedSubjectName = subjects.find(
    (s) => s.id === selectedSubject,
  )?.name;
  const selectedClassName = classes.find((c) => c.id === selectedClass)?.name;

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Scheme of Work"
        subtitle={`Weekly teaching plan for ${selectedSubjectName || "Select subject"} - ${selectedClassName || "Select class"}`}
        actions={
          <Button
            onClick={saveScheme}
            disabled={
              !hasChanges || saving || !selectedClass || !selectedSubject
            }
          >
            <MaterialIcon icon="save" className="text-base" />
            {saving ? "Saving..." : "Save Scheme"}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium"
        >
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium"
        >
          <option value="">Select Subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium"
        >
          <option value="1">Term 1</option>
          <option value="2">Term 2</option>
          <option value="3">Term 3</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : !selectedClass || !selectedSubject ? (
        <div className="text-center py-12 text-[var(--t3)]">
          <MaterialIcon className="text-5xl opacity-50 mx-auto">
            list_alt
          </MaterialIcon>
          <p className="mt-2">
            Select a class and subject to create scheme of work
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {weeks.map((week, idx) => (
            <Card key={week.week} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-bold">
                  {week.week}
                </div>
                <span className="text-sm font-semibold text-[var(--primary)]">
                  Week {week.week}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">
                    Topic(s)
                  </label>
                  <input
                    type="text"
                    value={week.topic}
                    onChange={(e) => updateWeek(idx, "topic", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="Main topics for this week..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">
                    Resources
                  </label>
                  <input
                    type="text"
                    value={week.resources}
                    onChange={(e) =>
                      updateWeek(idx, "resources", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="Textbooks, charts, digital..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">
                    Subtopics
                  </label>
                  <input
                    type="text"
                    value={week.subtopics}
                    onChange={(e) =>
                      updateWeek(idx, "subtopics", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="Specific subtopics to cover..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">
                    Learning Objectives
                  </label>
                  <input
                    type="text"
                    value={week.objectives}
                    onChange={(e) =>
                      updateWeek(idx, "objectives", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="What students will learn by end of week..."
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedClass && selectedSubject && (
        <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--primary)] mb-2">
            <MaterialIcon className="text-base">lightbulb</MaterialIcon>
            Uganda Primary Curriculum Guide
          </div>
          <p className="text-xs text-[var(--t3)]">
            Fill this scheme of work at the beginning of term. It helps you plan
            what to teach each week and ensures you cover the full syllabus. Use
            the NCDC curriculum to identify topics and objectives for each
            subject.
          </p>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
