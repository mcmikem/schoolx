'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { EVENT_TYPES } from '@/lib/constants'

interface SchoolEvent {
  id: string
  title: string
  description: string | null
  event_type: typeof EVENT_TYPES[keyof typeof EVENT_TYPES]
  start_date: string
  end_date: string | null
}

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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
  const [events, setEvents] = useState<SchoolEvent[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'event' as 'exam' | 'meeting' | 'holiday' | 'event' | 'academic',
    start_date: '',
    end_date: '',
  })

  const fetchEvents = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('school_id', school.id)
        .order('start_date')
      if (error) throw error
      setEvents(data || [])
    } catch (err) {
      console.error('Error:', err)
      toast.error('Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [school?.id, toast])

  useEffect(() => {
    if (school?.id) fetchEvents()
  }, [school?.id, fetchEvents])

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return
    try {
      const { error } = await supabase.from('events').insert({
        school_id: school.id,
        title: newEvent.title,
        description: newEvent.description || null,
        event_type: newEvent.event_type,
        start_date: newEvent.start_date,
        end_date: newEvent.end_date || null,
      })
      if (error) throw error
      setShowModal(false)
      setNewEvent({ title: '', description: '', event_type: 'event', start_date: '', end_date: '' })
      toast.success('Event added')
      fetchEvents()
    } catch (err) {
      console.error('Error:', err)
      toast.error('Failed to add event')
    }
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return
    try {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error
      toast.success('Event deleted')
      fetchEvents()
    } catch (err) {
      toast.error('Failed to delete event')
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
  const today = new Date()

  const getEventsForDate = (dateStr: string) => {
    return events.filter(e => {
      if (e.start_date <= dateStr && e.end_date && e.end_date >= dateStr) return true
      return e.start_date === dateStr
    })
  }

  const monthEvents = events.filter(e => {
    const startMonth = e.start_date?.substring(0, 7)
    const checkMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
    return startMonth === checkMonth || (e.end_date && e.end_date?.substring(0, 7) === checkMonth)
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Calendar</h1>
          <p className="text-[#5c6670] mt-1">Manage school events and schedules</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <MaterialIcon icon="add" />
          Add Event
        </button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button onClick={goPrevMonth} className="btn btn-secondary btn-sm">
            <MaterialIcon icon="chevron_left" />
          </button>
          <button onClick={goToday} className="btn btn-secondary btn-sm">Today</button>
          <button onClick={goNextMonth} className="btn btn-secondary btn-sm">
            <MaterialIcon icon="chevron_right" />
          </button>
        </div>
        <h2 className="text-xl font-bold text-[#191c1d]">{months[currentMonth]} {currentYear}</h2>
        <div className="w-32" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e8eaed] p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-[#5c6670] py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} className="h-20" />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = getEventsForDate(dateStr)
              const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
              
              return (
                <div 
                  key={day} 
                  className={`min-h-[80px] p-2 rounded-xl border transition-all cursor-pointer ${
                    isToday 
                      ? 'bg-[#e3f2fd] border-[#002045]' 
                      : 'bg-white border-[#e8eaed] hover:bg-[#f8fafb]'
                  }`}
                  onClick={() => setNewEvent(n => ({ ...n, start_date: dateStr }))}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-[#002045]' : 'text-[#191c1d]'}`}>
                    {day}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((evt) => (
                      <div 
                        key={evt.id} 
                        className={`text-[10px] px-2 py-1 rounded truncate font-medium ${
                          typeColors[evt.event_type]?.bg || 'bg-[#f8fafb]'
                        } ${typeColors[evt.event_type]?.text || 'text-[#5c6670]'}`}
                        onClick={(e) => { e.stopPropagation(); deleteEvent(evt.id) }}
                        title="Click to delete"
                      >
                        {evt.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-[#5c6670]">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
            <h3 className="font-semibold text-[#191c1d] mb-4">
              Events this month ({monthEvents.length})
            </h3>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="w-full h-4 bg-[#e8eaed] rounded mb-2" />
                    <div className="w-3/4 h-3 bg-[#e8eaed] rounded" />
                  </div>
                ))}
              </div>
            ) : monthEvents.length === 0 ? (
              <p className="text-[#5c6670] text-sm">No events this month</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {monthEvents.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-2 p-3 bg-[#f8fafb] rounded-xl">
                    <div>
                      <div className="font-medium text-[#191c1d] text-sm">{event.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[#5c6670]">
                          {new Date(event.start_date).toLocaleDateString()}
                          {event.end_date && event.end_date !== event.start_date && ` - ${new Date(event.end_date).toLocaleDateString()}`}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${typeColors[event.event_type]?.bg || 'bg-[#f8fafb]'} ${typeColors[event.event_type]?.text || 'text-[#5c6670]'}`}>
                          {event.event_type}
                        </span>
                      </div>
                      {event.description && <div className="text-xs text-[#5c6670] mt-1">{event.description}</div>}
                    </div>
                    <button onClick={() => deleteEvent(event.id)} className="text-[#5c6670] hover:text-[#ba1a1a] flex-shrink-0">
                      <MaterialIcon icon="close" style={{ fontSize: 16 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
            <h3 className="font-semibold text-[#191c1d] mb-3">Event Types</h3>
            <div className="space-y-2">
              {Object.entries(typeColors).map(([type, colors]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${colors.bg}`} />
                  <span className="text-sm text-[#5c6670] capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Add Event</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" />
                </button>
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
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Add Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
