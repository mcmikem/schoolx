"use client";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";
import { logger } from "@/lib/logger";

interface SubjectOption {
  id: string;
  name: string;
  code?: string | null;
}

interface PreviewPlacement {
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  periodNumber: number;
  className: string;
  subjectName: string;
  teacherName: string;
  dayName: string;
}

interface PreviewConflict {
  classId: string;
  subjectId: string;
  className: string;
  subjectName: string;
  periodsUnplaced: number;
  reason: string;
}

interface PreviewResult {
  placements: PreviewPlacement[];
  conflicts: PreviewConflict[];
  stats: { placed: number; unplaced: number };
  slotsDefined: boolean;
  periodsPerDay: number;
}

const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export default function GenerateTimetableModal({
  isOpen,
  onClose,
  schoolId,
  academicYear,
  subjects,
  onApproved,
}: {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  academicYear: string;
  subjects: SubjectOption[];
  onApproved: () => void;
}) {
  const toast = useToast();
  const [periodsDefault, setPeriodsDefault] = useState(4);
  const [perSubject, setPerSubject] = useState<Record<string, number>>({});
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPreview(null);
      setError("");
      setPerSubject(Object.fromEntries(subjects.map((s) => [s.id, 4])));
    }
  }, [isOpen, subjects]);

  const toggleDay = (day: number) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const runPreview = async () => {
    if (days.length === 0) {
      setError("Select at least one school day.");
      return;
    }
    setPreviewLoading(true);
    setError("");
    try {
      const res = await fetch("/api/timetable/generate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          schoolId,
          academicYear,
          days,
          periodsDefault,
          periodsPerSubject: perSubject,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Preview failed");
      setPreview(json.data as PreviewResult);
      if ((json.data as PreviewResult).placements.length === 0) {
        toast.error("Nothing could be placed — see conflicts below");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Preview failed";
      setError(message);
      logger.error("[GenerateTimetable] preview failed:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const approve = async () => {
    if (!preview || preview.placements.length === 0) return;
    setApproving(true);
    setError("");
    try {
      const res = await fetch("/api/timetable/generate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          schoolId,
          academicYear,
          placements: preview.placements.map((p) => ({
            classId: p.classId,
            subjectId: p.subjectId,
            teacherId: p.teacherId,
            dayOfWeek: p.dayOfWeek,
            periodNumber: p.periodNumber,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Approval failed");
      toast.success(`Timetable approved: ${json.data.inserted} lessons saved`);
      onApproved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Approval failed";
      setError(
        message.includes("clash") ? `${message} Regenerate the preview to account for recent changes.` : message,
      );
      logger.error("[GenerateTimetable] approve failed:", err);
    } finally {
      setApproving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Auto-generate Timetable">
      <div className="space-y-5">
        {!preview && (
          <>
            <p className="text-sm text-[var(--t4)]">
              Draft a full week from teacher–subject assignments for {academicYear}. Nothing is saved until you approve
              the preview.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--t2)]">School days</label>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                      days.includes(d.value)
                        ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                        : "bg-[var(--surface)] text-[var(--t4)] border-[var(--border)]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--t2)]">Default periods / week</label>
              <input
                type="number"
                min={1}
                max={20}
                value={periodsDefault}
                onChange={(e) => setPeriodsDefault(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-28 px-3 py-2 bg-[var(--surface-container-low)] border border-[var(--border)] rounded-xl text-[var(--on-surface)]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--t2)]">Periods per subject / week</label>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                {subjects.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-[var(--t1)]">
                      {s.name} {s.code ? <span className="text-xs text-[var(--t4)]">({s.code})</span> : null}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={perSubject[s.id] ?? periodsDefault}
                      onChange={(e) =>
                        setPerSubject((prev) => ({
                          ...prev,
                          [s.id]: Math.max(0, Math.min(20, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-20 px-2 py-1 bg-[var(--surface-container-low)] border border-[var(--border)] rounded-lg text-[var(--on-surface)] text-sm"
                    />
                  </div>
                ))}
                {subjects.length === 0 && (
                  <p className="px-3 py-4 text-sm text-[var(--t4)]">No subjects found for this school.</p>
                )}
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 text-sm">
            <MaterialIcon icon="warning" className="text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {preview && (
          <>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                {preview.stats.placed} placed
              </span>
              {preview.stats.unplaced > 0 && (
                <span className="px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-semibold">
                  {preview.stats.unplaced} unplaced
                </span>
              )}
              {!preview.slotsDefined && (
                <span className="text-xs text-amber-700">No lesson slots defined — approve will be blocked.</span>
              )}
            </div>
            {preview.conflicts.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
                {preview.conflicts.map((c, i) => (
                  <p key={i} className="text-xs text-red-700">
                    <strong>
                      {c.className} · {c.subjectName}:
                    </strong>{" "}
                    {c.periodsUnplaced} period(s) unplaced — {c.reason}
                  </p>
                ))}
              </div>
            )}
            <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--surface-container-low)]">
                  <tr className="text-left text-xs uppercase text-[var(--t4)]">
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Day</th>
                    <th className="px-3 py-2">Per</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Teacher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {preview.placements.map((p, i) => (
                    <tr key={i} className="text-[var(--t1)]">
                      <td className="px-3 py-1.5 font-medium">{p.className}</td>
                      <td className="px-3 py-1.5">{p.dayName}</td>
                      <td className="px-3 py-1.5">{p.periodNumber}</td>
                      <td className="px-3 py-1.5">{p.subjectName}</td>
                      <td className="px-3 py-1.5">{p.teacherName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex gap-2 justify-end flex-wrap">
          {!preview ? (
            <Button onClick={runPreview} loading={previewLoading} disabled={subjects.length === 0}>
              <span className="inline-flex items-center gap-2">
                <MaterialIcon icon="auto_awesome" className="text-lg" /> Generate draft
              </span>
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setPreview(null)} disabled={approving}>
                Back to settings
              </Button>
              <Button variant="secondary" onClick={runPreview} loading={previewLoading} disabled={approving}>
                Refresh preview
              </Button>
              <Button onClick={approve} loading={approving} disabled={preview.placements.length === 0}>
                Approve & save ({preview.placements.length})
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
