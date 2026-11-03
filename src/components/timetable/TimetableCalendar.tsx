"use client";

import { useMemo } from "react";
import { Calendar } from "@fullcalendar/react";
import { plugins } from "@fullcalendar/react/all";

interface TimetableEntry {
  id: string;
  day_of_week: number;
  subject_id?: string;
  start_time?: string | null;
  end_time?: string | null;
  room?: string | null;
  slot_id?: string;
  slots?: { start_time?: string | null; end_time?: string | null } | null;
  subjects?: { name?: string | null; code?: string | null } | null;
  classes?: { name?: string | null } | null;
}

interface TimetableSlot {
  id: string;
  start_time?: string | null;
  end_time?: string | null;
}

/** First Monday of January of the given year — a stable reference week. */
function firstMondayOfYear(year: number): Date {
  const d = new Date(year, 0, 1);
  const offset = (8 - d.getDay()) % 7; // days until next Monday (Mon=1)
  d.setDate(d.getDate() + (offset === 0 && d.getDay() !== 1 ? 7 : offset));
  if (d.getDay() !== 1) d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7));
  return d;
}

function dayToDate(dayOfWeek: number, year: number): string {
  const monday = firstMondayOfYear(year);
  const d = new Date(monday);
  d.setDate(monday.getDate() + (dayOfWeek - 1));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TimetableCalendar({
  timetable,
  slots,
}: {
  timetable: TimetableEntry[];
  slots: TimetableSlot[];
}) {
  const year = new Date().getFullYear();
  const dayToDateMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (let d = 1; d <= 7; d++) map[d] = dayToDate(d, year);
    return map;
  }, [year]);

  const events = useMemo(() => {
    return timetable
      .map((entry) => {
        const slot = entry.slots || slots.find((s) => s.id === entry.slot_id);
        const day = dayToDateMap[entry.day_of_week] || dayToDateMap[1];
        const start = entry.start_time
          ? `${day}T${entry.start_time}`
          : slot?.start_time
            ? `${day}T${slot.start_time}`
            : undefined;
        const end = entry.end_time
          ? `${day}T${entry.end_time}`
          : slot?.end_time
            ? `${day}T${slot.end_time}`
            : undefined;
        return {
          id: String(entry.id),
          title: entry.subjects?.name || entry.subject_id || "Lesson",
          start,
          end,
          extendedProps: { class: entry.classes?.name, room: entry.room },
        };
      })
      .filter((e): e is typeof e & { start: string } => Boolean(e.start));
  }, [timetable, slots, dayToDateMap]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <Calendar
        plugins={plugins}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,timeGridDay" }}
        slotMinTime="07:00:00"
        slotMaxTime="17:00:00"
        allDaySlot={false}
        weekends={false}
        events={events}
        height="auto"
        eventContent={(arg: { event: { title: string; extendedProps?: { class?: string } } }) => (
          <div className="truncate text-xs">
            <div className="font-semibold">{arg.event.title}</div>
            {arg.event.extendedProps?.class && <div className="opacity-80">{arg.event.extendedProps.class}</div>}
          </div>
        )}
      />
    </div>
  );
}
