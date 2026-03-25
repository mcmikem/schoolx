'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses, useSubjects, useTimetable } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'
]

export default function TimetablePage() {
  const { school } = useAuth()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  const [selectedClass, setSelectedClass] = useState('')
  const { timetable, saveEntry, deleteEntry } = useTimetable(selectedClass)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Record<string, unknown> | null>(null)
  const [teachers, setTeachers] = useState<Array<{id: string, full_name: string}>>([])

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

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const entry = {
      id: editingEntry?.id as string | undefined,
      class_id: selectedClass,
      subject_id: formData.get('subject_id') as string,
      teacher_id: formData.get('teacher_id') as string || undefined,
      day_of_week: Number(formData.get('day_of_week')),
      start_time: formData.get('start_time') as string,
      end_time: formData.get('end_time') as string,
    }

    try {
      await saveEntry(entry)
      toast.success('Timetable entry saved')
      setIsModalOpen(false)
      setEditingEntry(null)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save'
      toast.error(errorMessage)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this timetable entry?')) return
    try {
      await deleteEntry(id)
      toast.success('Entry deleted')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete'
      toast.error(errorMessage)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timetable</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage class schedules</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)} 
            className="input sm:w-48"
          >
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => { setEditingEntry(null); setIsModalOpen(true) }} className="btn btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Entry
          </button>
        </div>
      </div>

      {!selectedClass ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a class</h3>
          <p className="text-gray-500 dark:text-gray-400">Choose a class to view its timetable</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-wrapper w-full">
            <thead>
              <tr>
                <th className="w-20">Time</th>
                {DAYS.map(day => (
                  <th key={day.value}>{day.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((time) => (
                <tr key={time}>
                  <td className="font-medium text-gray-900 dark:text-white">{time}</td>
                  {DAYS.map(day => {
                    const entry = timetable.find(
                      (t: Record<string, unknown>) => t.day_of_week === day.value && 
                        (t.start_time as string)?.startsWith(time)
                    )
                    return (
                      <td key={`${day.value}-${time}`} className="p-2">
                        {entry ? (
                          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg group relative">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                              {(entry as Record<string, unknown>).subjects ? 
                                ((entry as Record<string, unknown>).subjects as Record<string, string>)?.name : 
                                'Subject'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {(entry as Record<string, unknown>).teachers ? 
                                ((entry as Record<string, unknown>).teachers as Record<string, string>)?.full_name : 
                                'No teacher'}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {entry.start_time as string} - {entry.end_time as string}
                            </div>
                            <button 
                              onClick={() => handleDelete(entry.id as string)}
                              className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => { setEditingEntry({ day_of_week: day.value, start_time: time }); setIsModalOpen(true) }}
                            className="w-full h-full min-h-[60px] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-500 transition-colors flex items-center justify-center"
                          >
                            <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingEntry?.id ? 'Edit Entry' : 'Add Entry'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Day</label>
                  <select name="day_of_week" defaultValue={editingEntry?.day_of_week as string | number | undefined} className="input">
                    {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Start Time</label>
                  <input type="time" name="start_time" defaultValue={editingEntry?.start_time as string | undefined} className="input" required />
                </div>
              </div>
              <div>
                <label className="label">Subject</label>
                <select name="subject_id" defaultValue={editingEntry?.subject_id as string | undefined} className="input" required>
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Teacher</label>
                <select name="teacher_id" defaultValue={editingEntry?.teacher_id as string | undefined} className="input">
                  <option value="">Select teacher</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">End Time</label>
                <input type="time" name="end_time" defaultValue={editingEntry?.end_time as string | undefined} className="input" required />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
