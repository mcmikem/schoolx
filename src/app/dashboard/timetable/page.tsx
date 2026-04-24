'use client'
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses, useSubjects, useTimetableManager, useStaff } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage } from '@/lib/validation'

// ── Uganda 2026 Public Holidays ─────────────────────────────────────────────
const UGANDA_PUBLIC_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-26', name: "Liberation Day" },
  { date: '2026-02-16', name: "Archbishop Janani Luwum Day" },
  { date: '2026-03-08', name: "International Women's Day" },
  { date: '2026-04-03', name: "Good Friday" },
  { date: '2026-04-06', name: "Easter Monday" },
  { date: '2026-05-01', name: "Labour Day" },
  { date: '2026-06-03', name: "Martyr's Day" },
  { date: '2026-06-09', name: "National Heroes' Day" },
  { date: '2026-10-09', name: "Independence Day" },
  { date: '2026-12-25', name: "Christmas Day" },
  { date: '2026-12-26', name: "Boxing Day" },
]

// ── Uganda 2026 School Term Dates ────────────────────────────────────────────
const UGANDA_TERM_DATES_2026 = [
  { date: '2026-01-13', name: 'Term 1 Opens', type: 'academic', color: '#0d9488' },
  { date: '2026-02-14', name: 'Term 1 Midterm Break Starts', type: 'holiday', color: '#f59e0b' },
  { date: '2026-02-16', name: 'Term 1 Midterm Break Ends', type: 'holiday', color: '#f59e0b' },
  { date: '2026-04-03', name: 'Term 1 Closes (EOT)', type: 'academic', color: '#ef4444' },
  { date: '2026-05-11', name: 'Term 2 Opens', type: 'academic', color: '#0d9488' },
  { date: '2026-06-26', name: 'Term 2 Midterm Break Starts', type: 'holiday', color: '#f59e0b' },
  { date: '2026-06-28', name: 'Term 2 Midterm Break Ends', type: 'holiday', color: '#f59e0b' },
  { date: '2026-08-14', name: 'Term 2 Closes (EOT)', type: 'academic', color: '#ef4444' },
  { date: '2026-09-07', name: 'Term 3 Opens', type: 'academic', color: '#0d9488' },
  { date: '2026-10-19', name: 'Term 3 Midterm Break Starts', type: 'holiday', color: '#f59e0b' },
  { date: '2026-10-21', name: 'Term 3 Midterm Break Ends', type: 'holiday', color: '#f59e0b' },
  { date: '2026-12-05', name: 'Term 3 Closes (EOT)', type: 'academic', color: '#ef4444' },
]

type CalendarEvent = {
  id: string
  title: string
  description: string | null
  event_type: string
  start_date: string
  end_date: string | null
}

const EVENT_COLORS: Record<string, string> = {
  holiday: '#10b981',
  academic: '#6366f1',
  exam: '#ef4444',
  meeting: '#3b82f6',
  event: '#f59e0b',
}

