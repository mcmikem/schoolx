'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { TimetableSlot, TimetableConstraint } from '@/types'
import { getQuerySchoolId } from './utils'
import { isDemoSchool } from '@/lib/demo-utils'
import { DEMO_TIMETABLE, DEMO_SUBJECTS, DEMO_STAFF } from '@/lib/demo-data'

export function useTimetable(classId?: string) {
  const [timetable, setTimetable] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchTimetable() {
      if (!classId) {
        setLoading(false)
        return
      }

      if (isDemo || isDemoSchool(classId)) {
        const classTimetable = DEMO_TIMETABLE.filter(t => t.class_id === classId)
        const enriched = classTimetable.map(t => {
          const subject = DEMO_SUBJECTS.find(s => s.id === t.subject_id)
          const teacher = DEMO_STAFF.find(s => s.id === t.teacher_id)
          return {
            ...t,
            subjects: { name: subject?.name || 'Unknown', code: subject?.code || '' },
            teachers: { full_name: teacher?.full_name || 'Unknown' },
          }
        })
        setTimetable(enriched)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('timetable')
          .select(`
            id,
            day_of_week,
            start_time,
            end_time,
            subject_id,
            teacher_id,
            subjects (name, code),
            teachers:profiles (full_name)
          `)
          .eq('class_id', classId)
          .order('day_of_week')
          .order('start_time')

        if (error) {
          if (error.code === '42P01') {
             setTimetable([])
             return
          }
          throw error
        }
        setTimetable(data || [])
      } catch (err) {
        console.error('Error fetching timetable:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTimetable()
  }, [classId, isDemo])

  const saveEntry = async (entry: any) => {
    if (isDemo) {
      const newEntry = { ...entry, id: entry.id || `demo-tt-${Date.now()}` }
      setTimetable(prev => {
        const idx = prev.findIndex(t => t.id === entry.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = newEntry
          return updated
        }
        return [...prev, newEntry]
      })
      return newEntry
    }
    try {
      const { data, error } = await supabase
        .from('timetable')
        .upsert(entry)
        .select()
        .single()

      if (error) throw error
      setTimetable(prev => {
        const idx = prev.findIndex(t => t.id === entry.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = data
          return updated
        }
        return [...prev, data]
      })
      return data
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const deleteEntry = async (id: string) => {
    if (isDemo) {
      setTimetable(prev => prev.filter(t => t.id !== id))
      return
    }
    try {
      const { error } = await supabase.from('timetable').delete().eq('id', id)
      if (error) throw error
      setTimetable(prev => prev.filter(t => t.id !== id))
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  return { timetable, loading, saveEntry, deleteEntry }
}

export function useTimetableManager(schoolId?: string) {
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [constraints, setConstraints] = useState<TimetableConstraint[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      if (isDemo || isDemoSchool(schoolId)) {
        setSlots([
          { id: 'demo-slot-1', name: 'Period 1', start_time: '08:00', end_time: '08:40', order_number: 1, is_break: false },
          { id: 'demo-slot-2', name: 'Period 2', start_time: '08:40', end_time: '09:20', order_number: 2, is_break: false },
          { id: 'demo-slot-3', name: 'Break', start_time: '09:20', end_time: '09:40', order_number: 3, is_break: true },
        ] as unknown as TimetableSlot[])
        setConstraints([] as unknown as TimetableConstraint[])
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const [slotsRes, constraintsRes] = await Promise.all([
          supabase.from('timetable_slots').select('id, name, start_time, end_time, order_number, is_break').eq('school_id', querySchoolId).order('order_number'),
          supabase.from('timetable_constraints').select('id, type, value, priority').eq('school_id', querySchoolId)
        ])

        if (slotsRes.error) throw slotsRes.error
        if (constraintsRes.error) throw constraintsRes.error

        setSlots((slotsRes.data || []) as unknown as TimetableSlot[])
        setConstraints((constraintsRes.data || []) as unknown as TimetableConstraint[])
      } catch (err) {
        console.error('Error fetching timetable data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [schoolId, isDemo])

  return { slots, constraints, loading }
}
