"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { timeoutFallback, withTimeout } from "@/lib/hooks/utils";
import { offlineDB } from "@/lib/offline";
import { supabase } from "@/lib/supabase";

const DAYS_HEADER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function SchoolCalendar({ schoolId, userId }: { schoolId?: string; userId?: string }) {
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
  const fetchedForSchoolRef = useRef<string | null>(null);

  const refreshEvents = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await withTimeout(
      supabase
        .from("events")
        .select("id, school_id, title, start_date, event_type")
        .eq("school_id", schoolId)
        .order("start_date"),
      15000,
      timeoutFallback(),
    );
    if (!error && data) {
      setCalendarEvents(data as any);
      await offlineDB.cacheFromServer("events", data as any);
    }
  }, [schoolId]);

  // Seed instantly from the persistent IndexedDB cache so revisits render the
  // calendar without waiting on the network; the fetch effect below revalidates
  // in the background.
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    offlineDB.getAllFromCache("events", { school_id: schoolId }).then((cached) => {
      if (cancelled || cached.length === 0) return;
      setCalendarEvents(cached as any);
      setEventsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    if (fetchedForSchoolRef.current === schoolId) return;
    fetchedForSchoolRef.current = schoolId;
    const fetchEvents = async () => {
      setEventsLoading(true);
      await refreshEvents();
      setEventsLoading(false);
    };
    fetchEvents();
  }, [schoolId, refreshEvents]);

  useEffect(() => {
    if (!schoolId || eventsLoading) return;
    if (calendarEvents.length > 0) return;
    if (seedCalendarAttemptedRef.current) return;
    seedCalendarAttemptedRef.current = true;
    const seedCalendar = async () => {
      const { buildUgandaCalendarEvents } = await import("@/lib/uganda-school-calendar");
      const defaultEvents = buildUgandaCalendarEvents(schoolId, new Date().getFullYear().toString());
      const { error } = await withTimeout(supabase.from("events").insert(defaultEvents), 15000, {
        data: null,
        error: { message: "Calendar seed timed out", name: "TimeoutError", details: "", hint: "", code: "" },
      } as any);
      if (!error) await refreshEvents();
    };
    seedCalendar();
  }, [schoolId, calendarEvents.length, eventsLoading, refreshEvents]);

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
      {
        data: null,
        error: { message: "Event creation timed out", name: "TimeoutError", details: "", hint: "", code: "" },
      } as any,
    );
    if (!error) {
      await refreshEvents();
      setNewEventTitle("");
      setNewEventDate("");
      setShowAddEvent(false);
    }
  };

  const todayIso = localISODate(new Date());

  // Window around the visible month (previous, current, next) so month
  // navigation filters the full cached list instead of re-fetching from the
  // server every time.
  const visibleRange = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    return {
      start: localISODate(new Date(y, m - 1, 1)),
      end: localISODate(new Date(y, m + 2, 0)),
    };
  }, [viewDate]);

  const academicEvents = useMemo(() => {
    return calendarEvents
      .filter((e) => e.start_date >= visibleRange.start && e.start_date <= visibleRange.end)
      .map((e) => ({
        id: e.id,
        title: e.title,
        date: e.start_date,
        kind: e.event_type || "event",
      }));
  }, [calendarEvents, visibleRange]);

  const calendarYear = viewDate.getFullYear();
  const calendarMonth = viewDate.getMonth();
  const monthStartDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

  const currentMonthEvents = useMemo(() => {
    const monthStart = toLocalDate(calendarYear, calendarMonth, 1);
    const monthEnd = toLocalDate(calendarYear, calendarMonth, daysInMonth);
    return academicEvents.filter((event) => event.date >= monthStart && event.date <= monthEnd);
  }, [academicEvents, calendarYear, calendarMonth, daysInMonth]);

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
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--t3)]">School calendar</p>
          <h2 className="mt-2 font-['Sora'] text-xl font-semibold tracking-tight text-[var(--t1)]">
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
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--t3)] hover:bg-[var(--surface-container-low)] hover:text-[var(--primary)]"
            aria-label="Previous month"
          >
            <MaterialIcon icon="chevron_left" className="text-lg" />
          </button>
          <button
            type="button"
            onClick={() => setViewDate(new Date())}
            className="rounded-full bg-[var(--primary-50)] px-3 py-1 text-[10px] font-semibold text-[var(--primary)] hover:bg-[var(--primary-100)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => navMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--t3)] hover:bg-[var(--surface-container-low)] hover:text-[var(--primary)]"
            aria-label="Next month"
          >
            <MaterialIcon icon="chevron_right" className="text-lg" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--t2)] sm:text-[10px]">
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
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : cell.isToday
                    ? "border-[var(--primary)] bg-[var(--primary-50)] text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface-container-low)] text-[var(--t2)]"
              } hover:border-[var(--primary)]/40 hover:bg-[var(--primary-50)]`}
            >
              {cell.day}
              {cell.hasEvent && (
                <span
                  className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                    cell.iso === selectedDate ? "bg-white" : "bg-[var(--primary)]"
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
        <div className="mt-3 space-y-1.5 rounded-[var(--r)] bg-[var(--surface-container-low)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--t3)]">
            {new Date(selectedDate).toLocaleDateString("en-UG", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </p>
          {eventsOnSelected.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between rounded-[var(--r)] bg-[var(--surface)] px-3 py-2 shadow-[var(--sh1)]"
            >
              <p className="truncate text-sm font-semibold text-[var(--t1)]">{event.title}</p>
              <span className="shrink-0 rounded-full bg-[var(--primary-50)] px-2 py-0.5 text-[9px] font-semibold uppercase text-[var(--primary)]">
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
          className="flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[var(--primary-700)]"
        >
          <MaterialIcon icon="add" className="text-[14px]" />
          Add event
        </button>
        {!showAddEvent && currentMonthEvents.length > 0 && !selectedDate && (
          <div className="flex items-center gap-2 text-[10px] text-[var(--t3)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--primary)]" />
            {currentMonthEvents.length} event{currentMonthEvents.length > 1 ? "s" : ""} this month
          </div>
        )}
      </div>

      {showAddEvent && (
        <div className="mt-3 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface-container-low)] p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={dayInputRef}
              type="text"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              placeholder="Event title..."
              className="min-w-0 flex-1 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--t1)] outline-none focus:border-[var(--primary)]"
            />
            <input
              type="date"
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--t1)] outline-none focus:border-[var(--primary)]"
            />
            <button
              type="button"
              onClick={addCalendarEvent}
              disabled={!newEventTitle.trim() || !newEventDate}
              className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-700)] disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowAddEvent(false)}
              className="rounded-full border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--t3)] hover:bg-[var(--surface)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!selectedDate && currentMonthEvents.length === 0 && !showAddEvent && (
        <div className="mt-4 rounded-[var(--r)] border border-dashed border-[var(--border)] bg-[var(--surface-container-low)] p-4 text-center">
          <p className="text-xs text-[var(--t3)]">No events scheduled for this month</p>
        </div>
      )}
    </div>
  );
}
