'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

interface SchoolEvent {
  id: string
  title: string
  description: string | null
  event_type: 'exam' | 'meeting' | 'holiday' | 'event' | 'academic'
  start_date: string
  end_date: string | null
}

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const typeColors: Record<string, { bg: string, text: string }> = {
  exam: { bg: 'bg-red-100', text: 'text-red-700' },
  meeting: { bg: 'bg-blue-100', text: 'text-blue-700' },
  holiday: { bg: 'bg-green-100', text: 'text-green-700' },
  academic: { bg: 'bg-purple-100', text: 'text-purple-700' },
  event: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
}

export default function CalendarPage() {
  const { school } = useAuth()
  const [events, setEvents] = useState<SchoolEvent[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const currentYear = new Date().getFullYear()
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'event' as 'exam' | 'meeting' | 'holiday' | 'event' | 'academic',
    start_date: '',
    end_date: '',
  })

  useEffect(() => {
    fetchEvents()
  }, [school?.id])

  const fetchEvents = async () => {
    if (!school?.id) return
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('school_id', school.id)
        .order('start_date')
      setEvents(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    try {
      await supabase.from('events').insert({
        school_id: school.id,
        title: newEvent.title,
        description: newEvent.description || null,
        event_type: newEvent.event_type,
        start_date: newEvent.start_date,
        end_date: newEvent.end_date || null,
      })
      setShowModal(false)
      setNewEvent({ title: '', description: '', event_type: 'event', start_date: '', end_date: '' })
      fetchEvents()
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()

  const getEventsForDate = (dateStr: string) => {
    return events.filter(e => e.start_date === dateStr)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage school events and schedules</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setCurrentMonth(Math.max(0, currentMonth - 1))} className="btn btn-secondary btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{months[currentMonth]} {currentYear}</h2>
        <button onClick={() => setCurrentMonth(Math.min(11, currentMonth + 1))} className="btn btn-secondary btn-sm">
          Next
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-2">{d}</div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} className="h-20" />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = getEventsForDate(dateStr)
              const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth()
              
              return (
                <div 
                  key={day} 
                  className={`min-h-[80px] p-1 rounded-lg border transition-colors ${
                    isToday 
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' 
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map((evt) => (
                      <div 
                        key={evt.id} 
                        className={`text-[10px] px-1 py-0.5 rounded truncate font-medium ${
                          typeColors[evt.event_type]?.bg || 'bg-gray-100'
                        } ${typeColors[evt.event_type]?.text || 'text-gray-700'} dark:bg-opacity-20`}
                      >
                        {evt.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Upcoming Events</h3>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="skeleton w-full h-4 mb-2" />
                    <div className="skeleton w-3/4 h-3" />
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No events scheduled</p>
            ) : (
              <div className="space-y-3">
                {events.slice(0, 5).map((event) => (
                  <div key={event.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{event.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(event.start_date).toLocaleDateString()}
                      </span>
                      <span className={`badge text-[10px] ${typeColors[event.event_type]?.bg || 'bg-gray-100'} ${typeColors[event.event_type]?.text || 'text-gray-700'}`}>
                        {event.event_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Event Types</h3>
            <div className="space-y-2">
              {Object.entries(typeColors).map(([type, colors]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${colors.bg}`} />
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Event</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleAddEvent} className="p-6 space-y-4">
              <div>
                <label className="label">Event Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Event Type</label>
                <select value={newEvent.event_type} onChange={(e) => setNewEvent({...newEvent, event_type: e.target.value as any})} className="input">
                  <option value="event">Event</option>
                  <option value="exam">Exam</option>
                  <option value="meeting">Meeting</option>
                  <option value="holiday">Holiday</option>
                  <option value="academic">Academic</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" value={newEvent.start_date} onChange={(e) => setNewEvent({...newEvent, start_date: e.target.value})} className="input" required />
                </div>
                <div>
                  <label className="label">End Date (Optional)</label>
                  <input type="date" value={newEvent.end_date} onChange={(e) => setNewEvent({...newEvent, end_date: e.target.value})} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Description (Optional)</label>
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
