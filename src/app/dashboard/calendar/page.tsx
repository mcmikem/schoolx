"use client"
import { PageErrorBoundary } from "@/components/PageErrorBoundary"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { useOfflineEvents } from "@/lib/offline-hooks"
import { useToast } from "@/components/Toast"
import MaterialIcon from "@/components/MaterialIcon"
import { Button } from "@/components/ui/index"
import { Card } from "@/components/ui/Card"
import TermTimeline from "@/components/dashboard/TermTimeline"
import { getErrorMessage } from "@/lib/validation"
import { logger } from "@/lib/logger"
import { ConfirmDialog } from "@/components/ConfirmDialog"

interface SchoolEvent {
  id: string
  title: string
  description: string | null
  event_type: "exam" | "meeting" | "holiday" | "event" | "academic"
  start_date: string
  end_date: string | null
}

type PlannerMode = "day" | "week" | "month" | "timeline"
type EventCategory = "meetings" | "task_due" | "milestones" | "deadlines" | "personal" | "birthdays"
type CalendarScope = "school" | "academic" | "staff" | "personal"

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const fullWeekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const scheduleHours = Array.from({ length: 10 }, (_, i) => i + 8)

const typeColors: Record<SchoolEvent["event_type"], { bg: string; text: string; border: string }> = {
  exam: { bg: "bg-[#fef2f2]", text: "text-[#ba1a1a]", border: "border-[#f7c7c7]" },
  meeting: { bg: "bg-[#e3f2fd]", text: "text-[#002045]", border: "border-[#b7daf8]" },
  holiday: { bg: "bg-[#e8f5e9]", text: "text-[#006e1c]", border: "border-[#b8dfbf]" },
  academic: { bg: "bg-[#f3e5f5]", text: "text-[#7b1fa2]", border: "border-[#dfc1ea]" },
  event: { bg: "bg-[#fff3e0]", text: "text-[#b86e00]", border: "border-[#f3d6a7]" },
}

const categoryByType: Record<SchoolEvent["event_type"], EventCategory> = {
  meeting: "meetings",
  event: "task_due",
  exam: "milestones",
  academic: "deadlines",
  holiday: "personal",
}

