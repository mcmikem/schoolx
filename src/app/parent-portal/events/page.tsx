"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import { ChildSelector } from "@/components/parent-portal/ChildSelector";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";

interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
}

const TYPE_STYLES: Record<string, string> = {
  exam: "bg-amber-50 text-amber-700 border-amber-200",
  meeting: "bg-blue-50 text-blue-700 border-blue-200",
  holiday: "bg-emerald-50 text-emerald-700 border-emerald-200",
  event: "bg-violet-50 text-violet-700 border-violet-200",
  academic: "bg-sky-50 text-sky-700 border-sky-200",
  substitution: "bg-slate-100 text-slate-700 border-slate-200",
};

const TYPE_ICONS: Record<string, string> = {
  exam: "checklist",
  meeting: "groups",
  holiday: "beach_access",
  event: "celebration",
  academic: "menu_book",
  substitution: "swap_horiz",
};

function getDemoEvents(): SchoolEvent[] {
  const today = new Date();
  const iso = (daysFromToday: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysFromToday);
    return d.toISOString().split("T")[0];
  };
  return [
    {
      id: "1",
      title: "Mid-Term Exams",
      description: "Mid-term examinations for all classes. Students should revise thoroughly.",
      event_type: "exam",
      start_date: iso(7),
      end_date: iso(9),
    },
    {
      id: "2",
      title: "Parents' Visitation Day",
      description: "Parents are invited to meet teachers and review their child's progress.",
      event_type: "meeting",
      start_date: iso(14),
      end_date: null,
    },
    {
      id: "3",
      title: "School Open Day",
      description: "Tour the school, meet staff, and explore student projects.",
      event_type: "event",
      start_date: iso(21),
      end_date: null,
    },
    {
      id: "4",
      title: "End of Term Break",
      description: "School closes for the term break. Classes resume next term.",
      event_type: "holiday",
      start_date: iso(40),
      end_date: iso(48),
    },
  ];
}

function addToGroup(map: Map<string, SchoolEvent[]>, key: string, ev: SchoolEvent) {
  const list = map.get(key);
  if (list) {
    list.push(ev);
  } else {
    map.set(key, [ev]);
  }
}

