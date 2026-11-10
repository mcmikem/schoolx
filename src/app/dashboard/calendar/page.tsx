"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useOfflineEvents } from "@/lib/offline-hooks";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";
import { Card } from "@/components/ui/Card";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import TermTimeline from "@/components/dashboard/TermTimeline";
import { getErrorMessage } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { useClasses, useStaff } from "@/lib/hooks";
import { hasAnyRole } from "@/lib/roles";
import { expandRecurringEvents, isWithinRecurrenceLimit, type EventRecurrence } from "@/lib/calendar-event-recurrence";

interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: "exam" | "meeting" | "holiday" | "event" | "academic";
  start_date: string;
  end_date: string | null;
  start_time?: string | null;
  end_time?: string | null;
  time_zone?: string | null;
  all_day?: boolean;
  location?: string | null;
  audience: "personal" | "staff" | "school" | "parents" | "class";
  class_id?: string | null;
  responsible_user_id?: string | null;
  created_by?: string | null;
  recurrence_frequency?: EventRecurrence;
  recurrence_until?: string | null;
  occurrence_key?: string;
}

type PlannerMode = "day" | "week" | "month" | "timeline";
type EventCategory = "meetings" | "task_due" | "milestones" | "deadlines" | "personal" | "birthdays";
type CalendarScope = "school" | "academic" | "staff" | "personal";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fullWeekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const scheduleHours = Array.from({ length: 10 }, (_, i) => i + 8);

const typeColors: Record<SchoolEvent["event_type"], { bg: string; text: string; border: string }> = {
  exam: { bg: "bg-[var(--red-soft)]", text: "text-[var(--red-ink)]", border: "border-[var(--red-soft)]" },
  meeting: { bg: "bg-[var(--primary-50)]", text: "text-[var(--primary-900)]", border: "border-[var(--primary-100)]" },
  holiday: { bg: "bg-[var(--green-soft)]", text: "text-[var(--green-ink)]", border: "border-[var(--green-soft)]" },
  academic: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  event: { bg: "bg-[var(--amber-soft)]", text: "text-[var(--amber-ink)]", border: "border-[var(--amber-soft)]" },
};

const categoryByType: Record<SchoolEvent["event_type"], EventCategory> = {
  meeting: "meetings",
  event: "task_due",
  exam: "milestones",
  academic: "deadlines",
  holiday: "personal",
};

const calendarByType: Record<SchoolEvent["event_type"], CalendarScope> = {
  meeting: "staff",
  event: "school",
  exam: "academic",
  academic: "academic",
  holiday: "personal",
};

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toHourLabel(hour: number) {
  if (hour === 12) return "12 PM";
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
}

function parseClockToDecimal(value: string) {
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h + m / 60;
}