const calendarByType: Record<SchoolEvent["event_type"], CalendarScope> = {
  meeting: "staff",
  event: "school",
  exam: "academic",
  academic: "academic",
  holiday: "personal",
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function toHourLabel(hour: number) {
  if (hour === 12) return "12 PM"
  if (hour > 12) return `${hour - 12} PM`
  return `${hour} AM`
}

function parseClockToDecimal(value: string) {
  const [hRaw, mRaw] = value.split(":")
  const h = Number(hRaw)
  const m = Number(mRaw)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h + m / 60
}

function parseDecimalToClock(value: number) {
  const whole = Math.floor(value)
  const minute = Math.round((value - whole) * 60)
  const suffix = whole >= 12 ? "PM" : "AM"
  const hour12 = whole % 12 === 0 ? 12 : whole % 12
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`
}

function deriveEventSlot(event: SchoolEvent) {
  const source = `${event.title} ${event.description || ""}`
  const explicit = source.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
  if (explicit) {
    const start = parseClockToDecimal(explicit[1])
    const end = parseClockToDecimal(explicit[2])
    if (start !== null && end !== null && end > start) {
      const boundedStart = Math.max(8, Math.min(18, start))
      const boundedEnd = Math.max(boundedStart + 0.5, Math.min(18, end))
      return {
        start: boundedStart,
        end: boundedEnd,
        label: `${parseDecimalToClock(boundedStart)} - ${parseDecimalToClock(boundedEnd)}`,
      }
    }
  }

  const hash = event.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const quarter = [0, 0.25, 0.5][hash % 3]
  const baseHour = 8 + (hash % 8)
  const durationByType: Record<SchoolEvent["event_type"], number> = {
    meeting: 1,
    event: 1.25,
    exam: 1.5,
    academic: 1,
    holiday: 3,
  }

  const start = Math.max(8, Math.min(17, baseHour + quarter))
  const end = Math.min(18, start + durationByType[event.event_type])

  return {
    start,
    end,
    label: `${parseDecimalToClock(start)} - ${parseDecimalToClock(end)}`,
  }
}

function EventCard({ evt, onDelete }: { evt: SchoolEvent; onDelete: () => void }) {
  const slot = deriveEventSlot(evt)
  const colors = typeColors[evt.event_type]
  const avatarCount = 2 + (evt.id.charCodeAt(0) % 3)

  return (
    <button
      type="button"
      onClick={onDelete}
      className={`w-full rounded-xl border px-2.5 py-2 text-left text-xs shadow-sm transition hover:scale-[1.01] ${colors.bg} ${colors.text} ${colors.border}`}
      title="Click to delete"
    >
      <p className="truncate font-semibold">{evt.title}</p>
      <p className="mt-1 text-[10px] opacity-80">{slot.label}</p>
      <div className="mt-1.5 flex -space-x-1">
        {Array.from({ length: avatarCount }, (_, i) => (
          <span key={`${evt.id}-${i}`} className="h-4 w-4 rounded-full border border-white/90 bg-white/80" />
        ))}
      </div>
    </button>
  )
}

export default function CalendarPage() {
  const { school } = useAuth()
  const toast = useToast()

  const today = new Date()
  const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local"
  const todayKey = toDateKey(today)

  const {
    data: events = [] as SchoolEvent[],
    loading,
    refetch: refetchEvents,
  } = useOfflineEvents(school?.id)

  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [mode, setMode] = useState<PlannerMode>("week")
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [searchQuery, setSearchQuery] = useState("")

  const [categoryFilters, setCategoryFilters] = useState<Record<EventCategory, boolean>>({
    meetings: true,
    task_due: true,
    milestones: true,
    deadlines: true,
    personal: false,
    birthdays: false,
  })

  const [calendarScopes, setCalendarScopes] = useState<Record<CalendarScope, boolean>>({
    school: true,
    academic: true,
    staff: true,
    personal: false,
  })

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    event_type: "event" as SchoolEvent["event_type"],
    start_date: "",
    end_date: "",
  })

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()

  const matchesFilter = (evt: SchoolEvent) => {
    const q = searchQuery.trim().toLowerCase()
    const category = categoryByType[evt.event_type]
    const scope = calendarByType[evt.event_type]

    const categoryAllowed = categoryFilters[category]
    const scopeAllowed = calendarScopes[scope]
    const queryAllowed = !q || evt.title.toLowerCase().includes(q) || (evt.description || "").toLowerCase().includes(q)

    return categoryAllowed && scopeAllowed && queryAllowed
  }

  const getEventsForDate = (dateStr: string): SchoolEvent[] => {
    return events
      .filter((evt) => {
        if (evt.start_date <= dateStr && evt.end_date && evt.end_date >= dateStr) return true
        return evt.start_date === dateStr
      })
      .filter(matchesFilter)
      .sort((a, b) => deriveEventSlot(a).start - deriveEventSlot(b).start)
  }

  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`
  const monthEvents = events
    .filter((evt) => {
      const startMonth = evt.start_date.substring(0, 7)
      const endMonth = evt.end_date?.substring(0, 7)
      return startMonth === monthKey || endMonth === monthKey
    })
    .filter(matchesFilter)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const featuredEvent = monthEvents[0]
  const upcomingEvent = events
    .filter((evt) => evt.start_date >= todayKey)
    .filter(matchesFilter)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]

  const selectedDateObj = new Date(`${selectedDate}T00:00:00`)
  const weekStart = new Date(selectedDateObj)
  weekStart.setDate(selectedDateObj.getDate() - selectedDateObj.getDay())

  const weekColumns = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + idx)
    const dateKey = toDateKey(date)
    return {
      date,
      dateKey,
      events: getEventsForDate(dateKey),
    }
  })

  const dayEvents = getEventsForDate(selectedDate)
  const selectedDateEvents = getEventsForDate(selectedDate)

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
      value: upcomingEvent ? new Date(upcomingEvent.start_date).toLocaleDateString("en-UG", { month: "short", day: "numeric" }) : "None",
      note: upcomingEvent?.title || "No future events",
    },
  ]

  const toggleCategory = (category: EventCategory) => {
    setCategoryFilters((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  const toggleCalendarScope = (scope: CalendarScope) => {
    setCalendarScopes((prev) => ({ ...prev, [scope]: !prev[scope] }))
  }

  const goPrev = () => {
    if (mode === "day") {
      const date = new Date(selectedDateObj)
      date.setDate(date.getDate() - 1)
      const key = toDateKey(date)
      setSelectedDate(key)
      setCurrentMonth(date.getMonth())
      setCurrentYear(date.getFullYear())
      return
    }

    if (mode === "week") {
      const date = new Date(selectedDateObj)
      date.setDate(date.getDate() - 7)
      const key = toDateKey(date)
      setSelectedDate(key)
      setCurrentMonth(date.getMonth())
      setCurrentYear(date.getFullYear())
      return
    }

    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const goNext = () => {
    if (mode === "day") {
      const date = new Date(selectedDateObj)
      date.setDate(date.getDate() + 1)
      const key = toDateKey(date)
      setSelectedDate(key)
      setCurrentMonth(date.getMonth())
      setCurrentYear(date.getFullYear())
      return
    }

    if (mode === "week") {
      const date = new Date(selectedDateObj)
      date.setDate(date.getDate() + 7)
      const key = toDateKey(date)
      setSelectedDate(key)
      setCurrentMonth(date.getMonth())
      setCurrentYear(date.getFullYear())
      return
    }

    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const goToday = () => {
    const now = new Date()
    setCurrentMonth(now.getMonth())
    setCurrentYear(now.getFullYear())
    setSelectedDate(toDateKey(now))
  }

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    if (!newEvent.title.trim()) {
      toast.error("Event title is required")
      return
    }

    if (!newEvent.start_date) {
      toast.error("Start date is required")
      return
    }

    if (newEvent.end_date && newEvent.end_date < newEvent.start_date) {
      toast.error("End date cannot be earlier than the start date")
      return
    }

    try {
      const { error } = await supabase.from("events").insert({
        school_id: school.id,
        title: newEvent.title.trim(),
        description: newEvent.description.trim() || null,
        event_type: newEvent.event_type,
        start_date: newEvent.start_date,
        end_date: newEvent.end_date || null,
      })
      if (error) throw error
      setShowModal(false)
      setNewEvent({ title: "", description: "", event_type: "event", start_date: "", end_date: "" })
      toast.success("Event added")
      refetchEvents()
    } catch (err) {
      logger.error("Error:", err)
      toast.error(getErrorMessage(err, "Failed to add event"))
    }
  }

  const deleteEvent = async () => {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    try {
      const { error } = await supabase.from("events").delete().eq("id", id)
      if (error) throw error
      toast.success("Event deleted")
      refetchEvents()
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete event"))
    }
  }

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1420px] relative overflow-hidden rounded-[30px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-4 sm:p-6">
          <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-[#b7dfd8]/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-[#d8e9fb]/60 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#4a7f76]">School planner</p>
              <h1 className="mt-1 font-['Sora'] text-[28px] font-semibold tracking-[-0.035em] leading-tight text-[#19344a]">
                {mode === "week"
                  ? `${new Date(weekColumns[0].dateKey).toLocaleDateString("en-UG", { month: "short", day: "numeric" })} - ${new Date(weekColumns[6].dateKey).toLocaleDateString("en-UG", { month: "short", day: "numeric" })}`
                  : mode === "day"
                    ? new Date(selectedDate).toLocaleDateString("en-UG", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                    : `${months[currentMonth]} ${currentYear}`}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-[#cbdde3] bg-white/80 p-1">
                {([
                  ["day", "Daily"],
                  ["week", "Weekly"],
                  ["month", "Monthly"],
                  ["timeline", "Term"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${mode === key ? "bg-[#163f59] text-white" : "text-[#5e7383] hover:text-[#1d3648]"}`}
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
                  <Button variant="secondary" size="sm" onClick={goToday}>Today</Button>
                  <Button variant="secondary" size="sm" onClick={goNext}>
                    <MaterialIcon icon="chevron_right" />
                  </Button>
                </>
              )}

              <Button onClick={() => setShowModal(true)}>
                <MaterialIcon icon="add" />
                Create Event
              </Button>
            </div>
          </div>

          {mode === "timeline" ? (
            <Card className="relative z-10 mt-5 min-h-[500px] p-4">
              <TermTimeline events={events.filter(matchesFilter)} />
            </Card>
          ) : (
            <div className="relative z-10 mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[300px,1fr]">
              <aside className="space-y-4 rounded-[22px] border border-[#cfe0e4] bg-white/90 p-4 backdrop-blur">
                <div className="rounded-xl border border-[#deebee] bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <MaterialIcon icon="search" className="text-[#7f95a1]" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search events..."
                      className="w-full border-none bg-transparent text-sm text-[#2a4353] outline-none placeholder:text-[#90a5b0]"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#243f4f]">{months[currentMonth]} {currentYear}</h2>
                    <div className="flex items-center gap-1 text-[#6a7f8e]">
                      <button type="button" onClick={goPrev} className="rounded-full p-1 hover:bg-[#ecf4f6]">
                        <MaterialIcon icon="chevron_left" className="text-[18px]" />
                      </button>
                      <button type="button" onClick={goNext} className="rounded-full p-1 hover:bg-[#ecf4f6]">
                        <MaterialIcon icon="chevron_right" className="text-[18px]" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#8fa1ac]">
                    {weekDays.map((d) => (
                      <div key={d}>{d[0]}</div>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }, (_, i) => <div key={`mini-empty-${i}`} className="h-8" />)}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                      const isToday = dateStr === todayKey
                      const isActive = dateStr === selectedDate
                      const hasEvent = getEventsForDate(dateStr).length > 0

                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setSelectedDate(dateStr)
                            setNewEvent((n) => ({ ...n, start_date: dateStr }))
                          }}
                          className={`relative h-8 rounded-lg text-xs font-semibold transition-all ${isActive ? "bg-[#173f58] text-white" : isToday ? "bg-[#dceef2] text-[#173f58]" : "text-[#425766] hover:bg-[#eef5f7]"}`}
                        >
                          {day}
                          {hasEvent && (
                            <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isActive ? "bg-white" : "bg-[#1b7b8e]"}`} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-2xl bg-[linear-gradient(140deg,#0e8a96_0%,#1f778c_100%)] p-4 text-white shadow-lg">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/75">Meeting reminder</p>
                  {featuredEvent ? (
                    <>
                      <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] leading-tight">{featuredEvent.title}</h3>
                      <p className="mt-1 text-xs text-white/80">{deriveEventSlot(featuredEvent).label}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-white/85">No events scheduled this month yet.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-[#deebee] bg-white p-4">
                  <h3 className="text-sm font-bold text-[#243f4f]">Filters</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {([
                      ["meetings", "Meetings"],
                      ["task_due", "Task Due Dates"],
                      ["milestones", "Milestones"],
                      ["deadlines", "Deadlines"],
                      ["personal", "Personal Events"],
                      ["birthdays", "Birthdays"],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCategory(key)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f2f7f9]"
                      >
                        <span className="text-[#5e7383]">{label}</span>
                        <span className={`h-4 w-4 rounded border ${categoryFilters[key] ? "border-[#1b7b8e] bg-[#1b7b8e]" : "border-[#bfd2da] bg-white"}`}>
                          {categoryFilters[key] && <MaterialIcon icon="check" className="text-[12px] text-white" />}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#deebee] bg-white p-4">
                  <h3 className="text-sm font-bold text-[#243f4f]">Other Calendars</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {([
                      ["school", "School Calendar"],
                      ["academic", "Academic Calendar"],
                      ["staff", "Staff Calendar"],
                      ["personal", "Personal Calendar"],
                    ] as const).map(([scope, label]) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => toggleCalendarScope(scope)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 transition ${calendarScopes[scope] ? "bg-[#e5f0f3] text-[#1e3f51]" : "text-[#5e7383] hover:bg-[#f2f7f9]"}`}
                      >
                        <span>{label}</span>
                        <MaterialIcon icon={calendarScopes[scope] ? "check_circle" : "radio_button_unchecked"} className="text-[16px]" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#d7e6ea] bg-[#f8fcfd] p-4">
                  <h3 className="text-sm font-bold text-[#243f4f]">Snapshot</h3>
                  <div className="mt-3 space-y-2">
                    {statCards.map((stat) => (
                      <div key={stat.label} className="rounded-xl border border-[#e0ecef] bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#78909c]">{stat.label}</p>
                        <p className="mt-1 text-base font-semibold text-[#1f3949]">{stat.value}</p>
                        <p className="mt-0.5 truncate text-xs text-[#7a909d]">{stat.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              <section className="rounded-[22px] border border-[#d4e3e7] bg-white p-4 sm:p-5 shadow-[0_14px_28px_rgba(10,46,64,0.06)]">
                <div className="mb-3 flex items-center justify-between rounded-xl border border-[#e1ecef] bg-[#f9fcfd] px-3 py-2">
                  <div className="flex items-center gap-2 text-[#3c5565]">
                    <MaterialIcon icon="today" className="text-[16px]" />
                    <p className="text-sm font-semibold">
                      {new Date(selectedDate).toLocaleDateString("en-UG", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <p className="text-xs font-medium text-[#7f95a1]">{mode === "day" ? "Daily lane" : mode === "week" ? "Weekly lane" : "Monthly lane"}</p>
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f95a1]">{timezoneLabel}</p>
                  <p className="text-xs text-[#6f8794]">Click any event to delete</p>
                </div>

                {(mode === "week" || mode === "day") && (
                  <div className="overflow-x-auto rounded-2xl border border-[#e2edf0] bg-[#f7fbfd] p-2">
                    <div className={`grid min-w-[860px] gap-2 ${mode === "week" ? "grid-cols-[64px_repeat(7,minmax(110px,1fr))]" : "grid-cols-[64px_minmax(260px,1fr)]"}`}>
                      <div />
                      {(mode === "week" ? weekColumns : [{ date: selectedDateObj, dateKey: selectedDate, events: dayEvents }]).map(({ date, dateKey }) => {
                        const isCurrent = dateKey === selectedDate
                        return (
                          <button
                            key={`head-${dateKey}`}
                            type="button"
                            onClick={() => setSelectedDate(dateKey)}
                            className={`rounded-xl border px-2 py-2 text-left transition ${isCurrent ? "border-[#1d5f74] bg-[#e0f0f4]" : "border-[#e4ecef] bg-white"}`}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f95a1]">{fullWeekDays[date.getDay()]}</p>
                            <p className="mt-1 text-xl font-semibold text-[#203846]">{date.getDate()}</p>
                          </button>
                        )
                      })}

                      <div className="relative h-[640px] rounded-xl bg-[#fbfeff]">
                        {scheduleHours.map((hour) => (
                          <div key={`time-${hour}`} className="absolute left-0 right-0 text-[10px] text-[#8ea0aa]" style={{ top: `${(hour - 8) * 64}px` }}>
                            {toHourLabel(hour)}
                          </div>
                        ))}
                      </div>

                      {(mode === "week" ? weekColumns : [{ date: selectedDateObj, dateKey: selectedDate, events: dayEvents }]).map(({ dateKey, events: dayColEvents }) => (
                        <div key={`col-${dateKey}`} className="relative h-[640px] rounded-xl border border-[#e4ecef] bg-white">
                          {scheduleHours.map((hour) => (
                            <div
                              key={`line-${dateKey}-${hour}`}
                              className="absolute left-0 right-0 border-t border-dashed border-[#e6eef2]"
                              style={{ top: `${(hour - 8) * 64}px` }}
                            />
                          ))}

                          {dayColEvents.map((evt) => {
                            const slot = deriveEventSlot(evt)
                            const top = (slot.start - 8) * 64 + 4
                            const height = Math.max(52, (slot.end - slot.start) * 64 - 8)
                            return (
                              <div key={evt.id} className="absolute left-1 right-1" style={{ top: `${top}px`, height: `${height}px` }}>
                                <EventCard evt={evt} onDelete={() => setPendingDeleteId(evt.id)} />
                              </div>
                            )
                          })}

                          {dayColEvents.length === 0 && (
                            <p className="absolute left-0 right-0 top-24 text-center text-xs text-[#8ea0aa]">No events</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mode === "month" && (
                  <div>
                    <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa1ac]">
                      {weekDays.map((d) => (
                        <div key={`month-head-${d}`}>{d}</div>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-2">
                      {Array.from({ length: firstDay }, (_, i) => (
                        <div key={`month-empty-${i}`} className="h-28 rounded-xl border border-[#edf2f5] bg-[#f9fcfd]" />
                      ))}
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        const eventsForDay = getEventsForDate(dateStr)
                        const isActive = dateStr === selectedDate
                        const isToday = dateStr === todayKey

                        return (
                          <button
                            key={`month-day-${day}`}
                            type="button"
                            onClick={() => setSelectedDate(dateStr)}
                            className={`h-28 rounded-xl border p-2 text-left transition ${isActive ? "border-[#1d5f74] bg-[#e0f0f4]" : "border-[#e4ecef] bg-white hover:border-[#bfd5dc]"}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${isToday ? "text-[#0d7287]" : "text-[#516977]"}`}>{day}</span>
                              <span className="text-[10px] text-[#90a5b0]">{eventsForDay.length}</span>
                            </div>
                            <div className="mt-2 space-y-1">
                              {eventsForDay.slice(0, 2).map((evt) => (
                                <div key={`pill-${evt.id}`} className={`truncate rounded px-1.5 py-0.5 text-[10px] ${typeColors[evt.event_type].bg} ${typeColors[evt.event_type].text}`}>
                                  {evt.title}
                                </div>
                              ))}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-dashed border-[#d3e3e8] bg-[#f7fbfc] p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f95a1]">Selected date</p>
                  <p className="mt-1 text-sm font-semibold text-[#233f50]">
                    {new Date(selectedDate).toLocaleDateString("en-UG", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <div className="mt-2 space-y-2">
                    {selectedDateEvents.length === 0 ? (
                      <p className="text-sm text-[#7b919d]">No events on this date.</p>
                    ) : (
                      selectedDateEvents.map((evt) => (
                        <div key={`selected-${evt.id}`} className="flex items-center justify-between rounded-lg border border-[#e3edf0] bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#243f4f]">{evt.title}</p>
                            <p className="text-[11px] capitalize text-[#748b98]">
                              {evt.event_type} • {deriveEventSlot(evt).label}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(evt.id)}>
                            <MaterialIcon icon="close" style={{ fontSize: 16 }} />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {loading && <p className="mt-3 text-xs text-[#7b919d]">Refreshing events...</p>}
              </section>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
            <div className="w-full max-w-md rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-[#e8eaed] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[#191c1d]">Add Event</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                    <MaterialIcon icon="close" />
                  </Button>
                </div>
              </div>
              <form onSubmit={handleAddEvent} className="space-y-4 p-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#191c1d]">Event Title</label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#191c1d]">Event Type</label>
                  <select
                    value={newEvent.event_type}
                    onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value as SchoolEvent["event_type"] })}
                    className="input"
                  >
                    <option value="event">Event</option>
                    <option value="exam">Exam</option>
                    <option value="meeting">Meeting</option>
                    <option value="holiday">Holiday</option>
                    <option value="academic">Academic</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#191c1d]">Start Date</label>
                    <input
                      type="date"
                      value={newEvent.start_date}
                      onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#191c1d]">End Date (Optional)</label>
                    <input
                      type="date"
                      value={newEvent.end_date}
                      onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#191c1d]">Description (Optional)</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="input min-h-[80px]"
                    placeholder="Optional: include time like 09:00-10:30"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button variant="primary" className="flex-1" type="submit">Add Event</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={deleteEvent}
        title="Delete Event"
        message="Delete this event? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </PageErrorBoundary>
  )
}
