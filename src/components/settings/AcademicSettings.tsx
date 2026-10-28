"use client";

import { useState, useEffect, useCallback } from "react";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { useClasses, useSubjects } from "@/lib/hooks";
import {
  REPORT_ROWS_KEY,
  TERM_GRADE_BASIS_KEY,
  parseReportRows,
  parseTermGradeBasis,
  type ReportRowConfig,
  type TermGradeBasis,
} from "@/lib/report-rows";
import { loadSchoolSetting, saveSchoolSetting } from "@/lib/school-settings";
import { getErrorMessage } from "@/lib/validation";
import { useToast } from "@/components/Toast";
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
  const { academicYear, currentTerm, setAcademicYear, setCurrentTerm } = useAcademic();
  const { school } = useAuth();
  const toast = useToast();
  const [examWeights, setExamWeights] = useState<ExamWeight[]>(DEFAULT_EXAM_WEIGHTS);
  const [loadingWeights, setLoadingWeights] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const loadExamWeights = useCallback(async () => {
    if (!school?.id) {
      return;
    }

    try {
      setLoadingWeights(true);
      const saved = await loadSchoolSetting<ExamWeight[]>(school.id, "exam_weights", DEFAULT_EXAM_WEIGHTS);

      if (Array.isArray(saved) && saved.length > 0) {
        const merged = DEFAULT_EXAM_WEIGHTS.map((defaultExam) => {
          const savedExam = saved.find((s) => s.id === defaultExam.id);
          return savedExam || defaultExam;
        });
        setExamWeights(merged);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load exam weights"));
    } finally {
      setLoadingWeights(false);
    }
  }, [school?.id, toast]);

  useEffect(() => {
    if (school?.id) {
      loadExamWeights();
    }
  }, [school?.id, loadExamWeights]);

  async function saveExamWeights() {
    if (!school?.id) return;

    const activeWeights = examWeights.filter((e) => e.isActive);
    const totalWeight = activeWeights.reduce((sum, e) => sum + e.weight, 0);

    if (totalWeight !== 100) {
      toast.error("Active exam weights must total 100%.");
      return;
    }

    try {
      setSavingWeights(true);
      await saveSchoolSetting(school.id, "exam_weights", examWeights);
      toast.success("Exam weighting saved");
      setShowSettings(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save exam weights"));
    } finally {
      setSavingWeights(false);
    }
  }

  function updateExamWeight(id: string, field: keyof ExamWeight, value: number | boolean) {
    setExamWeights((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }

  const activeWeights = examWeights.filter((e) => e.isActive);
  const totalWeight = activeWeights.reduce((sum, e) => sum + e.weight, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[var(--surface-container-high)] p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-[var(--t1)] mb-6 flex items-center gap-2">
          <MaterialIcon icon="calendar_month" className="text-primary" />
          Academic Configuration
        </h2>
        <p className="text-sm text-on-surface-variant mb-6">
          Set the active academic year and term for the entire school. This controls all dashboards, fee reports, and
          grade books.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Active Academic Year</label>
            <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="input w-full">
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
            <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Current Term</label>
            <select
              value={currentTerm}
              onChange={(e) => setCurrentTerm(Number(e.target.value) as 1 | 2 | 3)}
              className="input w-full"
            >
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--surface-container-high)] p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--t1)] flex items-center gap-2">
            <MaterialIcon icon="calculate" className="text-primary" />
            Exam Weighting
          </h2>
          <button onClick={() => setShowSettings(!showSettings)} className="text-sm text-primary hover:underline">
            {showSettings ? "Hide" : "Configure"}
          </button>
        </div>

        {!showSettings ? (
          <div>
            <p className="text-sm text-on-surface-variant mb-4">
              Configure which exams to use and their weights. Total must equal 100%.
            </p>
            <div className="bg-[#f8fafc] rounded-lg p-4">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3 text-xs font-medium text-[var(--t3)] uppercase">
                <span className="col-span-2">Exam</span>
                <span className="text-center">Weight</span>
                <span className="text-center">Status</span>
              </div>
              {examWeights
                .filter((e) => e.isActive)
                .map((exam) => (
                  <div
                    key={exam.id}
                    className="grid grid-cols-4 sm:grid-cols-6 gap-2 py-2 text-sm border-t border-[var(--surface-container-high)]"
                  >
                    <span className="col-span-2">{exam.name}</span>
                    <span className="text-center">{exam.weight}%</span>
                    <span className="text-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    </span>
                  </div>
                ))}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 py-2 mt-2 border-t border-[var(--surface-container-high)] font-medium">
                <span className="col-span-2">Total</span>
                <span className={`text-center ${totalWeight !== 100 ? "text-red-600" : "text-green-600"}`}>
                  {totalWeight}%
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {examWeights.map((exam) => (
                <div key={exam.id} className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-lg">
                  <input
                    type="checkbox"
                    checked={exam.isActive}
                    onChange={(e) => updateExamWeight(exam.id, "isActive", e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border2)] text-primary"
                  />
                  <span className="flex-1 text-sm">{exam.name}</span>
                  <span className="text-xs text-[#94a3b8] w-8">{exam.shortName}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={exam.weight}
                    onChange={(e) => updateExamWeight(exam.id, "weight", Number(e.target.value))}
                    disabled={!exam.isActive}
                    className="w-16 px-2 py-1 text-sm border border-[var(--border2)] rounded disabled:opacity-50"
                    min={0}
                    max={100}
                  />
                  <span className="text-sm text-[var(--slate-ink)]">%</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--surface-container-high)]">
              <span className="text-sm">
                Total:
                <span className={`font-medium ml-2 ${totalWeight !== 100 ? "text-red-600" : "text-green-600"}`}>
                  {totalWeight}%
                </span>
              </span>
              {totalWeight !== 100 && <span className="text-xs text-red-600">Must equal 100%</span>}
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

const BASIS_OPTIONS: Array<{ id: TermGradeBasis["types"][number]; label: string; hint: string }> = [
  { id: "bot", label: "Beginning of Term (BOT)", hint: "The opening test of the term" },
  { id: "mid_term", label: "Mid of Term (MOT)", hint: "The mid-term examination" },
  { id: "holiday_package", label: "Holiday package (HPG)", hint: "A holiday package scored by the school" },
  { id: "eot", label: "End of Term (EOT)", hint: "The end-of-term examination" },
  { id: "ca", label: "Continuous assessment", hint: "CA1-CA4, projects and class tests" },
];

const DEFAULT_BASIS: TermGradeBasis = { types: ["bot", "mid_term", "eot"], weights: {} };

function TermGradeBasisCard() {
  const { school } = useAuth();
  const toast = useToast();
  const [basis, setBasis] = useState<TermGradeBasis>(DEFAULT_BASIS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!school?.id) return;
    let cancelled = false;
    loadSchoolSetting<TermGradeBasis | null>(school.id, TERM_GRADE_BASIS_KEY, null)
      .then((saved) => {
        if (cancelled) return;
        setBasis(parseTermGradeBasis(saved) ?? DEFAULT_BASIS);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [school?.id]);

  const toggleType = (id: TermGradeBasis["types"][number], on: boolean) => {
    setBasis((prev) => {
      const types = on ? [...new Set([...prev.types, id])] : prev.types.filter((t) => t !== id);
      return { ...prev, types };
    });
  };

  const setWeight = (id: TermGradeBasis["types"][number], weight: number) => {
    setBasis((prev) => ({ ...prev, weights: { ...prev.weights, [id]: Math.max(0, Math.min(100, weight)) } }));
  };

  const totalWeight = basis.types.reduce(
    (sum, t) => sum + (Number(basis.weights?.[t]) > 0 ? Number(basis.weights?.[t]) : 0),
    0,
  );
  const weighted = basis.types.some((t) => Number(basis.weights?.[t]) > 0);

  const save = async () => {
    if (!school?.id) return;
    if (weighted && totalWeight !== 100) {
      toast.error("Weights must total 100% — or clear every weight to count each exam equally.");
      return;
    }
    if (basis.types.length === 0) {
      toast.error("Tick at least one assessment the report card grades on.");
      return;
    }
    try {
      setSaving(true);
      await saveSchoolSetting(school.id, TERM_GRADE_BASIS_KEY, basis);
      toast.success("Term grade basis saved — new report cards will use it");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save term grade basis"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[var(--surface-container-high)] p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-[var(--t1)] mb-2 flex items-center gap-2">
        <MaterialIcon icon="rule" className="text-primary" />
        What the term grade is made of
      </h2>
      <p className="text-sm text-on-surface-variant mb-4">
        Select the assessments this school uses in its report average. For example, a secondary school can combine a
        holiday package with its mid-term mock. Leave weights blank for a simple average, or enter weights that total
        100% for a school-specific weighted average.
      </p>
      <div className="space-y-2">
        {BASIS_OPTIONS.map((option) => {
          const on = basis.types.includes(option.id);
          return (
            <div key={option.id} className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-lg">
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => toggleType(option.id, e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border2)] text-primary"
                aria-label={option.label}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--t1)]">{option.label}</p>
                <p className="text-xs text-[var(--t3)]">{option.hint}</p>
              </div>
              <input
                type="number"
                inputMode="numeric"
                value={basis.weights?.[option.id] ?? ""}
                placeholder="—"
                onChange={(e) => setWeight(option.id, Number(e.target.value))}
                disabled={!on}
                className="w-16 px-2 py-1 text-sm border border-[var(--border2)] rounded disabled:opacity-50"
                min={0}
                max={100}
                aria-label={`${option.label} weight`}
              />
              <span className="text-sm text-[var(--slate-ink)]">%</span>
            </div>
          );
        })}
      </div>
      {weighted && (
        <p className={`text-xs mt-2 ${totalWeight !== 100 ? "text-red-600" : "text-green-600"}`}>
          Weights total {totalWeight}% — must equal 100%, or clear them all to count each exam equally.
        </p>
      )}
      <button onClick={save} disabled={saving || !loaded} className="btn mt-4 w-full disabled:opacity-50">
        {saving ? "Saving..." : "Save term grade basis"}
      </button>
    </div>
  );
}

interface RowDraft {
  id: string;
  label: string;
  subjectIds: string[];
  mode: "mean" | "best";
}

const DEFAULT_LEVEL_KEY = "__default__";

function ReportRowsCard() {
  const { school } = useAuth();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const [rowsByLevel, setRowsByLevel] = useState<Record<string, RowDraft[]>>({});
  const [levelKey, setLevelKey] = useState<string>(DEFAULT_LEVEL_KEY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const levels = Array.from(new Set(classes.map((c: any) => String(c.level || "").trim()).filter(Boolean))).sort();

  useEffect(() => {
    if (!school?.id) return;
    let cancelled = false;
    loadSchoolSetting<ReportRowConfig[] | null>(school.id, REPORT_ROWS_KEY, null)
      .then((saved) => {
        if (cancelled) return;
        const parsed = parseReportRows(saved);
        const next: Record<string, RowDraft[]> = {
          [DEFAULT_LEVEL_KEY]: parsed?.default ?? [],
        };
        for (const [level, rows] of Object.entries(parsed?.levels ?? {})) next[level] = rows;
        setRowsByLevel(next);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [school?.id]);

  const rows = rowsByLevel[levelKey] ?? [];

  const updateRows = (next: RowDraft[]) => setRowsByLevel((prev) => ({ ...prev, [levelKey]: next }));

  const addRow = () =>
    updateRows([...rows, { id: `row-${Date.now()}-${rows.length}`, label: "", subjectIds: [], mode: "mean" }]);

  const removeRow = (id: string) => updateRows(rows.filter((r) => r.id !== id));

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    updateRows(next);
  };

  const patchRow = (id: string, patch: Partial<RowDraft>) =>
    updateRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const toggleSubject = (rowId: string, subjectId: string) =>
    updateRows(
      rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              subjectIds: r.subjectIds.includes(subjectId)
                ? r.subjectIds.filter((s) => s !== subjectId)
                : [...r.subjectIds, subjectId],
            }
          : r,
      ),
    );

  const save = async () => {
    if (!school?.id) return;
    for (const row of rows) {
      if (!row.label.trim() || row.subjectIds.length === 0) {
        toast.error("Every combined line needs a name and at least one subject.");
        return;
      }
    }
    try {
      setSaving(true);
      const config: Record<string, unknown> = {};
      if ((rowsByLevel[DEFAULT_LEVEL_KEY] ?? []).length > 0) config.default = rowsByLevel[DEFAULT_LEVEL_KEY];
      const levelOverrides: Record<string, RowDraft[]> = {};
      for (const [key, list] of Object.entries(rowsByLevel)) {
        if (key !== DEFAULT_LEVEL_KEY && list.length > 0) levelOverrides[key] = list;
      }
      if (Object.keys(levelOverrides).length > 0) config.levels = levelOverrides;
      await saveSchoolSetting(school.id, REPORT_ROWS_KEY, config);
      toast.success("Report card lines saved");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save report card lines"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[var(--surface-container-high)] p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-[var(--t1)] mb-2 flex items-center gap-2">
        <MaterialIcon icon="category" className="text-primary" />
        Report card lines
      </h2>
      <p className="text-sm text-on-surface-variant mb-4">
        Some subjects are taught separately but reported as one grade — lower-primary science and social studies, or SST
        with Religious Education. Combine them here and the report card prints one line per group. Subjects you leave
        out of a group keep their own line.
      </p>
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium text-[var(--t1)]" htmlFor="rows-level">
          Setting for
        </label>
        <select id="rows-level" value={levelKey} onChange={(e) => setLevelKey(e.target.value)} className="input flex-1">
          <option value={DEFAULT_LEVEL_KEY}>All classes (default)</option>
          {levels.map((level) => (
            <option key={level} value={level}>
              {level} classes
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--t3)] bg-[#f8fafc] rounded-lg p-4">
          {levelKey === DEFAULT_LEVEL_KEY
            ? "No combined lines for the whole school. Add one if teachers mark subjects separately but the report shows a single grade."
            : `${levelKey} classes follow the default above. Add an override only if this level reports differently.`}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.id} className="border border-[var(--surface-container-high)] rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={row.label}
                  onChange={(e) => patchRow(row.id, { label: e.target.value })}
                  placeholder="Line on the card, e.g. Science and Social Studies"
                  className="input flex-1"
                  aria-label="Combined line name"
                />
                <select
                  value={row.mode}
                  onChange={(e) => patchRow(row.id, { mode: e.target.value as RowDraft["mode"] })}
                  className="input w-28"
                  aria-label="How the line is graded"
                >
                  <option value="mean">Average</option>
                  <option value="best">Highest</option>
                </select>
                <button
                  type="button"
                  onClick={() => moveRow(index, -1)}
                  className="p-2 text-[var(--t3)] hover:text-[var(--t1)] disabled:opacity-30"
                  disabled={index === 0}
                  aria-label="Move line up"
                >
                  <MaterialIcon icon="arrow_upward" className="text-base" />
                </button>
                <button
                  type="button"
                  onClick={() => moveRow(index, 1)}
                  className="p-2 text-[var(--t3)] hover:text-[var(--t1)] disabled:opacity-30"
                  disabled={index === rows.length - 1}
                  aria-label="Move line down"
                >
                  <MaterialIcon icon="arrow_downward" className="text-base" />
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="p-2 text-red-500 hover:text-red-700"
                  aria-label="Remove line"
                >
                  <MaterialIcon icon="delete" className="text-base" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {subjects.map((subject: any) => {
                  const on = row.subjectIds.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => toggleSubject(row.id, subject.id)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        on
                          ? "bg-primary text-white border-primary"
                          : "bg-[var(--surface)] text-[var(--t2)] border-[var(--border2)] hover:border-primary"
                      }`}
                    >
                      {subject.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={addRow} className="btn btn-secondary flex-1">
          <MaterialIcon icon="add" className="text-base mr-1" />
          Add combined line
        </button>
        <button onClick={save} disabled={saving || !loaded} className="btn flex-1 disabled:opacity-50">
          {saving ? "Saving..." : "Save report card lines"}
        </button>
      </div>
    </div>
  );
}
