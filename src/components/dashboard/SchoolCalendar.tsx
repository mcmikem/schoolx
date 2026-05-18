"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";

const DAYS_HEADER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function SchoolCalendar({ schoolId, userId }: { schoolId?: string, userId?: string }) {
  const [calendarEvents, setCalendarEvents] = useState<
    Array<{ id: string; title: string; start_date: string; event_type: string }>
  >([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const dayInputRef = useRef<HTMLInputElement>(null);
  const seedCalendarAttemptedRef = useRef(false);

  useEffect(() => {
    if (!schoolId) return;
    const fetchEvents = async () => {
      setEventsLoading(true);
      const monthStart = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
      const monthEnd = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 2, 0));
      const { data, error } = await supabase
        .from("events")
        .select("id, title, start_date, event_type")
        .eq("school_id", schoolId)
        .gte("start_date", monthStart)
        .lte("start_date", monthEnd)
        .order("start_date");
      if (!error && data) setCalendarEvents(data as any);
      setEventsLoading(false);
    };
    fetchEvents();
  }, [schoolId, viewDate]);

  useEffect(() => {
    if (!schoolId || eventsLoading) return;
    if (calendarEvents.length > 0) return;
    if (seedCalendarAttemptedRef.current) return;
    seedCalendarAttemptedRef.current = true;
    const seedCalendar = async () => {
      const { buildUgandaCalendarEvents } = await import("@/lib/uganda-school-calendar");
      const defaultEvents = buildUgandaCalendarEvents(schoolId, new Date().getFullYear().toString());
      const { error } = await withTimeout(
        supabase.from("events").insert(defaultEvents),
        15000,
        { data: null, error: { message: "Calendar seed timed out", name: "TimeoutError", details: "", hint: "", code: "" } } as any,
      );
      if (!error) {
        const monthStart = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
        const monthEnd = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 2, 0));
        const { data } = await supabase
          .from("events")
          .select("id, title, start_date, event_type")
          .eq("school_id", schoolId)
          .gte("start_date", monthStart)
          .lte("start_date", monthEnd)
          .order("start_date");
        if (data) setCalendarEvents(data as any);
      }
    };
    seedCalendar();
  }, [schoolId, calendarEvents.length, eventsLoading, viewDate]);

  const addCalendarEvent = async () => {
    if (!schoolId || !newEventTitle.trim() || !newEventDate) return;
    const { error } = await withTimeout(
      supabase.from("events").insert({
        school_id: schoolId,
        title: newEventTitle.trim(),
        start_date: newEventDate,
        end_date: newEventDate,
        event_type: "event",
        created_by: userId,
      }),
      15000,
      { data: null, error: { message: "Event creation timed out", name: "TimeoutError", details: "", hint: "", code: "" } } as any,
    );
    if (!error) {
      const monthStart = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
      const monthEnd = localISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 2, 0));
      const { data } = await supabase
        .from("events")
        .select("id, title, start_date, event_type")
        .eq("school_id", schoolId)
        .gte("start_date", monthStart)
        .lte("start_date", monthEnd)
        .order("start_date");
      if (data) setCalendarEvents(data as any);
      setNewEventTitle("");
      setNewEventDate("");
      setShowAddEvent(false);
    }
  };

  const todayIso = localISODate(new Date());

  const academicEvents = useMemo(() => {
    return calendarEvents.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.start_date,
      kind: e.event_type || "event",
    }));
  }, [calendarEvents]);

  const calendarYear = viewDate.getFullYear();
  const calendarMonth = viewDate.getMonth();
  const monthStartDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

  const calendarCells = useMemo(() => {
    const cells: Array<{
      day: number;
      iso: string;
      hasEvent: boolean;
      isToday: boolean;
    } | null> = [];
    for (let i = 0; i < monthStartDay; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toLocalDate(calendarYear, calendarMonth, day);
      cells.push({
        day,
        iso,
        hasEvent: academicEvents.some((event) => event.date === iso),
        isToday: iso === todayIso,
      });
    }
    return cells;
  }, [academicEvents, calendarYear, calendarMonth, monthStartDay, daysInMonth, todayIso]);

  const navMonth = (delta: number) => {
    const d = new Date(calendarYear, calendarMonth + delta, 1);
    setViewDate(d);
  };

  const eventsOnSelected = useMemo(() => {
    if (!selectedDate) return [];
    return academicEvents.filter((e) => e.date === selectedDate);
  }, [academicEvents, selectedDate]);

  return (
    <div className="overflow-hidden rounded-[30px] border border-[#d7e3f2] bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">School calendar</p>
          <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em] text-[#17325f]">
            {viewDate.toLocaleDateString("en-UG", {
              month: "long",
              year: "numeric",
            })}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#7f91aa] hover:bg-[#edf4ff] hover:text-[#17325f]"
            aria-label="Previous month"
          >
            <MaterialIcon icon="chevron_left" className="text-lg" />
          </button>
          <button
            type="button"
            onClick={() => setViewDate(new Date())}
            className="rounded-full bg-[#eef5ff] px-3 py-1 text-[10px] font-semibold text-[#42638d] hover:bg-[#dce8f5]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => navMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#7f91aa] hover:bg-[#edf4ff] hover:text-[#17325f]"
            aria-label="Next month"
          >
            <MaterialIcon icon="chevron_right" className="text-lg" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em] text-[#8ba0bc]">
        {DAYS_HEADER.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7">
        {calendarCells.map((cell, idx) =>
          cell ? (
            <button
              type="button"
              key={cell.iso}
              onClick={() => setSelectedDate(cell.iso === selectedDate ? null : cell.iso)}
              className={`relative flex items-center justify-center rounded-xl border min-h-[36px] text-center text-[11px] sm:text-xs font-semibold transition-colors ${
                cell.iso === selectedDate
                  ? "border-[#17325f] bg-[#17325f] text-white"
                  : cell.isToday
                    ? "border-[#17325f] bg-[#edf4ff] text-[#17325f]"
                    : "border-[#e7edf5] bg-[#f8fbff] text-[#5e7390]"
              } hover:border-[#aac1df] hover:bg-[#f0f6ff]`}
            >
              {cell.day}
              {cell.hasEvent && (
                <span
                  className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                    cell.iso === selectedDate
                      ? "bg-white"
                      : "bg-[#2d69a4]"
                  }`}
                />
              )}
            </button>
          ) : (
            <div key={`empty_${idx}`} />
          ),
        )}
      </div>

      {selectedDate && eventsOnSelected.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-[16px] bg-[#f0f6ff] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7f91aa]">
            {new Date(selectedDate).toLocaleDateString("en-UG", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </p>
          {eventsOnSelected.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between rounded-[12px] bg-white px-3 py-2 shadow-sm"
            >
              <p className="truncate text-sm font-semibold text-[#17325f]">
                {event.title}
              </p>
              <span className="shrink-0 rounded-full bg-[#edf4ff] px-2 py-0.5 text-[9px] font-semibold uppercase text-[#42638d]">
                {event.kind}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setShowAddEvent(!showAddEvent);
            if (!showAddEvent) {
              setNewEventDate(selectedDate || todayIso);
            }
          }}
          className="flex items-center gap-1.5 rounded-full bg-[#17325f] px-4 py-2 text-[11px] font-semibold text-white hover:opacity-90"
        >
          <MaterialIcon icon="add" className="text-[14px]" />
          Add event
        </button>
        {!showAddEvent && academicEvents.length > 0 && !selectedDate && (
          <div className="flex items-center gap-2 text-[10px] text-[#8ba0bc]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#2d69a4]" />
            {academicEvents.length} event{academicEvents.length > 1 ? "s" : ""} this month
          </div>
        )}
      </div>

      {showAddEvent && (
        <div className="mt-3 rounded-[16px] border border-[#d7e3f2] bg-[#f8fbff] p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={dayInputRef}
              type="text"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              placeholder="Event title..."
              className="min-w-0 flex-1 rounded-xl border border-[#dde6f2] bg-white px-3 py-2 text-sm text-[#17325f] outline-none focus:border-[#aac1df]"
            />
            <input
              type="date"
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              className="rounded-xl border border-[#dde6f2] bg-white px-3 py-2 text-sm text-[#17325f] outline-none focus:border-[#aac1df]"
            />
            <button
              type="button"
              onClick={addCalendarEvent}
              disabled={!newEventTitle.trim() || !newEventDate}
              className="rounded-xl bg-[#17325f] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowAddEvent(false)}
              className="rounded-xl border border-[#dde6f2] px-3 py-2 text-sm font-semibold text-[#7f91aa] hover:bg-[#edf4ff]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!selectedDate && academicEvents.length === 0 && !showAddEvent && (
        <div className="mt-4 rounded-xl border border-dashed border-[#d7e3f2] bg-white/50 p-4 text-center">
          <p className="text-xs text-[#8ba0bc]">No events scheduled for this month</p>
        </div>
      )}
    </div>
  );
}
