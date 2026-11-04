"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { useOfflineEvents } from "@/lib/offline-hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { Button, Modal } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/validation";
import { withTimeout, timeoutFallback, isTimeoutResult } from "@/lib/hooks/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
};

type DisplayEvent = CalendarEvent & { _builtin: boolean };

// ── Uganda public holidays (year-aware) ─────────────────────────────────────
// Fixed-date holidays keep their month/day; Easter-derived holidays are
// computed for the requested year. Approximate term dates follow the
// traditional Ugandan school calendar (Term 1 Jan–Apr, Term 2 May–Aug,
// Term 3 Sep–Dec) and are labelled with the year so they never claim to be
// authoritative beyond the published MoES/NCDC calendar.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getUgandaPublicHolidays(year: number) {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter); easterMonday.setDate(easter.getDate() + 1);
  const fmt = (d: Date) => iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return [
    { date: iso(year, 1, 1), name: "New Year's Day" },
    { date: iso(year, 1, 26), name: "Liberation Day" },
    { date: iso(year, 2, 16), name: "Archbishop Janani Luwum Day" },
    { date: iso(year, 3, 8), name: "International Women's Day" },
    { date: fmt(goodFriday), name: "Good Friday" },
    { date: fmt(easterMonday), name: "Easter Monday" },
    { date: iso(year, 5, 1), name: "Labour Day" },
    { date: iso(year, 6, 3), name: "Martyr's Day" },
    { date: iso(year, 6, 9), name: "National Heroes' Day" },
    { date: iso(year, 10, 9), name: "Independence Day" },
    { date: iso(year, 12, 25), name: "Christmas Day" },
    { date: iso(year, 12, 26), name: "Boxing Day" },
  ];
}

// ── Uganda school term dates (year-aware, approximate) ───────────────────────
function getUgandaTermDates(year: number) {
  const t = (m: number, d: number) => iso(year, m, d);
  return [
    { date: t(1, 13), name: "Term 1 Opens", type: "academic", color: "var(--secondary-600)" },
    { date: t(2, 14), name: "Term 1 Midterm Break Starts", type: "holiday", color: "var(--amber)" },
    { date: t(2, 16), name: "Term 1 Midterm Break Ends", type: "holiday", color: "var(--amber)" },
    { date: t(4, 3), name: "Term 1 Closes (EOT)", type: "academic", color: "var(--red)" },
    { date: t(5, 11), name: "Term 2 Opens", type: "academic", color: "var(--secondary-600)" },
    { date: t(6, 26), name: "Term 2 Midterm Break Starts", type: "holiday", color: "var(--amber)" },
    { date: t(6, 28), name: "Term 2 Midterm Break Ends", type: "holiday", color: "var(--amber)" },
    { date: t(8, 14), name: "Term 2 Closes (EOT)", type: "academic", color: "var(--red)" },
    { date: t(9, 7), name: "Term 3 Opens", type: "academic", color: "var(--secondary-600)" },
    { date: t(10, 19), name: "Term 3 Midterm Break Starts", type: "holiday", color: "var(--amber)" },
    { date: t(10, 21), name: "Term 3 Midterm Break Ends", type: "holiday", color: "var(--amber)" },
    { date: t(12, 5), name: "Term 3 Closes (EOT)", type: "academic", color: "var(--red)" },
  ];
}

const EVENT_COLORS: Record<string, string> = {
  holiday: "#10b981",
  academic: "#6366f1",
  exam: "#ef4444",
  meeting: "#3b82f6",
  event: "var(--amber)",
  substitution: "var(--amber)",
};

