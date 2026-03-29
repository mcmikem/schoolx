'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses, useSubjects, useTimetable } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

const DAYS = [
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
]

const PERIODS = Array.from({ length: 8 }, (_, i) => ({
  value: i + 1,
  label: `Period ${i + 1}`,
  start: `${(8 + i).toString().padStart(2, '0')}:00`,
  end: `${(8 + i + 1).toString().padStart(2, '0')}:00`,
}))

const SUBJECT_COLORS: Record<string, string> = {
  'Mathematics': 'bg-blue-50 border-blue-200 text-blue-800',
  'English': 'bg-green-50 border-green-200 text-green-800',
  'Science': 'bg-purple-50 border-purple-200 text-purple-800',
  'Social Studies': 'bg-amber-50 border-amber-200 text-amber-800',
  'Kiswahili': 'bg-pink-50 border-pink-200 text-pink-800',
  'Religious Education': 'bg-indigo-50 border-indigo-200 text-indigo-800',
  'Physical Education': 'bg-orange-50 border-orange-200 text-orange-800',
  'Art & Craft': 'bg-teal-50 border-teal-200 text-teal-800',
  'Music': 'bg-rose-50 border-rose-200 text-rose-800',
  'Agriculture': 'bg-lime-50 border-lime-200 text-lime-800',
}

const DEFAULT_COLOR = 'bg-gray-50 border-gray-200 text-gray-800'

interface TimetableEntry {
  id: string
  class_id: string
  subject_id: string
  teacher_id?: string
  day_of_week: number
  period: number
  room?: string
  subjects?: { name: string; code?: string }
  teachers?: { full_name: string }
}

interface Conflict {
  type: 'teacher' | 'room'
  message: string
  entries: TimetableEntry[]
}

