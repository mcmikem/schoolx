"use client"
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useOfflineEvents } from '@/lib/offline-hooks';
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { EVENT_TYPES } from '@/lib/constants'
import { Button } from '@/components/ui/index'
import { Card } from '@/components/ui/Card'
import TermTimeline from '@/components/dashboard/TermTimeline'
import { getErrorMessage } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface SchoolEvent {
  id: string
  title: string
  description: string | null
  event_type: 'exam' | 'meeting' | 'holiday' | 'event' | 'academic'
  start_date: string
  end_date: string | null
}

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const typeColors: Record<string, { bg: string, text: string }> = {
  exam: { bg: 'bg-[#fef2f2]', text: 'text-[#ba1a1a]' },
  meeting: { bg: 'bg-[#e3f2fd]', text: 'text-[#002045]' },
  holiday: { bg: 'bg-[#e8f5e9]', text: 'text-[#006e1c]' },
  academic: { bg: 'bg-[#f3e5f5]', text: 'text-[#7b1fa2]' },
  event: { bg: 'bg-[#fff3e0]', text: 'text-[#b86e00]' },
}

export default function CalendarPage() {
  const { school } = useAuth()
  const toast = useToast()
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  // Offline-aware events
  const {
    data: events = [],
    loading,
    refetch: refetchEvents,
  } = useOfflineEvents(school?.id);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [view, setView] = useState<'grid' | 'timeline'>('grid')
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [typeFilter, setTypeFilter] = useState<'all' | SchoolEvent['event_type']>('all')
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'event' as 'exam' | 'meeting' | 'holiday' | 'event' | 'academic',
    start_date: '',
    end_date: '',
  })

  // Offline hook handles fetching events

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    if (!newEvent.title.trim()) {
      toast.error('Event title is required')
      return
    }

    if (!newEvent.start_date) {
      toast.error('Start date is required')
      return
    }

    if (newEvent.end_date && newEvent.end_date < newEvent.start_date) {
      toast.error('End date cannot be earlier than the start date')
      return
    }

    try {
      const { error } = await supabase.from('events').insert({
        school_id: school.id,
        title: newEvent.title.trim(),
        description: newEvent.description.trim() || null,
        event_type: newEvent.event_type,
        start_date: newEvent.start_date,
        end_date: newEvent.end_date || null,
      })
      if (error) throw error
      setShowModal(false)
      setNewEvent({ title: '', description: '', event_type: 'event', start_date: '', end_date: '' })
      toast.success('Event added')
      refetchEvents()
    } catch (err) {
      logger.error('Error:', err)
      toast.error(getErrorMessage(err, 'Failed to add event'))
    }
  }

  const deleteEvent = async () => {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    try {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error
      toast.success('Event deleted')
      refetchEvents()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete event'))
    }
  }

  const goPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
  }

  const goNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
  }

  const goToday = () => {
    setCurrentMonth(new Date().getMonth())
    setCurrentYear(new Date().getFullYear())
  }

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()

  const getEventsForDate = (dateStr: string) => {
    return events.filter(e => {
      if (e.start_date <= dateStr && e.end_date && e.end_date >= dateStr) return true
      return e.start_date === dateStr
    }).filter((evt) => typeFilter === 'all' || evt.event_type === typeFilter)
  }

  const monthEvents = events.filter(e => {
    const startMonth = e.start_date?.substring(0, 7)
    const checkMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
    return startMonth === checkMonth || (e.end_date && e.end_date?.substring(0, 7) === checkMonth)
  })

  const filteredMonthEvents = monthEvents.filter((evt) => typeFilter === 'all' || evt.event_type === typeFilter)
  const sortedMonthEvents = [...filteredMonthEvents].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const featuredEvent = sortedMonthEvents[0]

  const activeDate = selectedDate
  const selectedDateEvents = getEventsForDate(activeDate)

  const weekBase =
    currentMonth === today.getMonth() && currentYear === today.getFullYear()
      ? new Date(today)
      : new Date(currentYear, currentMonth, 1)
  const weekStart = new Date(weekBase)
  weekStart.setDate(weekBase.getDate() - weekBase.getDay())

  const weekColumns = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + idx)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return {
      date,
      dateKey,
      events: getEventsForDate(dateKey).slice(0, 4),
    }
  })

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="relative overflow-hidden rounded-[28px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-4 sm:p-6">
          <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-[#b7dfd8]/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-[#d8e9fb]/60 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#4a7f76]">School planner</p>
              <h1 className="mt-1 font-['Sora'] text-2xl font-semibold tracking-[-0.03em] text-[#19344a]">
                {months[currentMonth]} {currentYear}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-[#cbdde3] bg-white/80 p-1">
                <button
                  onClick={() => setView('grid')}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${view === 'grid' ? 'bg-[#163f59] text-white' : 'text-[#5e7383] hover:text-[#1d3648]'}`}
                >
                  Week board
                </button>
                <button
                  onClick={() => setView('timeline')}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${view === 'timeline' ? 'bg-[#163f59] text-white' : 'text-[#5e7383] hover:text-[#1d3648]'}`}
                >
                  Term rhythm
                </button>
              </div>

              {view === 'grid' && (
                <>
                  <Button variant="secondary" size="sm" onClick={goPrevMonth}>
                    <MaterialIcon icon="chevron_left" />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={goToday}>Today</Button>
                  <Button variant="secondary" size="sm" onClick={goNextMonth}>
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

          {view === 'timeline' ? (
            <Card className="relative z-10 mt-5 min-h-[500px] p-4">
              <TermTimeline events={events} />
            </Card>
          ) : (
            <div className="relative z-10 mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[290px,1fr]">
              <aside className="space-y-4 rounded-[22px] border border-[#cfe0e4] bg-white/85 p-4 backdrop-blur">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#243f4f]">{months[currentMonth]} {currentYear}</h2>
                    <div className="flex items-center gap-1 text-[#6a7f8e]">
                      <button type="button" onClick={goPrevMonth} className="rounded-full p-1 hover:bg-[#ecf4f6]">
                        <MaterialIcon icon="chevron_left" className="text-[18px]" />
                      </button>
                      <button type="button" onClick={goNextMonth} className="rounded-full p-1 hover:bg-[#ecf4f6]">
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
                      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
                      const isActive = dateStr === activeDate
                      const hasEvent = getEventsForDate(dateStr).length > 0

                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setSelectedDate(dateStr)
                            setNewEvent((n) => ({ ...n, start_date: dateStr }))
                          }}
                          className={`relative h-8 rounded-lg text-xs font-semibold transition-all ${isActive ? 'bg-[#173f58] text-white' : isToday ? 'bg-[#dceef2] text-[#173f58]' : 'text-[#425766] hover:bg-[#eef5f7]'}`}
                        >
                          {day}
                          {hasEvent && (
                            <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isActive ? 'bg-white' : 'bg-[#1b7b8e]'}`} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-2xl bg-[linear-gradient(140deg,#0e8a96_0%,#1f778c_100%)] p-4 text-white shadow-lg">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/75">Featured event</p>
                  {featuredEvent ? (
                    <>
                      <h3 className="mt-2 text-lg font-semibold leading-tight">{featuredEvent.title}</h3>
                      <p className="mt-1 text-xs text-white/80">
                        {new Date(featuredEvent.start_date).toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-white/85">No events scheduled this month yet.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-[#deebee] bg-white p-4">
                  <h3 className="text-sm font-bold text-[#243f4f]">Filters</h3>
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => setTypeFilter('all')}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition ${typeFilter === 'all' ? 'bg-[#e5f0f3] text-[#1e3f51]' : 'hover:bg-[#f2f7f9] text-[#5e7383]'}`}
                    >
                      <span>All</span>
                      <span className="rounded-full bg-[#eef5f7] px-2 py-0.5 text-xs font-semibold text-[#446071]">{monthEvents.length}</span>
                    </button>

                    {Object.entries(typeColors).map(([type, colors]) => {
                      const count = monthEvents.filter((evt) => evt.event_type === type).length
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setTypeFilter(type as SchoolEvent['event_type'])}
                          className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition ${typeFilter === type ? 'bg-[#e5f0f3] text-[#1e3f51]' : 'hover:bg-[#f2f7f9]'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-3 w-3 rounded-full ${colors.bg}`} />
                            <span className="capitalize text-[#5e7383]">{type}</span>
                          </div>
                          <span className="rounded-full bg-[#eef5f7] px-2 py-0.5 text-xs font-semibold text-[#446071]">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </aside>

              <section className="rounded-[22px] border border-[#d4e3e7] bg-white/90 p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {weekColumns.map(({ date, dateKey }) => {
                    const isCurrent = dateKey === activeDate
                    return (
                      <button
                        type="button"
                        key={dateKey}
                        onClick={() => {
                          setSelectedDate(dateKey)
                          setNewEvent((n) => ({ ...n, start_date: dateKey }))
                        }}
                        className={`rounded-xl border px-3 py-2 text-left transition-all ${isCurrent ? 'border-[#1d5f74] bg-[#e0f0f4]' : 'border-[#e4ecef] bg-[#fafdff] hover:border-[#bfd5dc]'}`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f95a1]">{weekDays[date.getDay()]}</p>
                        <p className="mt-1 text-xl font-semibold text-[#203846]">{date.getDate()}</p>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-7">
                  {weekColumns.map(({ dateKey, events: dayEvents }) => (
                    <div key={`column-${dateKey}`} className="min-h-[180px] rounded-xl border border-[#e4ecef] bg-[#fbfdff] p-2">
                      {dayEvents.length === 0 ? (
                        <p className="pt-8 text-center text-xs text-[#8ea0aa]">No events</p>
                      ) : (
                        <div className="space-y-2">
                          {dayEvents.map((evt) => (
                            <button
                              type="button"
                              key={evt.id}
                              onClick={() => setPendingDeleteId(evt.id)}
                              className={`w-full rounded-xl px-2 py-2 text-left text-xs shadow-sm transition hover:scale-[1.01] ${typeColors[evt.event_type]?.bg || 'bg-[#eef5f7]'} ${typeColors[evt.event_type]?.text || 'text-[#446071]'}`}
                              title="Click to delete"
                            >
                              <p className="truncate font-semibold">{evt.title}</p>
                              <p className="mt-1 text-[10px] opacity-80">All day</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-dashed border-[#d3e3e8] bg-[#f7fbfc] p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f95a1]">Selected date</p>
                  <p className="mt-1 text-sm font-semibold text-[#233f50]">
                    {new Date(activeDate).toLocaleDateString('en-UG', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                  <div className="mt-2 space-y-2">
                    {selectedDateEvents.length === 0 ? (
                      <p className="text-sm text-[#7b919d]">No events on this date.</p>
                    ) : (
                      selectedDateEvents.map((event) => (
                        <div key={`selected-${event.id}`} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-[#243f4f]">{event.title}</p>
                            <p className="text-[11px] capitalize text-[#748b98]">{event.event_type}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(event.id)}>
                            <MaterialIcon icon="close" style={{ fontSize: 16 }} />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {loading && (
                  <p className="mt-3 text-xs text-[#7b919d]">Refreshing events...</p>
                )}
              </section>
            </div>
          )}
        </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Add Event</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                  <MaterialIcon icon="close" />
                </Button>
              </div>
            </div>
            <form onSubmit={handleAddEvent} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Event Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Event Type</label>
                <select value={newEvent.event_type} onChange={(e) => setNewEvent({...newEvent, event_type: e.target.value as typeof EVENT_TYPES[keyof typeof EVENT_TYPES]})} className="input">
                  <option value="event">Event</option>
                  <option value="exam">Exam</option>
                  <option value="meeting">Meeting</option>
                  <option value="holiday">Holiday</option>
                  <option value="academic">Academic</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Start Date</label>
                  <input type="date" value={newEvent.start_date} onChange={(e) => setNewEvent({...newEvent, start_date: e.target.value})} className="input" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">End Date (Optional)</label>
                  <input type="date" value={newEvent.end_date} onChange={(e) => setNewEvent({...newEvent, end_date: e.target.value})} className="input" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Description (Optional)</label>
                <textarea value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} className="input min-h-[80px]" />
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