function TermCalendar({ schoolId, userId }: { schoolId: string; userId: string }) {
  const toast = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_type: "academic",
    start_date: "",
    end_date: "",
  });

  // Offline-aware events
  const {
    data: offlineEvents = [],
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useOfflineEvents(schoolId);

  useEffect(() => {
    setEvents(offlineEvents);
    setLoading(eventsLoading);
  }, [offlineEvents, eventsLoading]);

  const openAdd = () => {
    setEditingEvent(null);
    setForm({ title: "", description: "", event_type: "academic", start_date: "", end_date: "" });
    setShowModal(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      description: ev.description || "",
      event_type: ev.event_type,
      start_date: ev.start_date,
      end_date: ev.end_date || "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.start_date) {
      toast.error("Title and start date are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_type: form.event_type,
        start_date: form.start_date,
        end_date: form.end_date || null,
        created_by: userId,
      };
      if (editingEvent) {
        const result = await withTimeout(supabase.from("events").update(payload).eq("id", editingEvent.id), 15000, timeoutFallback());
        if (isTimeoutResult(result)) throw new Error("Updating the event timed out. Check your connection and try again.");
        if (result?.error) throw new Error(result.error.message || "Failed to update event");
        toast.success("Event updated");
      } else {
        const result = await withTimeout(supabase.from("events").insert(payload), 15000, timeoutFallback());
        if (isTimeoutResult(result)) throw new Error("Adding the event timed out. Check your connection and try again.");
        if (result?.error) throw new Error(result.error.message || "Failed to add event");
        toast.success("Event added");
      }
      setShowModal(false);
      refetchEvents();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save event"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteEventId) return;
    const id = pendingDeleteEventId;
    setPendingDeleteEventId(null);
    const evResult = await withTimeout(supabase.from("events").delete().eq("id", id), 15000, timeoutFallback());
    if (isTimeoutResult(evResult)) {
      toast.error("Deleting the event timed out. Check your connection and try again.");
      return;
    }
    const error = evResult?.error;
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    toast.success("Event deleted");
  };

  // Merge school events with built-in Uganda dates
  const allEvents = useMemo(() => {
    const builtIn: DisplayEvent[] = [
      ...getUgandaPublicHolidays(year).map((h) => ({
        id: `ph-${h.date}`,
        title: h.name,
        description: "Uganda Public Holiday",
        event_type: "holiday",
        start_date: h.date,
        end_date: null,
        _builtin: true,
      })),
      ...getUgandaTermDates(year).map((t) => ({
        id: `td-${t.date}`,
        title: t.name,
        description: "Uganda School Calendar 2026",
        event_type: t.type,
        start_date: t.date,
        end_date: null,
        _builtin: true,
      })),
    ];
    const school: DisplayEvent[] = events.map((e) => ({ ...e, _builtin: false }));
    return [...builtIn, ...school].sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [events]);

  // Group by month
  const byMonth = useMemo(() => {
    const months: Record<string, typeof allEvents> = {};
    for (const ev of allEvents) {
      const key = ev.start_date.slice(0, 7);
      if (!months[key]) months[key] = [];
      months[key].push(ev);
    }
    return months;
  }, [allEvents]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-UG", { month: "long", year: "numeric" });
  };

  const todayDate = new Date();
  const year = todayDate.getFullYear();
  const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

  return (
    <>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--t1)]">{`Academic Calendar ${year}`}</p>
            <p className="text-xs text-[var(--t3)]">
              Uganda public holidays, term dates, midterm breaks & school events
            </p>
          </div>
          <Button onClick={openAdd} size="sm">
            <MaterialIcon icon="add" className="text-sm" /> Add Event
          </Button>
        </div>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : (
          <div className="space-y-6">
            {Object.entries(byMonth).map(([key, monthEvents]) => (
              <div key={key}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-2 flex items-center gap-2">
                  <span className="h-px flex-1 bg-[var(--border)]" />
                  {monthLabel(key)}
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </h3>
                <div className="space-y-1.5">
                  {monthEvents.map((ev) => {
                    const isPast = ev.start_date < today;
                    const isToday = ev.start_date === today;
                    const color = EVENT_COLORS[ev.event_type] || "#6b7280";
                    return (
                      <div
                        key={ev.id}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${isToday ? "ring-2 ring-[var(--primary)]" : ""} ${isPast ? "opacity-60" : ""} bg-[var(--surface-container-low)] group`}
                      >
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[var(--t1)] leading-tight">{ev.title}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 bg-[var(--primary)] text-[var(--on-primary)] text-xs font-bold rounded uppercase tracking-wide">
                                Today
                              </span>
                            )}
                            {ev._builtin && (
                              <span className="px-1.5 py-0.5 bg-[var(--surface-container-low)] text-[var(--t3)] text-xs rounded uppercase tracking-wide">
                                Uganda Govt
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-[var(--t3)]">
                              {new Date(ev.start_date + "T00:00:00").toLocaleDateString("en-UG", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                              {ev.end_date &&
                                ev.end_date !== ev.start_date &&
                                ` – ${new Date(ev.end_date + "T00:00:00").toLocaleDateString("en-UG", { day: "numeric", month: "short" })}`}
                            </span>
                            <span
                              className="px-1.5 py-0.5 text-xs font-medium rounded capitalize"
                              style={{ background: color + "20", color }}
                            >
                              {ev.event_type}
                            </span>
                          </div>
                        </div>
                        {!ev._builtin && (
                          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(ev)}
                              aria-label={`Edit ${ev.title}`}
                              className="p-1 hover:bg-[var(--surface)] rounded text-[var(--t3)] hover:text-[var(--t1)]"
                            >
                              <MaterialIcon icon="edit" className="text-sm" />
                            </button>
                            <button
                              onClick={() => setPendingDeleteEventId(ev.id)}
                              aria-label={`Delete ${ev.title}`}
                              className="p-1 hover:bg-[var(--red-soft)] rounded text-[var(--t3)] hover:text-[var(--red-ink)]"
                            >
                              <MaterialIcon icon="delete" className="text-sm" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingEvent ? "Edit Event" : "Add Calendar Event"}
          size="md"
        >
          <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label htmlFor="event-title" className="text-xs font-medium text-[var(--t2)] mb-1 block">Event Title *</label>
                  <input
                    id="event-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="event-type" className="text-xs font-medium text-[var(--t2)] mb-1 block">Type</label>
                    <select
                      id="event-type"
                      value={form.event_type}
                      onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                      className="input w-full"
                    >
                      <option value="academic">Academic</option>
                      <option value="holiday">Holiday</option>
                      <option value="exam">Exam</option>
                      <option value="meeting">Meeting</option>
                      <option value="event">Event</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="event-start" className="text-xs font-medium text-[var(--t2)] mb-1 block">Start Date *</label>
                    <input
                      id="event-start"
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      className="input w-full"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="event-end" className="text-xs font-medium text-[var(--t2)] mb-1 block">End Date (optional)</label>
                  <input
                    type="date"
                    id="event-end"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="input w-full"
                    min={form.start_date}
                  />
                </div>
                <div>
                  <label htmlFor="event-desc" className="text-xs font-medium text-[var(--t2)] mb-1 block">Description</label>
                  <textarea
                    id="event-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="input w-full"
                    rows={2}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? "Saving…" : editingEvent ? "Update" : "Add Event"}
                  </Button>
                </div>
              </form>
        </Modal>
      </div>

      <ConfirmDialog
        isOpen={!!pendingDeleteEventId}
        onClose={() => setPendingDeleteEventId(null)}
        onConfirm={handleDelete}
        title="Delete Event"
        message="Delete this event? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}

export default TermCalendar;
