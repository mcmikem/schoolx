'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface TimetableEntry {
  id: string
  teacher_id: string
  class_id: string
  subject_id: string
  day_of_week: number
  start_time: string
  end_time: string
  subjects?: { name: string; code: string }
  classes?: { name: string }
}

interface TeacherWorkload {
  teacher_id: string
  teacher_name: string
  total_periods: number
  classes: string[]
  subjects: string[]
  rating: 'Light' | 'Normal' | 'Heavy' | 'Overloaded'
}

export default function WorkloadPage() {
  const { school } = useAuth()
  const [timetable, setTimetable] = useState<TimetableEntry[]>([])
  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (school?.id) {
      fetchData()
    }
  }, [school?.id])

  const fetchData = async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const [ttRes, tRes] = await Promise.all([
        supabase
          .from('timetable')
          .select(`
            *,
            subjects (name, code),
            classes (name)
          `)
          .eq('school_id', school.id),
        supabase
          .from('users')
          .select('id, full_name')
          .eq('school_id', school.id)
          .eq('role', 'teacher')
          .eq('is_active', true)
      ])

      if (!ttRes.error) setTimetable(ttRes.data || [])
      if (!tRes.error) setTeachers(tRes.data || [])
    } catch {
      console.error('Error fetching workload data')
    } finally {
      setLoading(false)
    }
  }

  const workloads = useMemo<TeacherWorkload[]>(() => {
    return teachers.map((teacher) => {
      const entries = timetable.filter(t => t.teacher_id === teacher.id)
      const classNames = Array.from(new Set(entries.map(e => e.classes?.name || 'Unknown')))
      const subjectNames = Array.from(new Set(entries.map(e => e.subjects?.name || 'Unknown')))
      const total = entries.length

      let rating: TeacherWorkload['rating']
      if (total < 20) rating = 'Light'
      else if (total <= 30) rating = 'Normal'
      else if (total <= 35) rating = 'Heavy'
      else rating = 'Overloaded'

      return {
        teacher_id: teacher.id,
        teacher_name: teacher.full_name,
        total_periods: total,
        classes: classNames,
        subjects: subjectNames,
        rating,
      }
    }).sort((a, b) => b.total_periods - a.total_periods)
  }, [teachers, timetable])

  const getRatingStyle = (rating: TeacherWorkload['rating']) => {
    switch (rating) {
      case 'Light': return { bg: 'bg-[#e8f5e9]', text: 'text-[#006e1c]', bar: 'bg-green-500' }
      case 'Normal': return { bg: 'bg-[#fff8e1]', text: 'text-[#b8860b]', bar: 'bg-yellow-500' }
      case 'Heavy': return { bg: 'bg-[#fff3e0]', text: 'text-[#b86e00]', bar: 'bg-orange-500' }
      case 'Overloaded': return { bg: 'bg-[#fef2f2]', text: 'text-[#ba1a1a]', bar: 'bg-red-500' }
    }
  }

  const overloaded = workloads.filter(w => w.rating === 'Overloaded')

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Teacher Workload</h1>
        <p className="text-[#5c6670] mt-1">Period distribution based on timetable</p>
      </div>

      {overloaded.length > 0 && (
        <div className="bg-[#fef2f2] border border-red-200 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <MaterialIcon icon="warning" className="text-xl text-red-600 mt-0.5" />
            <div>
              <div className="font-medium text-red-800">Overloaded Teachers</div>
              <div className="text-sm text-red-700 mt-1">
                {overloaded.map(t => `${t.teacher_name} (${t.total_periods} periods)`).join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(['Light', 'Normal', 'Heavy', 'Overloaded'] as const).map((rating) => {
          const count = workloads.filter(w => w.rating === rating).length
          const style = getRatingStyle(rating)
          return (
            <div key={rating} className={`rounded-2xl border border-[#e8eaed] p-4 text-center`}>
              <div className={`text-2xl font-bold ${style.text}`}>{count}</div>
              <div className="text-sm text-[#5c6670]">{rating}</div>
            </div>
          )
        })}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-8 text-center text-[#5c6670]">Loading...</div>
      ) : workloads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="monitoring" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No timetable data</h3>
          <p className="text-[#5c6670]">Add timetable entries to see teacher workload</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f8fafb]">
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d]">Teacher</th>
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d]">Periods/Week</th>
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d]">Workload</th>
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d] hidden md:table-cell">Classes</th>
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d] hidden lg:table-cell">Subjects</th>
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d]">Rating</th>
                </tr>
              </thead>
              <tbody>
                {workloads.map((w) => {
                  const style = getRatingStyle(w.rating)
                  const barWidth = Math.min((w.total_periods / 40) * 100, 100)
                  return (
                    <tr key={w.teacher_id} className="border-t border-[#e8eaed]">
                      <td className="p-4">
                        <div className="font-medium text-[#191c1d]">{w.teacher_name}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-medium text-[#191c1d]">{w.total_periods}</div>
                        <div className="w-24 h-2 bg-[#e8eaed] rounded-full mt-1">
                          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${barWidth}%` }} />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="w-24 h-2 bg-[#e8eaed] rounded-full">
                          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${barWidth}%` }} />
                        </div>
                        <div className="text-xs text-[#5c6670] mt-1">{barWidth.toFixed(0)}%</div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <div className="text-sm text-[#5c6670]">
                          {w.classes.length > 0 ? w.classes.join(', ') : '-'}
                        </div>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <div className="text-sm text-[#5c6670]">
                          {w.subjects.length > 0 ? w.subjects.join(', ') : '-'}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
                          {w.rating}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
