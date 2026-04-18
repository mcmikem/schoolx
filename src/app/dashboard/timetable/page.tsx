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
  }, [selectedClassId, toast])

  // Fetch ALL class timetables for the school to enable cross-class conflict detection
  const fetchAllTimetables = useCallback(async () => {
    if (!school?.id) return
    try {
      const classIds = classes.map((c: any) => c.id)
      if (classIds.length === 0) {
        setAllClassTimetables([])
        return
      }

      const { data } = await supabase
        .from('teacher_timetable')
        .select('teacher_id, day_of_week, period_number, class_id')
        .in('class_id', classIds)
      setAllClassTimetables(data || [])
    } catch (err) {
      console.error('Error fetching all timetables:', err)
    }
  }, [school?.id, classes])

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

  if (loadingSlots) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader title="Timetable" subtitle="Loading configuration..." />
        <Card><TableSkeleton rows={6} /></Card>
      </div>
    )
  }

  return (
    <PageErrorBoundary>
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Timetable"
        subtitle="Schedule lessons — conflicts are detected automatically"
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
              {classes.map((c: any) => (
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
                    {slots.map((slot: any) => {
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
    </div>
    </PageErrorBoundary>
  )
}