function TermCalendar({ schoolId, userId }: { schoolId: string; userId: string }) {
  const toast = useToast()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_type: 'academic',
    start_date: '',
    end_date: '',
  })

  const fetchEvents = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, event_type, start_date, end_date')
      .eq('school_id', schoolId)
      .order('start_date')
    if (!error) setEvents(data || [])
    setLoading(false)
  }, [schoolId])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const openAdd = () => {
    setEditingEvent(null)
    setForm({ title: '', description: '', event_type: 'academic', start_date: '', end_date: '' })
    setShowModal(true)
  }

  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev)
    setForm({
      title: ev.title,
      description: ev.description || '',
      event_type: ev.event_type,
      start_date: ev.start_date,
      end_date: ev.end_date || '',
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.start_date) { toast.error('Title and start date are required'); return }
    setSaving(true)
    try {
      const payload = {
        school_id: schoolId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_type: form.event_type,
        start_date: form.start_date,
        end_date: form.end_date || null,
        created_by: userId,
      }
      if (editingEvent) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingEvent.id)
        if (error) throw error
        toast.success('Event updated')
      } else {
        const { error } = await supabase.from('events').insert(payload)
        if (error) throw error
        toast.success('Event added')
      }
      setShowModal(false)
      fetchEvents()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to save event'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    setEvents(prev => prev.filter(e => e.id !== id))
    toast.success('Event deleted')
  }

  // Merge school events with built-in Uganda dates
  const allEvents = useMemo(() => {
    const builtIn = [
      ...UGANDA_PUBLIC_HOLIDAYS_2026.map(h => ({
        id: `ph-${h.date}`,
        title: h.name,
        description: 'Uganda Public Holiday',
        event_type: 'holiday',
        start_date: h.date,
        end_date: null,
        _builtin: true,
      })),
      ...UGANDA_TERM_DATES_2026.map(t => ({
        id: `td-${t.date}`,
        title: t.name,
        description: 'Uganda School Calendar 2026',
        event_type: t.type,
        start_date: t.date,
        end_date: null,
        _builtin: true,
      })),
    ]
    const school = events.map(e => ({ ...e, _builtin: false }))
    return [...builtIn, ...school].sort((a, b) => a.start_date.localeCompare(b.start_date))
  }, [events])

  // Group by month
  const byMonth = useMemo(() => {
    const months: Record<string, typeof allEvents> = {}
    for (const ev of allEvents) {
      const key = ev.start_date.slice(0, 7)
      if (!months[key]) months[key] = []
      months[key].push(ev)
    }
    return months
  }, [allEvents])

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--t1)]">Academic Calendar 2026</p>
          <p className="text-xs text-[var(--t3)]">Uganda public holidays, term dates, midterm breaks & school events</p>
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
                  const isPast = ev.start_date < today
                  const isToday = ev.start_date === today
                  const color = EVENT_COLORS[ev.event_type] || '#6b7280'
                  return (
                    <div
                      key={ev.id}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${isToday ? 'ring-2 ring-[var(--primary)]' : ''} ${isPast ? 'opacity-60' : ''} bg-[var(--surface-container-low,#f9fafb)] group`}
                    >
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[var(--t1)] leading-tight">{ev.title}</span>
                          {isToday && <span className="px-1.5 py-0.5 bg-[var(--primary)] text-white text-[9px] font-bold rounded uppercase tracking-wide">Today</span>}
                          {(ev as any)._builtin && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] rounded uppercase tracking-wide">Uganda Govt</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-[var(--t3)]">
                            {new Date(ev.start_date + 'T00:00:00').toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {ev.end_date && ev.end_date !== ev.start_date && ` – ${new Date(ev.end_date + 'T00:00:00').toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}`}
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] font-medium rounded capitalize" style={{ background: color + '20', color }}>
                            {ev.event_type}
                          </span>
                        </div>
                      </div>
                      {!(ev as any)._builtin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(ev as CalendarEvent)} className="p-1 hover:bg-[var(--surface)] rounded text-[var(--t3)] hover:text-[var(--t1)]">
                            <MaterialIcon icon="edit" className="text-sm" />
                          </button>
                          <button onClick={() => handleDelete(ev.id)} className="p-1 hover:bg-red-50 rounded text-[var(--t3)] hover:text-red-500">
                            <MaterialIcon icon="delete" className="text-sm" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--t1)]">{editingEvent ? 'Edit Event' : 'Add Calendar Event'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-[var(--bg)] rounded-lg text-[var(--t3)]">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--t2)] mb-1 block">Event Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input w-full" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--t2)] mb-1 block">Type</label>
                  <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} className="input w-full">
                    <option value="academic">Academic</option>
                    <option value="holiday">Holiday</option>
                    <option value="exam">Exam</option>
                    <option value="meeting">Meeting</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--t2)] mb-1 block">Start Date *</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="input w-full" required />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--t2)] mb-1 block">End Date (optional)</label>
                <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="input w-full" min={form.start_date} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--t2)] mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input w-full" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Saving…' : editingEvent ? 'Update' : 'Add Event'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const DAYS = [
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
]

