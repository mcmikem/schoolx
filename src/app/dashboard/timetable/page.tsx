'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses, useSubjects, useTimetableManager } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'

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
      academic_year: '2026'
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

  const dayTabs = DAYS.map(day => ({
    id: day.value.toString(),
    label: day.full
  }))

  if (loadingSlots) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader title="Timetable" subtitle="Loading configuration..." />
        <Card>
          <TableSkeleton rows={6} />
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Timetable" 
        subtitle="Schedule lessons and resolve conflicts"
        actions={
          classes.length === 0 ? (
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
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)]">
          <Tabs 
            tabs={dayTabs} 
            activeTab={selectedDay.toString()} 
            onChange={(id) => setSelectedDay(parseInt(id))}
          />
        </div>
        
        {DAYS.map(day => (
          <TabPanel key={day.value} activeTab={selectedDay.toString()} tabId={day.value.toString()}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-4 bg-[var(--surface-container-low)] border-b border-r border-[var(--border)] text-[var(--t4)] text-xs uppercase font-bold w-32 text-left">
                      Time / Day
                    </th>
                    <th className="p-4 bg-[var(--surface-container-low)] border-b border-r border-[var(--border)] text-[var(--t1)] font-semibold text-left">
                      {day.full}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map(slot => (
                    <tr key={slot.id} className={!slot.is_lesson ? 'bg-[var(--surface-container-low)]/50' : ''}>
                      <td className="p-4 border-b border-r border-[var(--border)]">
                        <p className="text-sm font-semibold text-[var(--t1)]">{slot.name}</p>
                        <p className="text-xs text-[var(--t4)]">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</p>
                      </td>
                      
                      <td 
                        className={`p-2 border-b border-[var(--border)] min-h-[100px] relative ${!slot.is_lesson ? 'opacity-50' : ''}`}
                      >
                        {getEntry(day.value, slot.id) ? (
                          <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg p-3 h-full">
                            <p className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider mb-1">
                              {getEntry(day.value, slot.id).subjects?.code || 'SUB'}
                            </p>
                            <p className="text-sm font-semibold text-[var(--t1)] leading-tight mb-2">
                              {getEntry(day.value, slot.id).subjects?.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-[var(--t4)]">
                              <MaterialIcon icon="person" className="text-sm" />
                              {getEntry(day.value, slot.id).users?.full_name || 'Teacher'}
                            </div>
                          </div>
                        ) : (
                          slot.is_lesson && selectedClassId && (
                            <button 
                              onClick={() => { setSelectedSlot(slot); setSelectedDay(day.value); setShowEntryModal(true); }}
                              className="w-full h-full min-h-[60px] flex items-center justify-center border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5 rounded-xl transition-all"
                            >
                              <MaterialIcon icon="add" className="text-[var(--t4)] hover:text-[var(--primary)]" />
                            </button>
                          )
                        )}
                        {!slot.is_lesson && (
                          <div className="flex items-center justify-center text-xs font-bold text-[var(--t4)] uppercase tracking-[0.2em] rotate-[-45deg]">
                            {slot.name}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabPanel>
        ))}
      </Card>

      {showEntryModal && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[var(--t1)]">Assign Lesson</h2>
              <button onClick={() => setShowEntryModal(false)} className="text-[var(--t4)] hover:text-[var(--t1)]">
                <MaterialIcon icon="close" />
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-4">
              <div className="p-3 bg-[var(--primary)]/10 rounded-xl mb-4">
                <p className="text-xs text-[var(--primary)] font-semibold uppercase mb-1">Schedule Slot</p>
                <p className="text-sm text-[var(--t1)] font-medium">
                  {DAYS.find(d => d.value === selectedDay)?.full} · {selectedSlot.name} ({selectedSlot.start_time.slice(0,5)} - {selectedSlot.end_time.slice(0,5)})
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--t2)]">Subject</label>
                <select name="subject_id" required className="w-full px-4 py-3 bg-[var(--surface-container-low)] border border-[var(--border)] rounded-xl text-[var(--on-surface)]">
                  <option value="">Choose subject...</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--t2)]">Teacher</label>
                <select name="teacher_id" required className="w-full px-4 py-3 bg-[var(--surface-container-low)] border border-[var(--border)] rounded-xl text-[var(--on-surface)]">
                  <option value="">Select teacher...</option>
                  <option value="1">Demo Teacher 1</option>
                  <option value="2">Demo Teacher 2</option>
                </select>
              </div>

              <Button type="submit" className="w-full mt-4">
                Add to Timetable
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
