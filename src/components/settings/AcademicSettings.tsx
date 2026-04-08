"use client";

import { useState, useEffect, useCallback } from "react";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";

const DEFAULT_EXAM_WEIGHTS = [
  {
    id: "ca1",
    name: "Continuous Assessment 1",
    shortName: "CA1",
    weight: 10,
    isActive: true,
  },
  {
    id: "bot",
    name: "Beginning of Term",
    shortName: "BOT",
    weight: 10,
    isActive: true,
  },
  {
    id: "ca2",
    name: "Continuous Assessment 2",
    shortName: "CA2",
    weight: 10,
    isActive: true,
  },
  {
    id: "ca3",
    name: "Continuous Assessment 3",
    shortName: "CA3",
    weight: 10,
    isActive: true,
  },
  {
    id: "ca4",
    name: "Continuous Assessment 4",
    shortName: "CA4",
    weight: 10,
    isActive: true,
  },
  {
    id: "project",
    name: "Project",
    shortName: "PRJ",
    weight: 10,
    isActive: true,
  },
  {
    id: "mid_term",
    name: "Mid Term",
    shortName: "MT",
    weight: 20,
    isActive: true,
  },
  {
    id: "eot",
    name: "End of Term",
    shortName: "EOT",
    weight: 30,
    isActive: true,
  },
];

interface ExamWeight {
  id: string;
  name: string;
  shortName: string;
  weight: number;
  isActive: boolean;
}