function parseDecimalToClock(value: number) {
  const whole = Math.floor(value);
  const minute = Math.round((value - whole) * 60);
  const suffix = whole >= 12 ? "PM" : "AM";
  const hour12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function deriveEventSlot(event: SchoolEvent) {
  if (!event.all_day && event.start_time && event.end_time) {
    const start = parseClockToDecimal(event.start_time.slice(0, 5));
    const end = parseClockToDecimal(event.end_time.slice(0, 5));
    if (start !== null && end !== null && end > start) {
      const boundedStart = Math.max(8, Math.min(18, start));
      const boundedEnd = Math.max(boundedStart + 0.5, Math.min(18, end));
      return {
        start: boundedStart,
        end: boundedEnd,
        label: `${parseDecimalToClock(start)} - ${parseDecimalToClock(end)}`,
      };
    }
  }
  return { start: 8, end: 9, label: "All day" };
}

function EventCard({
  evt,
  onEdit,
  onDelete,
  canManage,
  responsibleName,
}: {
  evt: SchoolEvent;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
  responsibleName?: string;
}) {
  const slot = deriveEventSlot(evt);
  const colors = typeColors[evt.event_type];
  const content = (
    <>
      <p className="truncate font-semibold">{evt.title}</p>
      <p className="mt-1 text-xs opacity-80">{slot.label}</p>
      {evt.location && <p className="mt-1 truncate text-xs opacity-80">{evt.location}</p>}
      {responsibleName && <p className="mt-1 truncate text-xs opacity-80">Responsible: {responsibleName}</p>}
    </>
  );

  return (
    <div
      className={`flex h-full w-full items-start gap-1 rounded-xl border px-2.5 py-2 text-xs shadow-sm ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {canManage ? (
        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
          aria-label={`Edit event ${evt.title}`}
        >
          {content}
        </button>
      ) : (
        <div className="min-w-0 flex-1 text-left">{content}</div>
      )}
      {canManage && (
        <button
          type="button"
          onClick={onDelete}
          className="min-h-8 min-w-8 rounded-md"
          aria-label={`Delete event ${evt.title}`}
        >
          <MaterialIcon icon="delete" className="text-sm" />
        </button>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const { school, user } = useAuth();
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const { classes = [] } = useClasses(school?.id);
  const { staff = [] } = useStaff(school?.id);
  const isSchoolAdmin = hasAnyRole(
    [user?.role, ...(user?.roles || [])],
    ["school_admin", "headmaster", "admin", "super_admin"],
  );

  const today = new Date();
  const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  const todayKey = toDateKey(today);

  const {
    data: events = [] as SchoolEvent[],
    loading,
    refetch: refetchEvents,
    supportsRecurrence,
  } = useOfflineEvents(school?.id, { userId: user?.id });

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [mode, setMode] = useState<PlannerMode>("week");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [searchQuery, setSearchQuery] = useState("");

  const [categoryFilters, setCategoryFilters] = useState<Record<EventCategory, boolean>>({
    meetings: true,
    task_due: true,
    milestones: true,
    deadlines: true,
    personal: false,
    birthdays: false,
  });

  const [calendarScopes, setCalendarScopes] = useState<Record<CalendarScope, boolean>>({
    school: true,
    academic: true,
    staff: true,
    personal: false,
  });

  const [audienceFilters, setAudienceFilters] = useState<Record<SchoolEvent["audience"], boolean>>({
    personal: true,
    staff: true,
    school: true,
    parents: true,
    class: true,
  });

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    event_type: "event" as SchoolEvent["event_type"],
    start_date: "",
    end_date: "",
    audience: "personal" as SchoolEvent["audience"],
    class_id: "",
    responsible_user_id: "",
    recurrence_frequency: "none" as EventRecurrence,
    recurrence_until: "",
    all_day: true,
    start_time: "",
    end_time: "",
    location: "",
  });

  const canManageEvent = (evt: SchoolEvent) =>
    Boolean(user?.id && (isSchoolAdmin || evt.created_by === user.id || evt.responsible_user_id === user.id));
  const responsibleName = (userId?: string | null) =>
    userId ? staff.find((member) => member.id === userId)?.full_name : undefined;
  const resetEventForm = () => {
    setEditingEventId(null);
    setNewEvent({
      title: "",
      description: "",
      event_type: "event",
      start_date: "",
      end_date: "",
      audience: "personal",
      class_id: "",
      responsible_user_id: "",
      recurrence_frequency: "none",
      recurrence_until: "",
      all_day: true,
      start_time: "",
      end_time: "",
      location: "",
    });
  };
  const openEventEditor = (evt: SchoolEvent) => {
    if (!canManageEvent(evt)) return;
    const sourceEvent = events.find((candidate) => candidate.id === evt.id) ?? evt;
    setEditingEventId(sourceEvent.id);
    setNewEvent({
      title: sourceEvent.title,
      description: sourceEvent.description || "",
      event_type: sourceEvent.event_type,
      start_date: sourceEvent.start_date,
      end_date: sourceEvent.end_date || "",
      audience: sourceEvent.audience,
      class_id: sourceEvent.class_id || "",
      responsible_user_id: sourceEvent.responsible_user_id || "",
      recurrence_frequency: sourceEvent.recurrence_frequency || "none",
      recurrence_until: sourceEvent.recurrence_until || "",
      all_day: sourceEvent.all_day !== false,
      start_time: sourceEvent.start_time?.slice(0, 5) || "",
      end_time: sourceEvent.end_time?.slice(0, 5) || "",
      location: sourceEvent.location || "",
    });
    setShowModal(true);
  };

  const eventValidationError = !newEvent.title.trim()
    ? "Add an event title to continue."
    : !newEvent.start_date
      ? "Choose a start date for the event."
      : newEvent.end_date && newEvent.end_date < newEvent.start_date
        ? "End date cannot be earlier than the start date."
        : !newEvent.all_day && (!newEvent.start_time || !newEvent.end_time)
          ? "Add both a start and end time, or mark the event as all day."
          : !newEvent.all_day && newEvent.end_time <= newEvent.start_time
            ? "End time must be after start time."
            : newEvent.audience === "class" && !newEvent.class_id
              ? "Choose the class this event is for."
              : newEvent.recurrence_frequency !== "none" && !newEvent.recurrence_until
                ? "Choose the last date for this repeating event."
                : newEvent.recurrence_frequency !== "none" && newEvent.recurrence_until <= newEvent.start_date
                  ? "The last date must be after the first occurrence."
                  : newEvent.recurrence_frequency !== "none" &&
                      !isWithinRecurrenceLimit(newEvent.start_date, newEvent.recurrence_until)
                    ? "Repeating events can run for up to five years."
                    : "";

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const calendarEvents = useMemo(() => expandRecurringEvents(events), [events]);
  const pendingDeleteEvent = events.find((evt) => evt.id === pendingDeleteId);

  const matchesFilter = (evt: SchoolEvent) => {
    const q = searchQuery.trim().toLowerCase();
    const category = categoryByType[evt.event_type];
    const scope = calendarByType[evt.event_type];
    const audience = evt.audience;

    const categoryAllowed = categoryFilters[category];
    const scopeAllowed = calendarScopes[scope];
    const audienceAllowed = audienceFilters[audience];
    const queryAllowed = !q || evt.title.toLowerCase().includes(q) || (evt.description || "").toLowerCase().includes(q);

    return categoryAllowed && scopeAllowed && audienceAllowed && queryAllowed;
  };

  const getEventsForDate = (dateStr: string): SchoolEvent[] => {
    return calendarEvents
      .filter((evt) => {
        if (evt.start_date <= dateStr && evt.end_date && evt.end_date >= dateStr) return true;
        return evt.start_date === dateStr;
      })
      .filter(matchesFilter)
      .sort((a, b) => deriveEventSlot(a).start - deriveEventSlot(b).start);
  };

  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const monthEvents = calendarEvents
    .filter((evt) => {
      const startMonth = evt.start_date.substring(0, 7);
      const endMonth = evt.end_date?.substring(0, 7);
      return startMonth === monthKey || endMonth === monthKey;
    })
    .filter(matchesFilter)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const featuredEvent = monthEvents[0];
  const upcomingEvent = calendarEvents
    .filter((evt) => evt.start_date >= todayKey)
    .filter(matchesFilter)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const selectedDateObj = new Date(`${selectedDate}T00:00:00`);
  const weekStart = new Date(selectedDateObj);
  weekStart.setDate(selectedDateObj.getDate() - selectedDateObj.getDay());

  const weekColumns = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + idx);
    const dateKey = toDateKey(date);
    return {
      date,
      dateKey,
      events: getEventsForDate(dateKey),
    };
  });

  const dayEvents = getEventsForDate(selectedDate);
  const selectedDateEvents = getEventsForDate(selectedDate);

  const statCards = [
    {
      label: "This month",
      value: String(monthEvents.length),
      note: "Filtered events",
    },
    {
      label: "This week",
      value: String(weekColumns.reduce((total, col) => total + col.events.length, 0)),
      note: "In current week strip",
    },
    {
      label: "Next up",
      value: upcomingEvent
        ? new Date(upcomingEvent.start_date).toLocaleDateString("en-UG", { month: "short", day: "numeric" })
        : "None",
      note: upcomingEvent?.title || "No future events",
    },
  ];

  const toggleCategory = (category: EventCategory) => {
    setCategoryFilters((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleCalendarScope = (scope: CalendarScope) => {
    setCalendarScopes((prev) => ({ ...prev, [scope]: !prev[scope] }));
  };

  const goPrev = () => {
    if (mode === "day") {
      const date = new Date(selectedDateObj);
      date.setDate(date.getDate() - 1);
      const key = toDateKey(date);
      setSelectedDate(key);
      setCurrentMonth(date.getMonth());
      setCurrentYear(date.getFullYear());
      return;
    }

    if (mode === "week") {
      const date = new Date(selectedDateObj);
      date.setDate(date.getDate() - 7);
      const key = toDateKey(date);
      setSelectedDate(key);
      setCurrentMonth(date.getMonth());
      setCurrentYear(date.getFullYear());
      return;
    }

    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (mode === "day") {
      const date = new Date(selectedDateObj);
      date.setDate(date.getDate() + 1);
      const key = toDateKey(date);
      setSelectedDate(key);
      setCurrentMonth(date.getMonth());
      setCurrentYear(date.getFullYear());
      return;
    }

    if (mode === "week") {
      const date = new Date(selectedDateObj);
      date.setDate(date.getDate() + 7);
      const key = toDateKey(date);
      setSelectedDate(key);
      setCurrentMonth(date.getMonth());
      setCurrentYear(date.getFullYear());
      return;
    }

    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
    setSelectedDate(toDateKey(now));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id) return;

    if (eventValidationError) {
      toast.error(eventValidationError);
      return;
    }

    const payload = {
      school_id: school.id,
      title: newEvent.title.trim(),
      description: newEvent.description.trim() || null,
      event_type: newEvent.event_type,
      audience: newEvent.audience,
      class_id: newEvent.audience === "class" ? newEvent.class_id : null,
      responsible_user_id: newEvent.responsible_user_id || null,
      all_day: newEvent.all_day,
      start_time: newEvent.all_day ? null : newEvent.start_time,
      end_time: newEvent.all_day ? null : newEvent.end_time,
      time_zone: timezoneLabel,
      location: newEvent.location.trim() || null,
      start_date: newEvent.start_date,
      end_date: newEvent.end_date || null,
      ...(supportsRecurrence === true
        ? {
            recurrence_frequency: newEvent.recurrence_frequency,
            recurrence_until: newEvent.recurrence_frequency === "none" ? null : newEvent.recurrence_until,
          }
        : {}),
    };

    try {
      if (!isOnline) {
        const original = editingEventId ? events.find((evt) => evt.id === editingEventId) : null;
        await offlineDB.save("events", {
          ...payload,
          ...(editingEventId ? { id: editingEventId } : { created_by: user?.id || null }),
          ...(original?.created_by ? { created_by: original.created_by } : {}),
        });
        setShowModal(false);
        const wasEditing = Boolean(editingEventId);
        resetEventForm();
        toast.success(
          `${wasEditing ? "Event change" : "Event"} saved on this device. It will sync when you are back online.`,
        );
        refetchEvents();
        return;
      }
      const request = editingEventId
        ? supabase.from("events").update(payload).eq("id", editingEventId)
        : supabase.from("events").insert({ ...payload, created_by: user?.id || null });
      const res = await withTimeout(request, 15000, timeoutFallback());
      if (res?.error) throw res.error;
      setShowModal(false);
      const wasEditing = Boolean(editingEventId);
      resetEventForm();
      toast.success(wasEditing ? "Event updated" : "Event added");
      refetchEvents();
    } catch (err) {
      logger.error("Error:", err);
      toast.error(getErrorMessage(err, editingEventId ? "Failed to update event" : "Failed to add event"));
    }
  };

  const deleteEvent = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      if (!isOnline) {
        await offlineDB.delete("events", id);
        toast.success("Event removed on this device. It will sync when you are back online.");
        refetchEvents();
        return;
      }
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      toast.success("Event deleted");
      refetchEvents();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete event"));
    }
  };

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1420px] relative overflow-hidden rounded-[30px] border border-[var(--border)] bg-[var(--green-soft)] p-4 sm:p-6">
          <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-[var(--surface-container-high)]/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-[var(--surface-container-high)]/60 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--green)]">School planner</p>
              <h1 className="mt-1 font-['Sora'] text-[28px] font-semibold tracking-[-0.035em] leading-tight text-[var(--t1)]">
                {mode === "week"
                  ? `${new Date(weekColumns[0].dateKey).toLocaleDateString("en-UG", { month: "short", day: "numeric" })} - ${new Date(weekColumns[6].dateKey).toLocaleDateString("en-UG", { month: "short", day: "numeric" })}`
                  : mode === "day"
                    ? new Date(selectedDate).toLocaleDateString("en-UG", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : `${months[currentMonth]} ${currentYear}`}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-[var(--border)] bg-[var(--surface)]/80 p-1">
                {(
                  [
                    ["day", "Daily"],
                    ["week", "Weekly"],
                    ["month", "Monthly"],
                    ["timeline", "Term"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${mode === key ? "bg-[var(--primary-900)] text-white" : "text-[var(--t3)] hover:text-[var(--t1)]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode !== "timeline" && (
                <>
                  <Button variant="secondary" size="sm" onClick={goPrev}>
                    <MaterialIcon icon="chevron_left" />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={goToday}>
                    Today
                  </Button>
                  <Button variant="secondary" size="sm" onClick={goNext}>
                    <MaterialIcon icon="chevron_right" />
                  </Button>
                </>
              )}

              <Button
                onClick={() => {
                  resetEventForm();
                  setShowModal(true);
                }}
              >
                <MaterialIcon icon="add" />
                Create Event
              </Button>
            </div>
          </div>

          {mode === "timeline" ? (
            <Card className="relative z-10 mt-5 min-h-[500px] p-4">
              <TermTimeline events={calendarEvents.filter(matchesFilter)} />
            </Card>
          ) : (
            <div className="relative z-10 mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[300px,1fr]">
              <aside className="space-y-4 rounded-[22px] border border-[var(--border)] bg-[var(--surface)]/90 p-4 backdrop-blur">
                <div className="rounded-xl border border-[var(--surface-container-high)] bg-[var(--surface)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <MaterialIcon icon="search" className="text-[var(--t3)]" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search events..."
                      className="w-full border-none bg-transparent text-sm text-[var(--t1)] outline-none placeholder:text-[var(--t4)]"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[var(--t3)]">
                      {months[currentMonth]} {currentYear}
                    </h2>
                    <div className="flex items-center gap-1 text-[var(--t1)]">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="tap-44 rounded-full p-1 hover:bg-[var(--surface-container)]"
                      >
                        <MaterialIcon icon="chevron_left" className="text-[18px]" />
                      </button>
                      <button
                        type="button"
                        onClick={goNext}
                        className="tap-44 rounded-full p-1 hover:bg-[var(--surface-container)]"
                      >
                        <MaterialIcon icon="chevron_right" className="text-[18px]" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-[var(--t2)]">
                    {weekDays.map((d) => (
                      <div key={d}>{d[0]}</div>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }, (_, i) => (
                      <div key={`mini-empty-${i}`} className="h-8" />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const isToday = dateStr === todayKey;
                      const isActive = dateStr === selectedDate;
                      const hasEvent = getEventsForDate(dateStr).length > 0;

                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setNewEvent((n) => ({ ...n, start_date: dateStr }));
                          }}
                          className={`relative h-8 rounded-lg text-xs font-semibold transition-all ${isActive ? "bg-[var(--primary-900)] text-white" : isToday ? "bg-[var(--surface-container)] text-[var(--t1)]" : "text-[var(--t1)] hover:bg-[var(--surface-container-low)]"}`}
                        >
                          {day}
                          {hasEvent && (
                            <span
                              className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isActive ? "bg-[var(--surface)]" : "bg-[var(--primary-700)]"}`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl bg-[var(--green-ink)] p-4 text-white shadow-lg">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/75">Meeting reminder</p>
                  {featuredEvent ? (
                    <>
                      <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] leading-tight">
                        {featuredEvent.title}
                      </h3>
                      <p className="mt-1 text-xs text-white/80">{deriveEventSlot(featuredEvent).label}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-white/85">No events scheduled this month yet.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--surface-container-high)] bg-[var(--surface)] p-4">
                  <h3 className="text-sm font-bold text-[var(--t3)]">Filters</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {(
                      [
                        ["meetings", "Meetings"],
                        ["task_due", "Task Due Dates"],
                        ["milestones", "Milestones"],
                        ["deadlines", "Deadlines"],
                        ["personal", "Personal Events"],
                        ["birthdays", "Birthdays"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCategory(key)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--surface-container-low)]"
                      >
                        <span className="text-[var(--t3)]">{label}</span>
                        <span
                          className={`h-4 w-4 rounded border ${categoryFilters[key] ? "border-[var(--primary-700)] bg-[var(--primary-700)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
                        >
                          {categoryFilters[key] && <MaterialIcon icon="check" className="text-[12px] text-white" />}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--surface-container-high)] bg-[var(--surface)] p-4">
                  <h3 className="text-sm font-bold text-[var(--t3)]">Audience</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {(
                      [
                        ["personal", "Personal"],
                        ["staff", "Staff"],
                        ["school", "School-wide"],
                        ["parents", "Parents"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setAudienceFilters((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
                        }
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--surface-container-low)]"
                      >
                        <span className="text-[var(--t3)]">{label}</span>
                        <span
                          className={`h-4 w-4 rounded border ${audienceFilters[key] ? "border-[var(--primary-700)] bg-[var(--primary-700)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
                        >
                          {audienceFilters[key] && <MaterialIcon icon="check" className="text-[12px] text-white" />}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--surface-container-high)] bg-[var(--surface)] p-4">
                  <h3 className="text-sm font-bold text-[var(--t3)]">Other Calendars</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {(
                      [
                        ["school", "School Calendar"],
                        ["academic", "Academic Calendar"],
                        ["staff", "Staff Calendar"],
                        ["personal", "Personal Calendar"],
                      ] as const
                    ).map(([scope, label]) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => toggleCalendarScope(scope)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 transition ${calendarScopes[scope] ? "bg-[var(--surface-container)] text-[var(--t1)]" : "text-[var(--t3)] hover:bg-[var(--surface-container-low)]"}`}
                      >
                        <span>{label}</span>
                        <MaterialIcon
                          icon={calendarScopes[scope] ? "check_circle" : "radio_button_unchecked"}
                          className="text-[16px]"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-bright)] p-4">
                  <h3 className="text-sm font-bold text-[var(--t3)]">Snapshot</h3>
                  <div className="mt-3 space-y-2">
                    {statCards.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                      >
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--t2)]">{stat.label}</p>
                        <p className="mt-1 text-base font-semibold text-[var(--t1)]">{stat.value}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--t2)]">{stat.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              <section className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-[0_14px_28px_rgba(10,46,64,0.06)]">
                <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-bright)] px-3 py-2">
                  <div className="flex items-center gap-2 text-[var(--t1)]">
                    <MaterialIcon icon="today" className="text-[16px]" />
                    <p className="text-sm font-semibold">
                      {new Date(selectedDate).toLocaleDateString("en-UG", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="text-xs font-medium text-[var(--t3)]">
                    {mode === "day" ? "Daily lane" : mode === "week" ? "Weekly lane" : "Monthly lane"}
                  </p>
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--t3)]">{timezoneLabel}</p>
                  <p className="text-xs text-[var(--t1)]">Click any event to delete</p>
                </div>

                {(mode === "week" || mode === "day") && (
                  <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-bright)] p-2">
                    <div
                      className={`grid min-w-[860px] gap-2 ${mode === "week" ? "grid-cols-[64px_repeat(7,minmax(110px,1fr))]" : "grid-cols-[64px_minmax(260px,1fr)]"}`}
                    >
                      <div />
                      {(mode === "week"
                        ? weekColumns
                        : [{ date: selectedDateObj, dateKey: selectedDate, events: dayEvents }]
                      ).map(({ date, dateKey }) => {
                        const isCurrent = dateKey === selectedDate;
                        return (
                          <button
                            key={`head-${dateKey}`}
                            type="button"
                            onClick={() => setSelectedDate(dateKey)}
                            className={`rounded-xl border px-2 py-2 text-left transition ${isCurrent ? "border-[var(--border)] bg-[var(--surface-container)]" : "border-[var(--surface-container-high)] bg-[var(--surface)]"}`}
                          >
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--t3)]">
                              {fullWeekDays[date.getDay()]}
                            </p>
                            <p className="mt-1 text-xl font-semibold text-[var(--t1)]">{date.getDate()}</p>
                          </button>
                        );
                      })}

                      <div className="relative h-[640px] rounded-xl bg-[var(--surface-bright)]">
                        {scheduleHours.map((hour) => (
                          <div
                            key={`time-${hour}`}
                            className="absolute left-0 right-0 text-xs text-[var(--t2)]"
                            style={{ top: `${(hour - 8) * 64}px` }}
                          >
                            {toHourLabel(hour)}
                          </div>
                        ))}
                      </div>

                      {(mode === "week"
                        ? weekColumns
                        : [{ date: selectedDateObj, dateKey: selectedDate, events: dayEvents }]
                      ).map(({ dateKey, events: dayColEvents }) => (
                        <div
                          key={`col-${dateKey}`}
                          className="relative h-[640px] rounded-xl border border-[var(--surface-container-high)] bg-[var(--surface)]"
                        >
                          {scheduleHours.map((hour) => (
                            <div
                              key={`line-${dateKey}-${hour}`}
                              className="absolute left-0 right-0 border-t border-dashed border-[var(--border)]"
                              style={{ top: `${(hour - 8) * 64}px` }}
                            />
                          ))}

                          {dayColEvents.map((evt) => {
                            const slot = deriveEventSlot(evt);
                            const top = (slot.start - 8) * 64 + 4;
                            const height = Math.max(52, (slot.end - slot.start) * 64 - 8);
                            return (
                              <div
                                key={`${evt.id}-${evt.occurrence_key ?? evt.start_date}`}
                                className="absolute left-1 right-1"
                                style={{ top: `${top}px`, height: `${height}px` }}
                              >
                                <EventCard
                                  evt={evt}
                                  canManage={canManageEvent(evt)}
                                  responsibleName={responsibleName(evt.responsible_user_id)}
                                  onEdit={() => openEventEditor(evt)}
                                  onDelete={() => setPendingDeleteId(evt.id)}
                                />
                              </div>
                            );
                          })}

                          {dayColEvents.length === 0 && (
                            <p className="absolute left-0 right-0 top-24 text-center text-xs text-[var(--t2)]">
                              No events
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mode === "month" && (
                  <div>
                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-[0.08em] text-[var(--t2)]">
                      {weekDays.map((d) => (
                        <div key={`month-head-${d}`}>{d}</div>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-2">
                      {Array.from({ length: firstDay }, (_, i) => (
                        <div
                          key={`month-empty-${i}`}
                          className="h-28 rounded-xl border border-[var(--border)] bg-[var(--surface-bright)]"
                        />
                      ))}
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const eventsForDay = getEventsForDate(dateStr);
                        const isActive = dateStr === selectedDate;
                        const isToday = dateStr === todayKey;

                        return (
                          <button
                            key={`month-day-${day}`}
                            type="button"
                            onClick={() => setSelectedDate(dateStr)}
                            className={`h-28 rounded-xl border p-2 text-left transition ${isActive ? "border-[var(--border)] bg-[var(--surface-container)]" : "border-[var(--surface-container-high)] bg-[var(--surface)] hover:border-[var(--border)]"}`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs font-bold ${isToday ? "text-[var(--primary)]" : "text-[var(--t1)]"}`}
                              >
                                {day}
                              </span>
                              <span className="text-xs text-[var(--t4)]">{eventsForDay.length}</span>
                            </div>
                            <div className="mt-2 space-y-1">
                              {eventsForDay.slice(0, 2).map((evt) => (
                                <div
                                  key={`pill-${evt.id}-${evt.occurrence_key ?? evt.start_date}`}
                                  className={`truncate rounded px-1.5 py-0.5 text-xs ${typeColors[evt.event_type].bg} ${typeColors[evt.event_type].text}`}
                                >
                                  {evt.title}
                                </div>
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-bright)] p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--t3)]">Selected date</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--t1)]">
                    {new Date(selectedDate).toLocaleDateString("en-UG", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <div className="mt-2 space-y-2">
                    {selectedDateEvents.length === 0 ? (
                      <p className="text-sm text-[var(--t2)]">No events on this date.</p>
                    ) : (
                      selectedDateEvents.map((evt) => (
                        <div
                          key={`selected-${evt.id}-${evt.occurrence_key ?? evt.start_date}`}
                          className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                        >
                          <button
                            type="button"
                            className="min-w-0 text-left"
                            onClick={() => openEventEditor(evt)}
                            disabled={!canManageEvent(evt)}
                            aria-label={`${canManageEvent(evt) ? "Edit" : "Event"} ${evt.title}`}
                          >
                            <p className="truncate text-sm font-semibold text-[var(--t3)]">{evt.title}</p>
                            <p className="text-xs capitalize text-[var(--t1)]">
                              {evt.event_type} • {deriveEventSlot(evt).label}
                            </p>
                            {responsibleName(evt.responsible_user_id) && (
                              <p className="text-xs text-[var(--t2)]">
                                Responsible: {responsibleName(evt.responsible_user_id)}
                              </p>
                            )}
                          </button>
                          {canManageEvent(evt) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDeleteId(evt.id)}
                              aria-label={`Delete event ${evt.title}`}
                            >
                              <MaterialIcon icon="delete" style={{ fontSize: 16 }} />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {loading && <p className="mt-3 text-xs text-[var(--t2)]">Refreshing events...</p>}
              </section>
            </div>
          )}
        </div>

        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4"
            onClick={() => setShowModal(false)}
          >
            <div
              className="w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-[var(--surface)] my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-[var(--surface-container-high)] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[var(--t1)]">
                    {editingEventId
                      ? newEvent.recurrence_frequency === "none"
                        ? "Edit Event"
                        : "Edit Event Series"
                      : "Add Event"}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                    <MaterialIcon icon="close" />
                  </Button>
                </div>
              </div>
              <form onSubmit={handleAddEvent} className="space-y-4 p-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--t1)]">Event Title</label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--t1)]">Event Type</label>
                  <select
                    value={newEvent.event_type}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, event_type: e.target.value as SchoolEvent["event_type"] })
                    }
                    className="input"
                  >
                    <option value="event">Event</option>
                    <option value="exam">Exam</option>
                    <option value="meeting">Meeting</option>
                    <option value="holiday">Holiday</option>
                    <option value="academic">Academic</option>
                  </select>
                  <label className="mb-2 block text-sm font-medium text-[var(--t1)]">Audience</label>
                  <select
                    value={newEvent.audience}
                    onChange={(e) => setNewEvent({ ...newEvent, audience: e.target.value as SchoolEvent["audience"] })}
                    className="input"
                  >
                    <option value="personal">Personal reminder (only me)</option>
                    <option value="staff">All staff</option>
                    <option value="school">Whole school</option>
                    <option value="parents">Communicate to all parents</option>
                    <option value="class">Selected class</option>
                  </select>
                </div>
                {newEvent.audience === "class" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--t1)]">Class</label>
                    <select
                      value={newEvent.class_id}
                      onChange={(e) => setNewEvent({ ...newEvent, class_id: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">Choose a class</option>
                      {classes.map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>
                          {classItem.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="event-responsible" className="mb-2 block text-sm font-medium text-[var(--t1)]">
                    Responsible staff member (optional)
                  </label>
                  <select
                    id="event-responsible"
                    value={newEvent.responsible_user_id}
                    onChange={(e) => setNewEvent({ ...newEvent, responsible_user_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Unassigned</option>
                    {staff
                      .filter(
                        (member) =>
                          isSchoolAdmin || member.id === user?.id || member.id === newEvent.responsible_user_id,
                      )
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.full_name}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--t2)]">
                    The assigned person can update or cancel this event. Only school administrators can assign another
                    staff member.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--t1)]">Start Date</label>
                    <input
                      type="date"
                      value={newEvent.start_date}
                      onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--t1)]">End Date (Optional)</label>
                    <input
                      type="date"
                      value={newEvent.end_date}
                      onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                {supportsRecurrence === true ? (
                  <div>
                    <label htmlFor="event-repeat" className="mb-2 block text-sm font-medium text-[var(--t1)]">
                      Repeat
                    </label>
                    <select
                      id="event-repeat"
                      value={newEvent.recurrence_frequency}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, recurrence_frequency: e.target.value as EventRecurrence })
                      }
                      className="input"
                    >
                      <option value="none">Does not repeat</option>
                      <option value="weekly">Every week</option>
                      <option value="monthly">Every month</option>
                    </select>
                    {newEvent.recurrence_frequency !== "none" && (
                      <div className="mt-3">
                        <label htmlFor="event-repeat-until" className="mb-2 block text-sm font-medium text-[var(--t1)]">
                          Repeat until (inclusive)
                        </label>
                        <input
                          id="event-repeat-until"
                          type="date"
                          min={newEvent.start_date || undefined}
                          value={newEvent.recurrence_until}
                          onChange={(e) => setNewEvent({ ...newEvent, recurrence_until: e.target.value })}
                          className="input"
                          required
                        />
                        <p className="mt-1 text-xs text-[var(--t2)]">
                          {newEvent.recurrence_frequency === "weekly"
                            ? "Repeats on the same weekday. Editing or deleting changes the whole series."
                            : "Repeats on the same date each month (or that month’s last day). Editing or deleting changes the whole series."}
                        </p>
                      </div>
                    )}
                  </div>
                ) : supportsRecurrence === false ? (
                  <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-bright)] p-3 text-xs text-[var(--t2)]">
                    Repeating events will be available after the school calendar update is applied.
                  </p>
                ) : null}
                <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-[var(--t1)]">
                  <input
                    type="checkbox"
                    checked={newEvent.all_day}
                    onChange={(e) => setNewEvent({ ...newEvent, all_day: e.target.checked })}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  All-day event
                </label>
                {!newEvent.all_day && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--t1)]">
                        Start time ({timezoneLabel})
                      </label>
                      <input
                        type="time"
                        value={newEvent.start_time}
                        onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--t1)]">
                        End time ({timezoneLabel})
                      </label>
                      <input
                        type="time"
                        value={newEvent.end_time}
                        onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                        className="input"
                        required
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--t1)]">Location (Optional)</label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="input"
                    maxLength={160}
                    placeholder="e.g. Staff room or Main hall"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--t1)]">Description (Optional)</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="input min-h-[80px]"
                    placeholder="Add any extra details for the selected audience"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="flex-1" type="submit" disabled={Boolean(eventValidationError)}>
                    {editingEventId ? "Save changes" : "Add Event"}
                  </Button>
                </div>
                {eventValidationError && <p className="text-sm text-[var(--t3)]">{eventValidationError}</p>}
              </form>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={deleteEvent}
        title={
          pendingDeleteEvent?.recurrence_frequency && pendingDeleteEvent.recurrence_frequency !== "none"
            ? "Delete Event Series"
            : "Delete Event"
        }
        message={
          pendingDeleteEvent?.recurrence_frequency && pendingDeleteEvent.recurrence_frequency !== "none"
            ? "Delete every occurrence in this event series? This action cannot be undone."
            : "Delete this event? This action cannot be undone."
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </PageErrorBoundary>
  );
}
