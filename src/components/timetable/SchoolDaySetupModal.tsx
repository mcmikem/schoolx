"use client";

import { useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";
import { timeoutFallback, withTimeout } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";
import {
  SCHOOL_DAY_PRESETS,
  SCHOOL_LEVEL_LABELS,
  buildSchoolDay,
  totalLessonPeriods,
  validateSchoolDay,
  type SchoolDayConfig,
  type SchoolLevel,
} from "@/lib/timetable/uganda-day";

interface SchoolDaySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId?: string;
  /** Classes whose existing lessons should optionally be cleared. */
  classIds?: string[];
  defaultLevel?: SchoolLevel;
  onApplied: () => void;
}

const LESSON_LENGTHS = [30, 35, 40, 45, 60];

export default function SchoolDaySetupModal({
  isOpen,
  onClose,
  schoolId,
  classIds = [],
  defaultLevel = "lower_secondary",
  onApplied,
}: SchoolDaySetupModalProps) {
  const toast = useToast();
  const [level, setLevel] = useState<SchoolLevel>(defaultLevel);
  const [config, setConfig] = useState<SchoolDayConfig>(SCHOOL_DAY_PRESETS[defaultLevel]);
  const [clearLessons, setClearLessons] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const slots = useMemo(() => buildSchoolDay(config), [config]);
  const check = useMemo(() => validateSchoolDay(config), [config]);
  const lessons = totalLessonPeriods(config);
  const endTime = slots[slots.length - 1]?.end_time ?? "";
  const lessonsEnd = [...slots].reverse().find((slot) => slot.is_lesson)?.end_time ?? "";

  const update = (patch: Partial<SchoolDayConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setConfirming(false);
  };

  const choosePreset = (next: SchoolLevel) => {
    setLevel(next);
    setConfig(SCHOOL_DAY_PRESETS[next]);
    setDirty(true);
    setConfirming(false);
  };

  const handleClose = () => {
    if (saving) return;
    setConfirming(false);
    onClose();
  };

  const apply = async () => {
    if (!schoolId) {
      toast.error("School not loaded yet");
      return;
    }
    if (check.errors.length > 0) {
      toast.error(check.errors[0]);
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setSaving(true);
    try {
      const run = async (promise: PromiseLike<unknown>, label: string) => {
        const result = (await withTimeout(promise, 15000, timeoutFallback())) as {
          status?: number;
          error?: { message?: string } | null;
        };
        if (result?.status === 408) throw new Error(`${label} timed out`);
        if (result?.error) throw new Error(result.error.message || label);
      };

      await run(supabase.from("timetable_slots").delete().eq("school_id", schoolId), "Replacing the bell schedule");

      const rows = slots.map((slot) => ({
        school_id: schoolId,
        name: slot.name,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_lesson: slot.is_lesson,
        order_number: slot.order_number,
      }));

      await run(supabase.from("timetable_slots").insert(rows), "Saving the bell schedule");

      if (clearLessons && classIds.length > 0) {
        try {
          await run(supabase.from("teacher_timetable").delete().in("class_id", classIds), "Clearing old lessons");
        } catch (clearError) {
          logger.warn("Could not clear old timetable entries:", clearError);
          toast.warning("Bell schedule saved, but old lessons could not be cleared");
        }
      }

      toast.success("Bell schedule updated");
      setDirty(false);
      setConfirming(false);
      onApplied();
      onClose();
    } catch (err) {
      logger.error("Failed to apply school day:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save the bell schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="School day & bell schedule" size="lg">
      <div className="space-y-5">
        <p className="text-sm text-[var(--t3)]">
          Built to the MoES minimum standards: the day runs 08:00–17:00, eight or more lessons, a break of at most 30
          minutes, lunch of at most 60 minutes, and one hour of games or clubs at the end.
        </p>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Preset</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SCHOOL_DAY_PRESETS) as SchoolLevel[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => choosePreset(key)}
                aria-pressed={level === key}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                  level === key
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--t2)] hover:border-[var(--primary)]/40"
                }`}
              >
                {SCHOOL_LEVEL_LABELS[key]}
                <span className="mt-0.5 block text-xs font-normal text-[var(--t3)]">
                  {totalLessonPeriods(SCHOOL_DAY_PRESETS[key])} lessons · {SCHOOL_DAY_PRESETS[key].lessonMinutes} min
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              First bell
            </span>
            <input
              type="time"
              value={config.startTime}
              onChange={(e) => update({ startTime: e.target.value })}
              className="input h-10 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Lesson length
            </span>
            <select
              value={config.lessonMinutes}
              onChange={(e) => update({ lessonMinutes: Number(e.target.value) })}
              className="input h-10 text-sm"
            >
              {LESSON_LENGTHS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Assembly</span>
            <select
              value={config.assemblyMinutes}
              onChange={(e) => update({ assemblyMinutes: Number(e.target.value) })}
              className="input h-10 text-sm"
            >
              <option value={0}>None</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
              <option value={40}>40 min (weekly)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Lessons before break
            </span>
            <input
              type="number"
              min={1}
              max={5}
              value={config.lessonsBeforeBreak}
              onChange={(e) => update({ lessonsBeforeBreak: Number(e.target.value) })}
              className="input h-10 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Break (max 30)
            </span>
            <input
              type="number"
              min={0}
              max={30}
              step={5}
              value={config.breakMinutes}
              onChange={(e) => update({ breakMinutes: Number(e.target.value) })}
              className="input h-10 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Lessons before lunch
            </span>
            <input
              type="number"
              min={1}
              max={5}
              value={config.lessonsBeforeLunch}
              onChange={(e) => update({ lessonsBeforeLunch: Number(e.target.value) })}
              className="input h-10 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Lunch (max 60)
            </span>
            <input
              type="number"
              min={0}
              max={60}
              step={5}
              value={config.lunchMinutes}
              onChange={(e) => update({ lunchMinutes: Number(e.target.value) })}
              className="input h-10 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Lessons after lunch
            </span>
            <input
              type="number"
              min={0}
              max={5}
              value={config.lessonsAfterLunch}
              onChange={(e) => update({ lessonsAfterLunch: Number(e.target.value) })}
              className="input h-10 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Games / clubs
            </span>
            <select
              value={config.coCurricularMinutes}
              onChange={(e) => update({ coCurricularMinutes: Number(e.target.value) })}
              className="input h-10 text-sm"
            >
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={110}>110 min (projects)</option>
              <option value={120}>120 min</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Evening prep
            </span>
            <select
              value={config.prepMinutes}
              onChange={(e) => update({ prepMinutes: Number(e.target.value) })}
              className="input h-10 text-sm"
            >
              <option value={0}>Day school</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-container-lowest)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Preview</p>
            <p className="text-xs font-medium text-[var(--t3)]">
              {lessons} lessons · classes end {lessonsEnd} · day ends {endTime}
            </p>
          </div>
          <ol className="max-h-64 overflow-y-auto px-4 py-2">
            {slots.map((slot, index) => (
              <li
                key={`${slot.order_number}-${slot.name}`}
                className="flex items-center gap-3 border-b border-[var(--border)]/60 py-1.5 last:border-0"
              >
                <span className="w-24 shrink-0 text-xs tabular-nums text-[var(--t4)]">
                  {slot.start_time}–{slot.end_time}
                </span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    slot.is_lesson ? "bg-[var(--primary)]" : "bg-[var(--amber)]"
                  }`}
                />
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    slot.is_lesson ? "font-medium text-[var(--t1)]" : "text-[var(--t3)]"
                  }`}
                >
                  {slot.name}
                </span>
                {index === 0 && (
                  <span className="rounded-full bg-[var(--surface-container)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--t3)]">
                    Start
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>

        {check.errors.length > 0 && (
          <div className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-3">
            {check.errors.map((message) => (
              <p key={message} className="flex items-start gap-2 text-sm text-red-700">
                <MaterialIcon icon="error" className="mt-0.5 shrink-0 text-base" />
                {message}
              </p>
            ))}
          </div>
        )}
        {check.warnings.map((message) => (
          <p
            key={message}
            className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            <MaterialIcon icon="warning" className="mt-0.5 shrink-0 text-base" />
            {message}
          </p>
        ))}

        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--border)] p-3">
          <input
            type="checkbox"
            checked={clearLessons}
            onChange={(e) => setClearLessons(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-[var(--t2)]">
            Also clear existing lessons
            <span className="mt-0.5 block text-xs text-[var(--t3)]">
              Existing lessons keep the times they were saved with. Clear them if the new periods move.
            </span>
          </span>
        </label>

        {confirming && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This replaces the school&apos;s {slots.length} bell entries and removes any teacher unavailability tied to
            the old periods. Press <strong>Apply schedule</strong> again to confirm.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={apply}
            loading={saving}
            disabled={check.errors.length > 0 || (!dirty && !confirming)}
            icon={<MaterialIcon icon={confirming ? "check" : "schedule"} />}
          >
            {confirming ? "Apply schedule" : "Update bell schedule"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
