"use client";
import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

/**
 * One teacher's workload: which subjects they teach in which classes.
 * Ugandan teachers routinely teach different subjects in different classes
 * (Math in P.4, English in P.5) and most are not class teachers at all, so
 * assignments are per-class rows — never one class with a flat subject list.
 */
export interface TeachingAssignment {
  class_id: string;
  subject_ids: string[];
}

interface ClassOption {
  id: string;
  name: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

/** Drop incomplete rows and duplicate (class, subject) pairs. */
export function normalizeTeachingAssignments(rows: TeachingAssignment[]): { class_id: string; subject_id: string }[] {
  const seen = new Set<string>();
  const out: { class_id: string; subject_id: string }[] = [];
  for (const row of rows) {
    if (!row.class_id || row.subject_ids.length === 0) continue;
    for (const subject_id of row.subject_ids) {
      const key = `${row.class_id}|${subject_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ class_id: row.class_id, subject_id });
    }
  }
  return out;
}

/** Human validation error, or null when the rows describe real teaching. */
export function validateTeachingAssignments(
  rows: TeachingAssignment[],
  classNameOf: (classId: string) => string,
): string | null {
  const usable = rows.filter((r) => r.class_id || r.subject_ids.length > 0);
  if (usable.length === 0) return "Add at least one class this teacher teaches, with its subjects.";
  for (const row of usable) {
    if (!row.class_id) return "Pick the class for every teaching row.";
    if (row.subject_ids.length === 0)
      return `Pick at least one subject taught in ${classNameOf(row.class_id) || "the selected class"}.`;
  }
  return null;
}

/** Group flat teacher_subjects rows back into per-class assignments. */
export function groupTeachingAssignments(
  rows: { class_id: string | null; subject_id: string }[],
): TeachingAssignment[] {
  const byClass = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.class_id) continue;
    const list = byClass.get(row.class_id) ?? [];
    if (!list.includes(row.subject_id)) list.push(row.subject_id);
    byClass.set(row.class_id, list);
  }
  return [...byClass.entries()].map(([class_id, subject_ids]) => ({ class_id, subject_ids }));
}

interface EditorProps {
  classes: ClassOption[];
  subjects: SubjectOption[];
  value: TeachingAssignment[];
  onChange: (next: TeachingAssignment[]) => void;
}

export function TeachingAssignmentsEditor({ classes, subjects, value, onChange }: EditorProps) {
  const rows = value.length > 0 ? value : [{ class_id: "", subject_ids: [] }];

  const setRow = (index: number, patch: Partial<TeachingAssignment>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };
  const toggleSubject = (index: number, subjectId: string) => {
    const current = rows[index].subject_ids;
    setRow(index, {
      subject_ids: current.includes(subjectId) ? current.filter((id) => id !== subjectId) : [...current, subjectId],
    });
  };

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="rounded-xl border border-[var(--surface-container-high)] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <select
              aria-label={`Class for teaching row ${index + 1}`}
              value={row.class_id}
              onChange={(e) => setRow(index, { class_id: e.target.value })}
              className="input flex-1"
            >
              <option value="">Select class…</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                aria-label={`Remove teaching row ${index + 1}`}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--t3)] hover:text-red-700 hover:bg-red-50 shrink-0"
              >
                <MaterialIcon icon="close" />
              </button>
            )}
          </div>
          {subjects.length === 0 ? (
            <p className="text-xs text-[var(--t3)]">
              No subjects yet — add them under{" "}
              <Link href="/dashboard/subjects" className="underline">
                Subjects
              </Link>
              {", and turn on the nursery section in Settings if this teacher handles Baby, Middle or Top Class"}.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {subjects.map((subject) => (
                <label
                  key={subject.id}
                  className="flex items-center gap-2 text-sm text-[var(--t1)] min-h-[32px] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={row.subject_ids.includes(subject.id)}
                    onChange={() => toggleSubject(index, subject.id)}
                    className="w-4 h-4 shrink-0"
                  />
                  <span className="truncate">{subject.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { class_id: "", subject_ids: [] }])}
        className="w-full min-h-[44px] rounded-xl border border-dashed border-[var(--border)] text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/5"
      >
        + Teach another class
      </button>
    </div>
  );
}