export default function AcademicSettings() {
  const { academicYear, currentTerm, setAcademicYear, setCurrentTerm } =
    useAcademic();
  const { school } = useAuth();
  const [examWeights, setExamWeights] =
    useState<ExamWeight[]>(DEFAULT_EXAM_WEIGHTS);
  const [loadingWeights, setLoadingWeights] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const loadExamWeights = useCallback(async () => {
    if (!school?.id) {
      // #region agent log
      fetch("/api/debug/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"9e14f3",runId:"pre-fix",hypothesisId:"H5",location:"src/components/settings/AcademicSettings.tsx:loadExamWeights:guard",message:"skipped loadExamWeights due to missing school.id",data:{hasSchool:!!school,schoolId:school?.id??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return;
    }
    setLoadingWeights(true);
    const { data, error } = await supabase
      .from("school_settings")
      .select("exam_weights")
      .eq("school_id", school.id)
      .single();
    // #region agent log
    fetch("/api/debug/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"9e14f3",runId:"pre-fix",hypothesisId:"H5",location:"src/components/settings/AcademicSettings.tsx:loadExamWeights",message:"loaded settings exam_weights",data:{schoolId:school.id,hasError:!!error,error:error?String(error.message||error):null,weightsType:typeof (data as any)?.exam_weights,weightsLen:Array.isArray((data as any)?.exam_weights)?(data as any).exam_weights.length:null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (data?.exam_weights) {
      const saved = data.exam_weights as ExamWeight[];
      const merged = DEFAULT_EXAM_WEIGHTS.map((defaultExam) => {
        const savedExam = saved.find((s) => s.id === defaultExam.id);
        return savedExam || defaultExam;
      });
      setExamWeights(merged);
    }
    setLoadingWeights(false);
  }, [school?.id]);

  useEffect(() => {
    if (school?.id) {
      loadExamWeights();
    }
  }, [school?.id, loadExamWeights]);

  async function saveExamWeights() {
    if (!school?.id) return;
    setSavingWeights(true);
    const activeWeights = examWeights.filter((e) => e.isActive);
    const totalWeight = activeWeights.reduce((sum, e) => sum + e.weight, 0);

    const { error } = await supabase.from("school_settings").upsert(
      {
        school_id: school.id,
        exam_weights: examWeights,
      },
      { onConflict: "school_id" },
    );
    // #region agent log
    fetch("/api/debug/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"9e14f3",runId:"pre-fix",hypothesisId:"H6",location:"src/components/settings/AcademicSettings.tsx:saveExamWeights",message:"saved exam_weights",data:{schoolId:school.id,totalWeight,hasError:!!error,error:error?String(error.message||error):null,activeCount:activeWeights.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    setSavingWeights(false);
    setShowSettings(false);
  }

  function updateExamWeight(
    id: string,
    field: keyof ExamWeight,
    value: number | boolean,
  ) {
    setExamWeights((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    );
  }

  const activeWeights = examWeights.filter((e) => e.isActive);
  const totalWeight = activeWeights.reduce((sum, e) => sum + e.weight, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-[#191c1d] mb-6 flex items-center gap-2">
          <MaterialIcon icon="calendar_month" className="text-primary" />
          Academic Configuration
        </h2>
        <p className="text-sm text-on-surface-variant mb-6">
          Set the active academic year and term for the entire school. This
          controls all dashboards, fee reports, and grade books.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-[#191c1d] mb-2 block">
              Active Academic Year
            </label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="input w-full"
            >
              {Array.from({ length: 5 }).map((_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#191c1d] mb-2 block">
              Current Term
            </label>
            <select
              value={currentTerm}
              onChange={(e) =>
                setCurrentTerm(Number(e.target.value) as 1 | 2 | 3)
              }
              className="input w-full"
            >
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#191c1d] flex items-center gap-2">
            <MaterialIcon icon="calculate" className="text-primary" />
            Exam Weighting
          </h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-sm text-primary hover:underline"
          >
            {showSettings ? "Hide" : "Configure"}
          </button>
        </div>

        {!showSettings ? (
          <div>
            <p className="text-sm text-on-surface-variant mb-4">
              Configure which exams to use and their weights. Total must equal
              100%.
            </p>
            <div className="bg-[#f8fafc] rounded-lg p-4">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3 text-xs font-medium text-[#5c6670] uppercase">
                <span className="col-span-2">Exam</span>
                <span className="text-center">Weight</span>
                <span className="text-center">Status</span>
              </div>
              {examWeights
                .filter((e) => e.isActive)
                .map((exam) => (
                  <div
                    key={exam.id}
                    className="grid grid-cols-4 sm:grid-cols-6 gap-2 py-2 text-sm border-t border-[#e8eaed]"
                  >
                    <span className="col-span-2">{exam.name}</span>
                    <span className="text-center">{exam.weight}%</span>
                    <span className="text-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    </span>
                  </div>
                ))}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 py-2 mt-2 border-t border-[#e8eaed] font-medium">
                <span className="col-span-2">Total</span>
                <span
                  className={`text-center ${totalWeight !== 100 ? "text-red-600" : "text-green-600"}`}
                >
                  {totalWeight}%
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {examWeights.map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-lg"
                >
                  <input
                    type="checkbox"
                    checked={exam.isActive}
                    onChange={(e) =>
                      updateExamWeight(exam.id, "isActive", e.target.checked)
                    }
                    className="w-4 h-4 rounded border-[#cbd5e1] text-primary"
                  />
                  <span className="flex-1 text-sm">{exam.name}</span>
                  <span className="text-xs text-[#94a3b8] w-8">
                    {exam.shortName}
                  </span>
                  <input
                    type="number"
                    value={exam.weight}
                    onChange={(e) =>
                      updateExamWeight(
                        exam.id,
                        "weight",
                        Number(e.target.value),
                      )
                    }
                    disabled={!exam.isActive}
                    className="w-16 px-2 py-1 text-sm border border-[#cbd5e1] rounded disabled:opacity-50"
                    min={0}
                    max={100}
                  />
                  <span className="text-sm text-[#64748b]">%</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#e8eaed]">
              <span className="text-sm">
                Total:
                <span
                  className={`font-medium ml-2 ${totalWeight !== 100 ? "text-red-600" : "text-green-600"}`}
                >
                  {totalWeight}%
                </span>
              </span>
              {totalWeight !== 100 && (
                <span className="text-xs text-red-600">Must equal 100%</span>
              )}
            </div>
            <button
              onClick={saveExamWeights}
              disabled={savingWeights || totalWeight !== 100}
              className="btn mt-4 w-full disabled:opacity-50"
            >
              {savingWeights ? "Saving..." : "Save Exam Weights"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
