'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses, useSubjects, useTimetableManager } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import GlassCard from '@/components/GlassCard'

function MaterialIcon({ icon, className }: { icon: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{icon}</span>
}

const DAYS = [
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
]

export default function TimetablePage() {
  const { school } = useAuth()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  const { slots, loading: loadingSlots } = useTimetableManager(school?.id)
  
  const [selectedClassId, setSelectedClassId] = useState('')
  const [timetable, setTimetable] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [selectedDay, setSelectedDay] = useState<number>(1)

  const fetchTimetable = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('teacher_timetable')
        .select('*, subjects(name, code), users:teacher_id(full_name)')
        .eq('class_id', selectedClassId)
      
      if (error) throw error
      setTimetable(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedClassId])

  useEffect(() => {
    if (selectedClassId) fetchTimetable()
  }, [selectedClassId, fetchTimetable])

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const entryData = {
      school_id: school!.id,
      class_id: selectedClassId,
      subject_id: formData.get('subject_id'),
      teacher_id: formData.get('teacher_id'),
      day_of_week: selectedDay,
      slot_id: selectedSlot.id,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      academic_year: '2026' // Simplified
    }

    try {
      const { error } = await supabase.from('teacher_timetable').insert([entryData])
      if (error) throw error
      toast.success('Timetable entry added')
      setShowEntryModal(false)
      fetchTimetable()
    } catch (err: any) {
      toast.error(`Conflict or error: ${err.message}`)
    }
  }

  const getEntry = (day: number, slotId: string) => {
    return timetable.find(t => t.day_of_week === day && t.slot_id === slotId)
  }

  if (loadingSlots) return <div className="p-8 text-white">Loading configuration...</div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Interactive Timetable</h1>
          <p className="text-white/60">Schedule lessons and resolve conflicts</p>
        </div>

        {classes.length === 0 ? (
          <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-2 text-amber-200 text-sm">No classes available</div>
        ) : (
          <select 
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="" className="bg-slate-900">Select a Class...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <GlassCard className="overflow-x-auto p-0">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-4 bg-white/5 border-b border-r border-white/10 text-white/40 text-xs uppercase font-bold w-32">Time / Day</th>
              {DAYS.map(day => (
                <th key={day.value} className="p-4 bg-white/5 border-b border-r border-white/10 text-white font-bold">
                  {day.full}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map(slot => (
              <tr key={slot.id} className={slot.is_lesson ? '' : 'bg-white/[0.02]'}>
                <td className="p-4 border-b border-r border-white/10">
                  <p className="text-sm font-bold text-white">{slot.name}</p>
                  <p className="text-[10px] text-white/40">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</p>
                </td>
                
                {DAYS.map(day => {
                  const entry = getEntry(day.value, slot.id)
                  return (
                    <td 
                      key={`${day.value}-${slot.id}`}
                      className={`p-2 border-b border-r border-white/10 min-h-[100px] relative group ${!slot.is_lesson ? 'bg-stripe-pattern opacity-50' : ''}`}
                    >
                      {entry ? (
                        <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-3 h-full animate-in fade-in duration-300">
                          <p className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">{entry.subjects?.code || 'SUB'}</p>
                          <p className="text-sm font-semibold text-white leading-tight mb-2">{entry.subjects?.name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                            <MaterialIcon icon="person" className="text-[12px]" />
                            {entry.users?.full_name || 'Teacher'}
                          </div>
                        </div>
                      ) : (
                        slot.is_lesson && selectedClassId && (
                          <button 
                            onClick={() => { setSelectedSlot(slot); setSelectedDay(day.value); setShowEntryModal(true); }}
                            className="w-full h-full min-h-[60px] flex items-center justify-center border-2 border-dashed border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 rounded-xl transition-all group-hover:scale-[0.98]"
                          >
                            <MaterialIcon icon="add" className="text-white/10 group-hover:text-purple-400" />
                          </button>
                        )
                      )}
                      {!slot.is_lesson && (
                        <div className="flex items-center justify-center text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] rotate-[-45deg]">
                          {slot.name}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      {showEntryModal && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Assign Lesson</h2>
              <button onClick={() => setShowEntryModal(false)} className="text-white/40 hover:text-white">
                <MaterialIcon icon="close" />
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-4">
              <div className="p-3 bg-purple-500/10 rounded-xl mb-4">
                <p className="text-xs text-purple-400 font-bold uppercase mb-1">Schedule Slot</p>
                <p className="text-sm text-white font-medium">
                  {DAYS.find(d => d.value === selectedDay)?.full} · {selectedSlot.name} ({selectedSlot.start_time.slice(0,5)} - {selectedSlot.end_time.slice(0,5)})
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Subject</label>
                <select name="subject_id" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white">
                  <option value="" className="bg-slate-900">Choose subject...</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Teacher</label>
                <select name="teacher_id" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white">
                  <option value="" className="bg-slate-900">Select teacher...</option>
                  <option value="1" className="bg-slate-900">Demo Teacher 1</option>
                  <option value="2" className="bg-slate-900">Demo Teacher 2</option>
                </select>
              </div>

              <button type="submit" className="w-full py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 mt-4">
                Add to Timetable
              </button>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
