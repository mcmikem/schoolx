'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { TimetableSlot, TimetableConstraint } from '@/types'
import { getQuerySchoolId } from './utils'

export function useTimetable(classId?: string) {
  const [timetable, setTimetable] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTimetable() {
      if (!classId) {
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
  }, [classId])

  const saveEntry = async (entry: any) => {
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
