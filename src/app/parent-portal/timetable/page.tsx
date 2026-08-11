"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import { ChildSelector } from "@/components/parent-portal/ChildSelector";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";

interface TimetableSlot {
  id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  room: string | null;
  subject_name: string;
}

const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

const DAY_SHORT: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

function getDemoTimetable(): TimetableSlot[] {
  const subjects = [
    "Mathematics",
    "English",
    "Science",
    "Social Studies",
    "Kiswahili",
    "CRE",
    "Maths",
    "Arts & Crafts",
  ];
  const slots: TimetableSlot[] = [];
  for (let day = 1; day <= 5; day += 1) {
    for (let period = 1; period <= 6; period += 1) {
      const startHour = 8 + period - 1;
      const next = startHour + 1;
      slots.push({
        id: `demo-${day}-${period}`,
        day_of_week: day,
        period_number: period,
        start_time: `${String(startHour).padStart(2, "0")}:00:00`,
        end_time: `${String(next).padStart(2, "0")}:00:00`,
        room: `R-${day}${period}`,
        subject_name: subjects[(day + period + 5) % subjects.length],
      });
    }
  }
  return slots;
}

function formatTime(raw: string): string {
  if (!raw) return "--:--";
  const [h = "0", m = "00"] = raw.split(":");
  const hour = Number(h);
  if (Number.isNaN(hour)) return raw;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${suffix}`;
}

export default function ParentTimetablePage() {
  const { isDemo } = useAuth();
  const { selectedChild } = useParentPortal();
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | "all">("all");

  const fetchTimetable = useCallback(
    async (child: typeof selectedChild) => {
      if (!child || !child.class_id) return;
      setLoading(true);

      if (isDemo) {
        setSlots(getDemoTimetable());
        setLoading(false);
        return;
      }

      const { data } = await withTimeout(
        supabase
          .from("teacher_timetable")
          .select("id, day_of_week, period_number, start_time, end_time, room, subjects(name)")
          .eq("class_id", child.class_id)
          .order("day_of_week", { ascending: true })
          .order("period_number", { ascending: true }),
        12000,
        timeoutFallback(),
      );

      const mapped: TimetableSlot[] = (data || []).map((row: any) => ({
        id: row.id,
        day_of_week: row.day_of_week,
        period_number: row.period_number,
        start_time: row.start_time,
        end_time: row.end_time,
        room: row.room ?? null,
        subject_name: row.subjects?.name || `Period ${row.period_number}`,
      }));
      setSlots(mapped);
      setLoading(false);
    },
    [isDemo],
  );

  useEffect(() => {
    if (selectedChild) fetchTimetable(selectedChild);
  }, [selectedChild, fetchTimetable]);

  const days = [1, 2, 3, 4, 5, 6];
  const visibleDays = selectedDay === "all" ? days : [selectedDay];
  const perDay = slots.reduce<Record<number, TimetableSlot[]>>((acc, slot) => {
    (acc[slot.day_of_week] = acc[slot.day_of_week] || []).push(slot);
    return acc;
  }, {});

  return (
    <ParentPortalShell pageTitle="Timetable">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader
          title="Class Timetable"
          subtitle={`Weekly lessons for ${selectedChild?.first_name || "your child"}${selectedChild?.class_name ? ` (${selectedChild.class_name})` : ""}`}
          variant="premium"
        />

        <ChildSelector label="Timetable updates when you switch" />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedDay("all")}
            className={`rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border ${
              selectedDay === "all"
                ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent"
                : "bg-white text-[var(--on-surface-variant)] border-[var(--border)]"
            }`}
          >
            All Days
          </button>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(d)}
              className={`rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border ${
                selectedDay === d
                  ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent"
                  : "bg-white text-[var(--on-surface-variant)] border-[var(--border)]"
              }`}
            >
              {DAY_SHORT[d]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-[var(--surface-container)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--surface-container)] flex items-center justify-center">
              <MaterialIcon icon="calendar_month" className="text-3xl text-[var(--t3)]" />
            </div>
            <p className="text-lg font-semibold text-[var(--t1)] mb-2">No timetable published yet</p>
            <p className="text-sm text-[var(--t3)]">
              Your child&apos;s timetable will appear here once the school publishes it.
            </p>
          </div>
        ) : (
          <div className={`grid gap-4 ${visibleDays.length > 1 ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
            {visibleDays.map((day) => {
              const daySlots = [...(perDay[day] || [])].sort((a, b) => a.period_number - b.period_number);
              return (
                <div key={day} className="rounded-[22px] bg-white/40 backdrop-blur-md border border-white/60 p-4">
                  <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/60">
                    <p className="text-sm font-black text-[var(--t1)]">{DAY_NAMES[day]}</p>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--t3)]">
                      {daySlots.length} periods
                    </span>
                  </div>
                  {daySlots.length === 0 ? (
                    <p className="text-sm text-[var(--t3)] py-6 text-center">No lessons scheduled</p>
                  ) : (
                    <div className="space-y-2">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center gap-3 rounded-2xl bg-white/70 border border-white/70 p-3"
                        >
                          <div className="shrink-0 w-12 text-center">
                            <p className="text-[10px] font-black text-[var(--primary)]">L{slot.period_number}</p>
                            <p className="text-[9px] text-[var(--t3)] font-semibold leading-tight">
                              {formatTime(slot.start_time)}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[var(--t1)] truncate">{slot.subject_name}</p>
                            <p className="text-[11px] text-[var(--t3)] font-medium">
                              {slot.room ? `${slot.room} · ` : ""}
                              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                            </p>
                          </div>
                          <MaterialIcon icon="schedule" className="text-base text-[var(--t4)]" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ParentPortalShell>
  );
}