export default function TimetablePage() {
  const { school } = useAuth()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  const [selectedClass, setSelectedClass] = useState('')
  const { timetable, saveEntry, deleteEntry } = useTimetable(selectedClass)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Record<string, unknown> | null>(null)
  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [formData, setFormData] = useState({
    subject_id: '',
    teacher_id: '',
    day_of_week: 1,
    period: 1,
    room: '',
  })

  useEffect(() => {
    if (classes.length > 0 && !selectedClass) {
      setSelectedClass(classes[0].id)
    }
  }, [classes, selectedClass])

  useEffect(() => {
    async function fetchTeachers() {
      if (!school?.id) return
      const { data } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('school_id', school.id)
        .eq('role', 'teacher')
      setTeachers(data || [])
    }
    fetchTeachers()
  }, [school?.id])

  useEffect(() => {
    detectConflicts()
  }, [timetable])

  const detectConflicts = () => {
    const found: Conflict[] = []
    const teacherSlots = new Map<string, TimetableEntry[]>()
    const roomSlots = new Map<string, TimetableEntry[]>()

    timetable.forEach((entry: any) => {
      if (entry.teacher_id) {
        const key = `${entry.teacher_id}-${entry.day_of_week}-${entry.period}`
        if (!teacherSlots.has(key)) teacherSlots.set(key, [])
        teacherSlots.get(key)!.push(entry as TimetableEntry)
      }
      if (entry.room) {
        const key = `${entry.room}-${entry.day_of_week}-${entry.period}`
        if (!roomSlots.has(key)) roomSlots.set(key, [])
        roomSlots.get(key)!.push(entry as TimetableEntry)
      }
    })

    teacherSlots.forEach((entries) => {
      if (entries.length > 1) {
        found.push({
          type: 'teacher',
          message: `Teacher ${entries[0].teachers?.full_name || 'Unknown'} is double-booked on ${DAYS.find(d => d.value === entries[0].day_of_week)?.full}, ${PERIODS.find(p => p.value === entries[0].period)?.label}`,
          entries,
        })
      }
    })

    roomSlots.forEach((entries) => {
      if (entries.length > 1) {
        found.push({
          type: 'room',
          message: `Room "${entries[0].room}" is double-booked on ${DAYS.find(d => d.value === entries[0].day_of_week)?.full}, ${PERIODS.find(p => p.value === entries[0].period)?.label}`,
          entries,
        })
      }
    })

    setConflicts(found)
  }

  const getEntry = (day: number, period: number) => {
    return timetable.find((t: any) => t.day_of_week === day && t.period === period)
  }

  const handleCellClick = (day: number, period: number) => {
    const entry = getEntry(day, period)
    if (entry) {
      setEditingEntry(entry as any)
      setFormData({
        subject_id: (entry as any).subject_id || '',
        teacher_id: (entry as any).teacher_id || '',
        day_of_week: day,
        period,
        room: (entry as any).room || '',
      })
    } else {
      setEditingEntry(null)
      setFormData({
        subject_id: '',
        teacher_id: '',
        day_of_week: day,
        period,
        room: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.subject_id) {
      toast.error('Please select a subject')
      return
    }

    const periodInfo = PERIODS.find(p => p.value === formData.period)
    const entry = {
      id: editingEntry?.id as string | undefined,
      class_id: selectedClass,
      subject_id: formData.subject_id,
      teacher_id: formData.teacher_id || undefined,
      day_of_week: formData.day_of_week,
      period: formData.period,
      start_time: periodInfo?.start || '08:00',
      end_time: periodInfo?.end || '09:00',
      room: formData.room || undefined,
    }

    try {
      await saveEntry(entry)
      toast.success('Timetable entry saved')
      setIsModalOpen(false)
      setEditingEntry(null)
      detectConflicts()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return
    try {
      await deleteEntry(id)
      toast.success('Entry deleted')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete')
    }
  }

  const getSubjectColor = (subjectName?: string) => {
    if (!subjectName) return DEFAULT_COLOR
    return SUBJECT_COLORS[subjectName] || DEFAULT_COLOR
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Timetable</h1>
          <p className="text-[#5c6670] mt-1">Build and manage class schedules</p>
        </div>
        <div className="flex gap-3">
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input sm:w-48">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <MaterialIcon icon="error" className="text-red-600" />
            <span className="font-semibold text-red-800">{conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected</span>
          </div>
          {conflicts.map((c, i) => (
            <div key={i} className="text-sm text-red-700 ml-7">{c.message}</div>
          ))}
        </div>
      )}

      {!selectedClass ? (
        <div className="card">
          <div className="card-body text-center py-12 text-[#5c6670]">
            <MaterialIcon icon="calendar_month" style={{ fontSize: 48, opacity: 0.5 }} />
            <p className="mt-2">Select a class to view timetable</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-[#f8fafb]">
                  <th className="p-3 text-left text-sm font-semibold text-[#191c1d] w-24">Period</th>
                  {DAYS.map(day => (
                    <th key={day.value} className="p-3 text-center text-sm font-semibold text-[#191c1d]">{day.full}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(period => (
                  <tr key={period.value} className="border-t border-[#e8eaed]">
                    <td className="p-3 bg-[#f8fafb]">
                      <div className="text-sm font-medium text-[#191c1d]">{period.label}</div>
                      <div className="text-xs text-[#5c6670]">{period.start} – {period.end}</div>
                    </td>
                    {DAYS.map(day => {
                      const entry = getEntry(day.value, period.value) as TimetableEntry | undefined
                      const hasConflict = conflicts.some(c =>
                        c.entries.some(e => e.day_of_week === day.value && e.period === period.value)
                      )

                      return (
                        <td key={`${day.value}-${period.value}`} className="p-2">
                          <button
                            onClick={() => handleCellClick(day.value, period.value)}
                            className={`w-full min-h-[72px] p-2 rounded-xl border-2 transition-all text-left group ${
                              entry
                                ? `${getSubjectColor(entry.subjects?.name)} hover:shadow-md`
                                : 'border-dashed border-[#e8eaed] hover:border-[#002045] hover:bg-[#f8fafb]'
                            } ${hasConflict ? 'ring-2 ring-red-400' : ''}`}
                          >
                            {entry ? (
                              <div className="relative">
                                <div className="text-xs font-bold truncate">{entry.subjects?.name || 'Subject'}</div>
                                {entry.teachers?.full_name && (
                                  <div className="text-[10px] opacity-70 truncate mt-0.5">{entry.teachers.full_name}</div>
                                )}
                                {entry.room && (
                                  <div className="text-[10px] opacity-70 truncate">Room: {entry.room}</div>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(entry.id) }}
                                  className="absolute -top-1 -right-1 p-0.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MaterialIcon icon="close" style={{ fontSize: 14 }} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <MaterialIcon icon="add" className="text-[#c4c6cf]" style={{ fontSize: 20 }} />
                              </div>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">
                  {editingEntry ? 'Edit Period' : 'Add Period'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Day</label>
                  <select value={formData.day_of_week} onChange={e => setFormData({...formData, day_of_week: Number(e.target.value)})} className="input">
                    {DAYS.map(d => <option key={d.value} value={d.value}>{d.full}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Period</label>
                  <select value={formData.period} onChange={e => setFormData({...formData, period: Number(e.target.value)})} className="input">
                    {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label} ({p.start})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Subject</label>
                <select value={formData.subject_id} onChange={e => setFormData({...formData, subject_id: e.target.value})} className="input" required>
                  <option value="">Select subject</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Teacher</label>
                <select value={formData.teacher_id} onChange={e => setFormData({...formData, teacher_id: e.target.value})} className="input">
                  <option value="">Select teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Room</label>
                <input type="text" value={formData.room} onChange={e => setFormData({...formData, room: e.target.value})} className="input" placeholder="e.g., Room 1A" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editingEntry ? 'Update' : 'Add Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
