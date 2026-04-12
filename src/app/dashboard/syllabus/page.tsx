"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useClasses, useSubjects } from "@/lib/hooks";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import {
  S1_ALL_SUBJECTS,
  S2_ALL_SUBJECTS,
  S3_ALL_SUBJECTS,
  S4_ALL_SUBJECTS,
  S5_ALL_SUBJECTS,
  S6_ALL_SUBJECTS,
  P1_ALL_SUBJECTS,
  P2_ALL_SUBJECTS,
  P3_ALL_SUBJECTS,
  P4_ALL_SUBJECTS,
  P5_ALL_SUBJECTS,
  P6_ALL_SUBJECTS,
  P7_ALL_SUBJECTS,
  NSDCTopic,
} from "@/lib/ndc-syllabus";

interface SyllabusTopic {
  id: string;
  topic: string;
  subtopics: string[] | null;
  objectives: string | null;
  weeks_covered: string | null;
  resources: string | null;
  status: "not_started" | "in_progress" | "completed";
  completed_date: string | null;
  notes: string | null;
}

export default function SyllabusPage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id, false);
  const { academicYear } = useAcademic();

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newTopic, setNewTopic] = useState({
    topic: "",
    subtopics: "",
    objectives: "",
    weeks_covered: "",
    resources: "",
  });
  const [populating, setPopulating] = useState(false);

  const getClassLevel = (className: string): number => {
    const match = className.match(/S[1-6]/);
    if (match) return parseInt(match[0].replace("S", ""));
    const pMatch = className.match(/P[1-7]/);
    if (pMatch) return parseInt(pMatch[0].replace("P", ""));
    return 1;
  };

  const getNDCCTopics = (): NSDCTopic[] => {
    const level = getClassLevel(
      classes.find((c) => c.id === selectedClass)?.name || "",
    );
    const subjectName =
      subjects.find((s) => s.id === selectedSubject)?.name || "";

    if (level >= 1 && level <= 3) {
      const primaryMap: Record<number, NSDCTopic[]> = {
        1: P1_ALL_SUBJECTS,
        2: P2_ALL_SUBJECTS,
        3: P3_ALL_SUBJECTS,
      };
      return (primaryMap[level] || []).filter(
        (t) => t.subject.toLowerCase() === subjectName.toLowerCase(),
      );
    }

    if (level >= 4 && level <= 7) {
      const upperPrimaryMap: Record<number, NSDCTopic[]> = {
        4: P4_ALL_SUBJECTS,
        5: P5_ALL_SUBJECTS,
        6: P6_ALL_SUBJECTS,
        7: P7_ALL_SUBJECTS,
      };
      return (upperPrimaryMap[level] || []).filter(
        (t) => t.subject.toLowerCase() === subjectName.toLowerCase(),
      );
    }

    const secondaryMap: Record<number, NSDCTopic[]> = {
      1: S1_ALL_SUBJECTS,
      2: S2_ALL_SUBJECTS,
      3: S3_ALL_SUBJECTS,
      4: S4_ALL_SUBJECTS,
      5: S5_ALL_SUBJECTS,
      6: S6_ALL_SUBJECTS,
    };
    return (secondaryMap[level] || []).filter(
      (t) => t.subject.toLowerCase() === subjectName.toLowerCase(),
    );
  };

  const handleAutoPopulate = async () => {
    if (!school?.id || !selectedClass || !selectedSubject || !user?.id) return;
    setPopulating(true);
    try {
      const ncdcTopics = getNDCCTopics();
      if (ncdcTopics.length === 0) {
        toast.error("No NCDC topics found for this class/subject");
        return;
      }
      const toInsert = ncdcTopics.map((t) => ({
        school_id: school.id,
        class_id: selectedClass,
        subject_id: selectedSubject,
        topic: t.topic,
        subtopics: JSON.stringify(t.subtopics),
        objectives: t.objectives.join("; "),
        weeks_covered: `Week ${t.weeks}`,
        term: t.term,
        academic_year: academicYear || "2026",
        created_by: user.id,
      }));
      const { error } = await supabase.from("syllabus").insert(toInsert);
      if (error) throw error;
      toast.success(`Added ${toInsert.length} NCDC topics`);
      fetchSyllabus();
    } catch (err) {
      console.error("Failed to populate syllabus:", err);
      toast.error("Failed to populate syllabus");
    } finally {
      setPopulating(false);
    }
  };

  const fetchSyllabus = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const { data: syllabus } = await supabase
        .from("syllabus")
        .select("*, topic_coverage(status, completed_date, notes)")
        .eq("school_id", school.id)
        .eq("class_id", selectedClass)
        .eq("subject_id", selectedSubject)
        .order("weeks_covered");

      const processed = (syllabus || []).map((s) => ({
        ...s,
        subtopics: s.subtopics ? JSON.parse(s.subtopics) : [],
        status: s.topic_coverage?.[0]?.status || "not_started",
        completed_date: s.topic_coverage?.[0]?.completed_date,
        notes: s.topic_coverage?.[0]?.notes,
      }));

      setTopics(processed);
    } catch (err) {
      console.error("Failed to fetch syllabus:", err);
    } finally {
      setLoading(false);
    }
  }, [school?.id, selectedClass, selectedSubject]);

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchSyllabus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedSubject]);

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id || !selectedClass || !selectedSubject || !user?.id) return;

    setSaving(true);
    try {
      const { data: syllabus, error } = await supabase
        .from("syllabus")
        .insert({
          school_id: school.id,
          class_id: selectedClass,
          subject_id: selectedSubject,
          topic: newTopic.topic,
          subtopics: newTopic.subtopics
            ? JSON.stringify(
                newTopic.subtopics.split("\n").filter((t) => t.trim()),
              )
            : null,
          objectives: newTopic.objectives || null,
          weeks_covered: newTopic.weeks_covered || null,
          resources: newTopic.resources || null,
          term: 1,
          academic_year: "2026",
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial topic coverage
      await supabase.from("topic_coverage").insert({
        syllabus_id: syllabus.id,
        class_id: selectedClass,
        status: "not_started",
      });

      toast.success("Topic added to syllabus");
      setShowAddModal(false);
      setNewTopic({
        topic: "",
        subtopics: "",
        objectives: "",
        weeks_covered: "",
        resources: "",
      });
      fetchSyllabus();
    } catch (err) {
      toast.error("Failed to add topic");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (
    topicId: string,
    status: "not_started" | "in_progress" | "completed",
  ) => {
    setSaving(true);
    try {
      const updateData: any = { status };
      if (status === "completed") {
        updateData.completed_date = new Date().toISOString().split("T")[0];
      }

      await supabase
        .from("topic_coverage")
        .update(updateData)
        .eq("syllabus_id", topicId);

      fetchSyllabus();
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const getProgressStats = () => {
    const total = topics.length;
    const completed = topics.filter((t) => t.status === "completed").length;
    const inProgress = topics.filter((t) => t.status === "in_progress").length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, percentage };
  };

  const stats = getProgressStats();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">
            Syllabus & Topics
          </h1>
          <p className="text-[#5c6670] mt-1">
            Track curriculum coverage per subject
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          disabled={!selectedClass || !selectedSubject}
          className="btn btn-primary"
        >
          <MaterialIcon icon="add" style={{ fontSize: "16px" }} />
          Add Topic
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedClass}
          onChange={(e) => {
            setSelectedClass(e.target.value);
            setTopics([]);
          }}
          className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium"
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
          onChange={(e) => {
            setSelectedSubject(e.target.value);
            setTopics([]);
          }}
          className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium"
        >
          <option value="">Select Subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {selectedClass && selectedSubject && (
          <button
            onClick={handleAutoPopulate}
            disabled={populating}
            className="px-4 py-2 bg-[#10b981] text-white rounded-xl text-sm font-medium hover:bg-[#059669] disabled:opacity-50 flex items-center gap-1"
          >
            <MaterialIcon icon="auto_awesome" style={{ fontSize: "16px" }} />
            {populating ? "Populating..." : "NCDC Topics"}
          </button>
        )}
      </div>

      {/* Progress Stats */}
      {selectedClass && selectedSubject && topics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#f8fbff] rounded-xl p-4 border border-[#e5e9f0]">
            <div className="text-2xl font-bold text-[#17325F]">
              {stats.total}
            </div>
            <div className="text-xs text-[#5c6670]">Total Topics</div>
          </div>
          <div className="bg-[#f0fdf4] rounded-xl p-4 border border-[#dcfce7]">
            <div className="text-2xl font-bold text-[#166534]">
              {stats.completed}
            </div>
            <div className="text-xs text-[#5c6670]">Completed</div>
          </div>
          <div className="bg-[#fffbeb] rounded-xl p-4 border border-[#fef3c7]">
            <div className="text-2xl font-bold text-[#92400e]">
              {stats.inProgress}
            </div>
            <div className="text-xs text-[#5c6670]">In Progress</div>
          </div>
          <div className="bg-[#f0f9ff] rounded-xl p-4 border border-[#cffafe]">
            <div className="text-2xl font-bold text-[#0e7490]">
              {stats.percentage}%
            </div>
            <div className="text-xs text-[#5c6670]">Coverage</div>
          </div>
        </div>
      )}

      {/* Topics List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[#17325F] border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : !selectedClass || !selectedSubject ? (
        <div className="text-center py-12 text-[#5c6670]">
          <MaterialIcon style={{ fontSize: 48, opacity: 0.5 }}>
            menu_book
          </MaterialIcon>
          <p className="mt-2">Select a class and subject to view syllabus</p>
        </div>
      ) : topics.length === 0 ? (
        <div className="text-center py-12 text-[#5c6670]">
          <MaterialIcon style={{ fontSize: 48, opacity: 0.5 }}>
            menu_book
          </MaterialIcon>
          <p className="mt-2">No topics added yet</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary mt-4"
          >
            Add First Topic
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        topic.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : topic.status === "in_progress"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {topic.status === "completed"
                        ? "✓ Completed"
                        : topic.status === "in_progress"
                          ? "◐ In Progress"
                          : "○ Not Started"}
                    </span>
                    {topic.weeks_covered && (
                      <span className="text-xs text-[#5c6670]">
                        {topic.weeks_covered}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-[#17325F]">
                    {topic.topic}
                  </h3>
                  {topic.objectives && (
                    <p className="text-sm text-[#5c6670] mt-1">
                      Objectives: {topic.objectives}
                    </p>
                  )}
                  {topic.subtopics && topic.subtopics.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {topic.subtopics.map((sub: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-gray-50 rounded text-xs text-[#5c6670]"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  value={topic.status}
                  onChange={(e) =>
                    updateStatus(
                      topic.id,
                      e.target.value as
                        | "not_started"
                        | "in_progress"
                        | "completed",
                    )
                  }
                  className="text-sm border rounded-lg px-2 py-1"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Topic Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-[#17325F]">
                Add Syllabus Topic
              </h2>
            </div>
            <form onSubmit={handleAddTopic} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#17325F] mb-1">
                  Topic Name *
                </label>
                <input
                  type="text"
                  value={newTopic.topic}
                  onChange={(e) =>
                    setNewTopic({ ...newTopic, topic: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                  placeholder="e.g., Introduction to Fractions"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#17325F] mb-1">
                    Weeks
                  </label>
                  <input
                    type="text"
                    value={newTopic.weeks_covered}
                    onChange={(e) =>
                      setNewTopic({
                        ...newTopic,
                        weeks_covered: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                    placeholder="e.g., Week 1-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#17325F] mb-1">
                    Resources
                  </label>
                  <input
                    type="text"
                    value={newTopic.resources}
                    onChange={(e) =>
                      setNewTopic({ ...newTopic, resources: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                    placeholder="e.g., Charts, Workbook"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#17325F] mb-1">
                  Learning Objectives
                </label>
                <textarea
                  value={newTopic.objectives}
                  onChange={(e) =>
                    setNewTopic({ ...newTopic, objectives: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                  placeholder="What students will learn..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#17325F] mb-1">
                  Subtopics (one per line)
                </label>
                <textarea
                  value={newTopic.subtopics}
                  onChange={(e) =>
                    setNewTopic({ ...newTopic, subtopics: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                  placeholder="Parts of a fraction&#10;Equivalent fractions&#10;Adding fractions"
                  rows={4}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-[#17325F] text-white rounded-xl font-semibold"
                >
                  {saving ? "Saving..." : "Add Topic"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
