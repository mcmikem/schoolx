"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface PrintSlot {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  order_number: number;
  is_lesson?: boolean;
}

interface PrintEntry {
  day_of_week: number;
  period_number: number;
  teacher_id: string;
  room?: string | null;
  subjects?: { name?: string | null; code?: string | null } | null;
}

interface PrintDay {
  value: number;
  full: string;
}

interface TimetablePrintSheetProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName?: string;
  className?: string;
  academicYear?: string;
  termLabel?: string;
  slots: PrintSlot[];
  days: PrintDay[];
  entries: PrintEntry[];
  teacherNameById: Record<string, string>;
}

const time = (value?: string | null) => (value ? value.slice(0, 5) : "");

/**
 * Wall copy of the class timetable.
 *
 * MoES requires every class timetable to be displayed, and Ugandan schools
 * print one sheet per class for the notice board. This renders the full week
 * (including breaks) in black and white, then hands it to the browser's print
 * dialog. The rest of the page is hidden by the `@media print` rules in
 * globals.css, so the sheet prints alone.
 */
export default function TimetablePrintSheet({
  isOpen,
  onClose,
  schoolName,
  className,
  academicYear,
  termLabel,
  slots,
  days,
  entries,
  teacherNameById,
}: TimetablePrintSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const entryFor = (day: number, period: number) =>
    entries.find((entry) => entry.day_of_week === day && entry.period_number === period);
  const lessonCount = slots.filter((slot) => slot.is_lesson !== false).length;

  return createPortal(
    <div className="timetable-print-sheet fixed inset-0 z-[1200] overflow-y-auto bg-white text-slate-900">
      <div className="timetable-print-hide sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold">Print preview</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Print
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <header className="mb-4 border-b-2 border-slate-900 pb-2 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">{schoolName || "School"}</h1>
          <p className="mt-0.5 text-sm font-semibold">{className || "Class"} — Class Timetable</p>
          <p className="text-xs text-slate-600">{[academicYear, termLabel].filter(Boolean).join(" · ")}</p>
        </header>

        <table className="w-full table-fixed border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-24 border border-slate-400 bg-slate-100 px-1 py-1 text-left">Period</th>
              {days.map((day) => (
                <th key={day.value} className="border border-slate-400 bg-slate-100 px-1 py-1">
                  {day.full}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              if (slot.is_lesson === false) {
                return (
                  <tr key={slot.id}>
                    <td className="border border-slate-400 px-1 py-1 text-[10px] tabular-nums">
                      {time(slot.start_time)}–{time(slot.end_time)}
                    </td>
                    <td
                      colSpan={days.length}
                      className="border border-slate-400 bg-slate-50 px-1 py-1 text-center text-[10px] font-bold uppercase tracking-[0.2em]"
                    >
                      {slot.name}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={slot.id}>
                  <td className="border border-slate-400 px-1 py-1 align-top">
                    <p className="font-semibold">{slot.name}</p>
                    <p className="text-[10px] tabular-nums text-slate-600">
                      {time(slot.start_time)}–{time(slot.end_time)}
                    </p>
                  </td>
                  {days.map((day) => {
                    const entry = entryFor(day.value, slot.order_number);
                    return (
                      <td key={`${slot.id}-${day.value}`} className="h-14 border border-slate-400 px-1 py-1 align-top">
                        {entry && (
                          <>
                            <p className="font-semibold leading-tight">{entry.subjects?.name || "Lesson"}</p>
                            <p className="text-[10px] leading-tight">{teacherNameById[entry.teacher_id] || ""}</p>
                            {entry.room && <p className="text-[10px] leading-tight">{entry.room}</p>}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        <footer className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
          <span>Printed from SkoolMate</span>
          <span>{lessonCount} periods a day</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