export default function ParentEventsPage() {
  const { isDemo } = useAuth();
  const { selectedChild } = useParentPortal();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SchoolEvent | null>(null);

  const fetchEvents = useCallback(
    async (child: typeof selectedChild) => {
      if (!child || !child.school_id) return;
      setLoading(true);

      if (isDemo) {
        setEvents(getDemoEvents());
        setLoading(false);
        return;
      }

      const { data } = await withTimeout(
        supabase
          .from("events")
          .select("id, title, description, event_type, start_date, end_date")
          .eq("school_id", child.school_id)
          .order("start_date", { ascending: true }),
        12000,
        timeoutFallback(),
      );

      setEvents((data as SchoolEvent[]) || []);
      setLoading(false);
    },
    [isDemo],
  );

  useEffect(() => {
    if (selectedChild) fetchEvents(selectedChild);
  }, [selectedChild, fetchEvents]);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const monthKey = (date: string) => date.slice(0, 7);

  const groups = useMemo(() => {
    const map = new Map<string, SchoolEvent[]>();
    for (const ev of events) {
      addToGroup(map, monthKey(ev.start_date), ev);
      if (ev.end_date) addToGroup(map, monthKey(ev.end_date), ev);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [events]);

  const upcoming = events.filter((ev) => (ev.end_date ? ev.end_date >= today : ev.start_date >= today));
  const past = events.filter((ev) => ev.start_date < today && (ev.end_date ? ev.end_date < today : true));

  return (
    <ParentPortalShell pageTitle="Events">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader
          title="School Events"
          subtitle="Exams, meetings, holidays and activities from your child's school"
          variant="premium"
        />

        <ChildSelector />

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-[var(--surface-container)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--surface-container)] flex items-center justify-center">
              <MaterialIcon icon="event" className="text-3xl text-[var(--t3)]" />
            </div>
            <p className="text-lg font-semibold text-[var(--t1)] mb-2">No events scheduled</p>
            <p className="text-sm text-[var(--t3)]">School events will appear here once published.</p>
          </div>
        ) : (
          <>
            <section>
              <div className="flex items-center gap-2 mb-3">
                <MaterialIcon icon="upcoming" className="text-lg text-[var(--primary)]" />
                <h2 className="text-base font-black text-[var(--t1)]">Upcoming</h2>
                <span className="ml-auto text-xs font-bold text-[var(--t3)]">
                  {upcoming.length} event{upcoming.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-3">
                {upcoming.length === 0 && (
                  <div className="rounded-2xl bg-white/50 border border-white/60 p-6 text-center text-sm text-[var(--t3)]">
                    Nothing scheduled right now.
                  </div>
                )}
                {upcoming.map((ev) => {
                  const start = new Date(ev.start_date + "T00:00:00");
                  const label = ev.end_date
                    ? `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${new Date(ev.end_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${start.getFullYear()}`
                    : start.toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setSelectedEvent(ev)}
                      className="w-full text-left flex items-center gap-4 rounded-[22px] bg-white/60 border border-white/70 p-4 transition-all hover:shadow-[var(--sh2)]"
                    >
                      <div
                        className="shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center border"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <span className="text-xl font-black leading-none text-[var(--t1)]">{start.getDate()}</span>
                        <span className="text-[10px] font-bold uppercase text-[var(--t3)] mt-0.5">
                          {start.toLocaleDateString("en-GB", { month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--t1)] truncate">{ev.title}</p>
                        <p className="text-xs text-[var(--t3)] font-medium mt-0.5">{label}</p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider capitalize ${TYPE_STYLES[ev.event_type] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                      >
                        <MaterialIcon icon={TYPE_ICONS[ev.event_type] || "event"} className="text-xs" />
                        {ev.event_type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {past.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-base font-black text-[var(--t1)]">Earlier this month &amp; past events</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {groups.map(([month, monthEvents]) => (
                    <div key={month} className="rounded-[22px] bg-white/40 backdrop-blur-md border border-white/60 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--t3)] mb-2">
                        {new Date(month + "-01T00:00:00").toLocaleDateString("en-GB", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <div className="space-y-2">
                        {monthEvents.map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => setSelectedEvent(ev)}
                            className="w-full text-left flex items-center justify-between gap-3 rounded-xl bg-white/60 border border-white/70 px-3 py-2.5"
                          >
                            <span className="text-sm font-semibold text-[var(--t1)] truncate">{ev.title}</span>
                            <span className="text-[11px] text-[var(--t3)] font-medium shrink-0">
                              {new Date(ev.start_date + "T00:00:00").getDate()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {selectedEvent && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto shadow-2xl p-8 space-y-4">
              <div className="flex justify-between items-start gap-3">
                <h2 className="text-xl font-black text-[var(--t1)]">{selectedEvent.title}</h2>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 hover:bg-[var(--surface-container)] rounded-xl shrink-0"
                >
                  <MaterialIcon icon="close" />
                </button>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider capitalize ${TYPE_STYLES[selectedEvent.event_type] || ""}`}
              >
                <MaterialIcon icon={TYPE_ICONS[selectedEvent.event_type] || "event"} className="text-xs" />
                {selectedEvent.event_type}
              </span>
              <p className="text-xs font-bold text-[var(--t3)]">
                {new Date(selectedEvent.start_date + "T00:00:00").toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
                {selectedEvent.end_date &&
                  ` – ${new Date(selectedEvent.end_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`}
              </p>
              {selectedEvent.description && (
                <p className="text-sm text-[var(--t2)] leading-relaxed">{selectedEvent.description}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </ParentPortalShell>
  );
}
