'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses, useSubjects, useTimetable } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

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
          <h1 className="text-2xl font-bold text-[#002045]">Timetable</h1>
          <p className="text-[#5c6670] mt-1">Manage class schedules</p>
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
            <MaterialIcon icon="add" className="text-lg" />
            Add Entry
          </button>
        </div>
      </div>

      {!selectedClass ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="calendar_month" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">Select a class</h3>
          <p className="text-[#5c6670]">Choose a class to view its timetable</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-[#f8fafb]">
                  <th className="w-20 p-4 text-left text-sm font-semibold text-[#191c1d]">Time</th>
                  {DAYS.map(day => (
                    <th key={day.value} className="p-4 text-left text-sm font-semibold text-[#191c1d]">{day.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((time) => (
                  <tr key={time} className="border-t border-[#e8eaed]">
                    <td className="p-4 font-medium text-[#191c1d]">{time}</td>
                    {DAYS.map(day => {
                      const entry = timetable.find(
                        (t: Record<string, unknown>) => t.day_of_week === day.value && 
                          (t.start_time as string)?.startsWith(time)
                      )
                      return (
                        <td key={`${day.value}-${time}`} className="p-2">
                          {entry ? (
                            <div className="bg-[#e3f2fd] p-3 rounded-xl group relative">
                              <div className="font-medium text-[#002045] text-sm">
                                {(entry as Record<string, unknown>).subjects ? 
                                  ((entry as Record<string, unknown>).subjects as Record<string, string>)?.name : 
                                  'Subject'}
                              </div>
                              <div className="text-xs text-[#5c6670] mt-1">
                                {(entry as Record<string, unknown>).teachers ? 
                                  ((entry as Record<string, unknown>).teachers as Record<string, string>)?.full_name : 
                                  'No teacher'}
                              </div>
                              <div className="text-xs text-[#5c6670] mt-1">
                                {entry.start_time as string} - {entry.end_time as string}
                              </div>
                              <button 
                                onClick={() => handleDelete(entry.id as string)}
                                className="absolute top-2 right-2 p-1 text-[#ba1a1a] hover:text-[#93000a] opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MaterialIcon icon="delete" className="text-lg" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => { setEditingEntry({ day_of_week: day.value, start_time: time }); setIsModalOpen(true) }}
                              className="w-full h-full min-h-[60px] border-2 border-dashed border-[#e8eaed] rounded-xl hover:border-[#002045] hover:bg-[#f8fafb] transition-all flex items-center justify-center"
                            >
                              <MaterialIcon icon="add" className="text-[#c4c6cf]" />
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
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">
                  {editingEntry?.id ? 'Edit Entry' : 'Add Entry'}
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
                  <select name="day_of_week" defaultValue={editingEntry?.day_of_week as string | number | undefined} className="input">
                    {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Start Time</label>
                  <input type="time" name="start_time" defaultValue={editingEntry?.start_time as string | undefined} className="input" required />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Subject</label>
                <select name="subject_id" defaultValue={editingEntry?.subject_id as string | undefined} className="input" required>
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Teacher</label>
                <select name="teacher_id" defaultValue={editingEntry?.teacher_id as string | undefined} className="input">
                  <option value="">Select teacher</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">End Time</label>
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