export default function TimetablePage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  const { slots, loading: loadingSlots } = useTimetableManager(school?.id)
  const { staff } = useStaff(school?.id)

  // Only show teaching staff in the dropdown
  const teachers = staff.filter((s: any) =>
    ['teacher', 'head_teacher', 'dean_of_studies', 'deputy_headteacher'].includes(s.role)
  )
  const teacherNameById = useMemo(
    () =>
      Object.fromEntries(
        teachers.map((teacher: any) => [teacher.id, teacher.full_name]),
      ) as Record<string, string>,
    [teachers],
  )

  const [selectedClassId, setSelectedClassId] = useState('')
  const [timetable, setTimetable] = useState<any[]>([])
  const [allClassTimetables, setAllClassTimetables] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [conflicts, setConflicts] = useState<string[]>([])

  // Fetch the timetable for the selected class
  const fetchTimetable = useCallback(async () => {
    if (!selectedClassId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('teacher_timetable')
        .select('id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, room, academic_year, subjects(name, code)')
        .eq('class_id', selectedClassId)
        .order('day_of_week')
        .order('period_number')
      if (error) throw error
      setTimetable(data || [])
    } catch (err) {
      console.error('Error fetching timetable:', err)
      toast.error('Failed to load timetable')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId])

  // Fetch ALL class timetables for the school to enable cross-class conflict detection
  // Note: depends only on school?.id, not classes array (to avoid re-render loops)
  const fetchAllTimetables = useCallback(async () => {
    if (!school?.id) return
    try {
      const { data } = await supabase
        .from('teacher_timetable')
        .select('teacher_id, day_of_week, period_number, class_id')
        .eq('class_id', selectedClassId || '')
      setAllClassTimetables(data || [])
    } catch (err) {
      console.error('Error fetching all timetables:', err)
    }
   
  }, [school?.id, selectedClassId])

  useEffect(() => {
    if (selectedClassId) fetchTimetable()
  }, [selectedClassId, fetchTimetable])

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id)
    }
  }, [classes, selectedClassId])

  useEffect(() => {
    fetchAllTimetables()
  }, [fetchAllTimetables])

  /**
   * Detect conflicts for a proposed entry:
   * 1. Teacher double-booked: same teacher already assigned to a DIFFERENT class at the same day+slot
   * 2. Slot already filled: same class already has an entry at this day+slot
   */
  const detectConflicts = useCallback((teacherId: string, day: number, periodNumber: number): string[] => {
    const found: string[] = []

    // Check if the teacher is already teaching another class at this period
    const teacherConflict = allClassTimetables.find(
      (t) =>
        t.teacher_id === teacherId &&
        t.day_of_week === day &&
        t.period_number === periodNumber &&
        t.class_id !== selectedClassId
    )
    if (teacherConflict) {
      const conflictClass = classes.find((c: any) => c.id === teacherConflict.class_id)
      found.push(`Teacher is already scheduled in ${conflictClass?.name || 'another class'} at this slot`)
    }

    // Check if this class already has an entry at this slot (shouldn't happen via UI but guard anyway)
    const classConflict = timetable.find(
      (t) => t.day_of_week === day && t.period_number === periodNumber
    )
    if (classConflict) {
      found.push(`This slot is already occupied by ${classConflict.subjects?.name || 'another subject'}`)
    }

    return found
  }, [allClassTimetables, timetable, selectedClassId, classes])

  const handleTeacherChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teacherId = e.target.value
    if (!teacherId || !selectedSlot) { setConflicts([]); return }
    const found = detectConflicts(
      teacherId,
      selectedDay,
      selectedSlot.order_number ?? selectedSlot.period_number,
    )
    setConflicts(found)
  }

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const teacherId = formData.get('teacher_id') as string

    // Run conflict check one final time before saving
    const found = detectConflicts(
      teacherId,
      selectedDay,
      selectedSlot.order_number ?? selectedSlot.period_number,
    )
    if (found.length > 0) {
      toast.error(`Cannot save: ${found[0]}`)
      return
    }

    const entryData = {
      class_id: selectedClassId,
      subject_id: formData.get('subject_id'),
      teacher_id: teacherId,
      day_of_week: selectedDay,
      period_number: selectedSlot.order_number ?? selectedSlot.period_number,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      academic_year: new Date().getFullYear().toString(),
    }

    if (!entryData.class_id || !entryData.subject_id || !entryData.teacher_id) {
      toast.error('Class, subject, and teacher are required')
      return
    }

    try {
      const { error } = await supabase.from('teacher_timetable').insert([entryData])
      if (error) throw error
      toast.success('Timetable entry added')
      setShowEntryModal(false)
      setConflicts([])
      fetchTimetable()
      fetchAllTimetables()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to add timetable entry'))
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Remove this timetable entry?')) return
    try {
      const { error } = await supabase.from('teacher_timetable').delete().eq('id', entryId)
      if (error) throw error
      toast.success('Entry removed')
      fetchTimetable()
      fetchAllTimetables()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to remove timetable entry'))
    }
  }

  const getEntry = (day: number, periodNumber: number) => {
    return timetable.find(
      (t) => t.day_of_week === day && t.period_number === periodNumber,
    )
  }

  const dayTabs = DAYS.map(day => ({ id: day.value.toString(), label: day.full }))
  const mainTabs = [
    { id: 'timetable', label: 'Class Timetable' },
    { id: 'calendar', label: 'Term Calendar' },
  ]
  const [mainTab, setMainTab] = useState<'timetable' | 'calendar'>('timetable')

  if (loadingSlots) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader title="Timetable" subtitle="Loading configuration..." />
        <Card><TableSkeleton rows={6} /></Card>
      </div>
    )
  }

  // If slots failed to load (empty after loading), show a usable empty timetable
  // rather than a broken UI
  const effectiveSlots = slots.length > 0 ? slots : [
    { id: 'p1', name: 'Period 1', start_time: '08:00', end_time: '08:40', order_number: 1, is_break: false, is_lesson: true },
    { id: 'p2', name: 'Period 2', start_time: '08:40', end_time: '09:20', order_number: 2, is_break: false, is_lesson: true },
    { id: 'p3', name: 'Break', start_time: '09:20', end_time: '09:40', order_number: 3, is_break: true, is_lesson: false },
    { id: 'p4', name: 'Period 3', start_time: '09:40', end_time: '10:20', order_number: 4, is_break: false, is_lesson: true },
    { id: 'p5', name: 'Period 4', start_time: '10:20', end_time: '11:00', order_number: 5, is_break: false, is_lesson: true },
    { id: 'p6', name: 'Lunch', start_time: '11:00', end_time: '12:00', order_number: 6, is_break: true, is_lesson: false },
    { id: 'p7', name: 'Period 5', start_time: '12:00', end_time: '12:40', order_number: 7, is_break: false, is_lesson: true },
    { id: 'p8', name: 'Period 6', start_time: '12:40', end_time: '13:20', order_number: 8, is_break: false, is_lesson: true },
  ]

  return (
    <PageErrorBoundary>
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Timetable"
        subtitle="Class schedule and academic calendar"
      />

      {/* Main tabs: Class Timetable vs Term Calendar */}
      <div className="border-b border-[var(--border)]">
        <Tabs tabs={mainTabs} activeTab={mainTab} onChange={(id) => setMainTab(id as 'timetable' | 'calendar')} />
      </div>

      <TabPanel activeTab={mainTab} tabId="calendar">
        <TermCalendar schoolId={school?.id || ''} userId={user?.id || ''} />
      </TabPanel>

      <TabPanel activeTab={mainTab} tabId="timetable">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-3 flex-wrap">
          {classes.length === 0 ? (
            <div className="px-4 py-2 bg-[var(--amber-soft)] text-[var(--amber)] text-sm rounded-xl border border-[var(--amber)]/20">
              No classes available
            </div>
          ) : (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--on-surface)] outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
            >
              <option value="">Select a Class...</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="border-b border-[var(--border)]">
          <Tabs
            tabs={dayTabs}
            activeTab={selectedDay.toString()}
            onChange={(id) => setSelectedDay(parseInt(id))}
          />
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : (
          DAYS.map(day => (
            <TabPanel key={day.value} activeTab={selectedDay.toString()} tabId={day.value.toString()}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="p-4 bg-[var(--surface-container-low)] border-b border-r border-[var(--border)] text-[var(--t4)] text-xs uppercase font-bold w-32 text-left">
                        Period
                      </th>
                      <th className="p-4 bg-[var(--surface-container-low)] border-b border-r border-[var(--border)] text-[var(--t1)] font-semibold text-left">
                        {day.full}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {effectiveSlots.map((slot: any) => {
                      const isBreak = slot.is_break ?? slot.is_lesson === false
                      const entry = getEntry(day.value, slot.order_number ?? slot.period_number)
                      return (
                        <tr key={slot.id} className={isBreak ? 'bg-[var(--surface-container-low)]/50' : ''}>
                          <td className="p-4 border-b border-r border-[var(--border)]">
                            <p className="text-sm font-semibold text-[var(--t1)]">{slot.name}</p>
                            <p className="text-xs text-[var(--t4)]">{slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}</p>
                          </td>
                          <td className={`p-2 border-b border-[var(--border)] min-h-[100px] relative ${isBreak ? 'opacity-50' : ''}`}>
                            {entry ? (
                              <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg p-3 h-full group">
                                <p className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider mb-1">
                                  {entry.subjects?.code || 'SUB'}
                                </p>
                                <p className="text-sm font-semibold text-[var(--t1)] leading-tight mb-2">
                                  {entry.subjects?.name}
                                </p>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-xs text-[var(--t4)]">
                                    <MaterialIcon icon="person" className="text-sm" />
                                    {teacherNameById[entry.teacher_id] || 'Teacher'}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500 transition-all"
                                    title="Remove entry"
                                  >
                                    <MaterialIcon icon="delete" className="text-sm" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              !isBreak && selectedClassId && (
                                <button
                                  onClick={() => { setSelectedSlot(slot); setSelectedDay(day.value); setConflicts([]); setShowEntryModal(true) }}
                                  className="w-full h-full min-h-[60px] flex items-center justify-center border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5 rounded-xl transition-all"
                                >
                                  <MaterialIcon icon="add" className="text-[var(--t4)] hover:text-[var(--primary)]" />
                                </button>
                              )
                            )}
                            {isBreak && (
                              <div className="flex items-center justify-center text-xs font-bold text-[var(--t4)] uppercase tracking-[0.2em]">
                                {slot.name}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </TabPanel>
          ))
        )}
      </Card>

      {showEntryModal && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[var(--t1)]">Assign Lesson</h2>
              <button onClick={() => { setShowEntryModal(false); setConflicts([]) }} className="text-[var(--t4)] hover:text-[var(--t1)]">
                <MaterialIcon icon="close" />
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-4">
              <div className="p-3 bg-[var(--primary)]/10 rounded-xl mb-4">
                <p className="text-xs text-[var(--primary)] font-semibold uppercase mb-1">Schedule Slot</p>
                <p className="text-sm text-[var(--t1)] font-medium">
                  {DAYS.find(d => d.value === selectedDay)?.full} · {selectedSlot.name} ({selectedSlot.start_time?.slice(0, 5)} – {selectedSlot.end_time?.slice(0, 5)})
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--t2)]">Subject</label>
                <select name="subject_id" required className="w-full px-4 py-3 bg-[var(--surface-container-low)] border border-[var(--border)] rounded-xl text-[var(--on-surface)]">
                  <option value="">Choose subject...</option>
                  {subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--t2)]">Teacher</label>
                <select name="teacher_id" required onChange={handleTeacherChange} className="w-full px-4 py-3 bg-[var(--surface-container-low)] border border-[var(--border)] rounded-xl text-[var(--on-surface)]">
                  <option value="">Select teacher...</option>
                  {teachers.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.full_name} ({t.role})</option>
                  ))}
                </select>
              </div>

              {/* Conflict warnings */}
              {conflicts.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                  {conflicts.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-red-700 text-sm">
                      <MaterialIcon icon="warning" className="text-red-500 shrink-0 mt-0.5" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              )}

              <Button type="submit" className="w-full mt-4" disabled={conflicts.length > 0}>
                {conflicts.length > 0 ? 'Resolve Conflicts First' : 'Add to Timetable'}
              </Button>
            </form>
          </Card>
        </div>
      )}
      </TabPanel>
    </div>
    </PageErrorBoundary>
  )
}
