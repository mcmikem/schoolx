"use client";

import { useMemo } from "react";
import { Calendar } from "@fullcalendar/react";
import { plugins } from "@fullcalendar/react/all";
const DAY_TO_DATE: Record<number, string> = {
  1: "2026-01-05",
  2: "2026-01-06",
  3: "2026-01-07",
  4: "2026-01-08",
  5: "2026-01-09",
  6: "2026-01-10",
  7: "2026-01-11",
};

export default function TimetableCalendar({ timetable, slots }: { timetable: any[]; slots: any[] }) {
  const events = useMemo(() => {
    return timetable
      .map((entry) => {
        const slot = entry.slots || slots.find((s) => s.id === entry.slot_id);
        const day = DAY_TO_DATE[entry.day_of_week] || "2026-01-05";
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
      .filter((e) => e.start);
  }, [timetable, slots]);

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
        events={events as any}
        height="auto"
        eventContent={(arg: any) => (
          <div className="truncate text-xs">
            <div className="font-semibold">{arg.event.title}</div>
            {arg.event.extendedProps?.class && <div className="opacity-80">{arg.event.extendedProps.class}</div>}
          </div>
        )}
      />
    </div>
  );
}
