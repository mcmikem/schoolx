'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useClasses } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

interface Teacher {
  id: string
  full_name: string
}

export default function SubstitutionsPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { classes } = useClasses(school?.id)

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [substitutions, setSubstitutions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [availability, setAvailability] = useState<{ status: 'loading' | 'free' | 'busy' | 'idle', message?: string }>({ status: 'idle' })
  const [form, setForm] = useState({
    absent_teacher_id: '',
    substitute_teacher_id: '',
    date: new Date().toISOString().split('T')[0],
    period: 1,
    class_id: '',
    reason: 'Sick',
  })

  const fetchTeachers = useCallback(async () => {
    if (!school?.id) return
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('school_id', school.id)
      .eq('role', 'teacher')
      .eq('is_active', true)
      .order('full_name')
    setTeachers(data || [])
  }, [school?.id])

  const fetchSubstitutions = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const startDate = `${selectedMonth}-01`
      const [year, month] = selectedMonth.split('-').map(Number)
      const endDate = `${selectedMonth}-${new Date(year, month, 0).getDate()}`

      const { data, error } = await supabase
        .from('teacher_substitutions')
        .select('*, absent_teacher:absent_teacher_id(full_name), substitute_teacher:substitute_teacher_id(full_name), class:class_id(name)')
        .eq('school_id', school.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      if (error) {
        console.error('Error fetching substitutions:', error)
        setSubstitutions([])
        return
      }
      setSubstitutions(data || [])
    } catch {
      setSubstitutions([])
    } finally {
      setLoading(false)
    }
  }, [school?.id, selectedMonth])

  const checkAvailability = useCallback(async () => {
    if (!form.substitute_teacher_id || !form.date || !form.period || !school?.id) return
    
    setAvailability({ status: 'loading' })
    try {
      const dateObj = new Date(form.date)
      const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay() // 1-7 (Mon-Sun)
      
      // 1. Check Regular Timetable
      const { data: timetableEntries } = await supabase
        .from('teacher_timetable')
        .select('id, subjects(name), classes(name)')
        .eq('teacher_id', form.substitute_teacher_id)
        .eq('day_of_week', dayOfWeek)
        .eq('period_number', form.period)
        .maybeSingle()

      if (timetableEntries) {
        const entry = timetableEntries as any
        setAvailability({ 
          status: 'busy', 
          message: `Already teaching ${entry.subjects?.name || 'Subject'} in ${entry.classes?.name || 'Class'}` 
        })
        return
      }

      // 2. Check other substitutions for this day/period
      const { data: existingSub } = await supabase
        .from('teacher_substitutions')
        .select('id, class:class_id(name)')
        .eq('substitute_teacher_id', form.substitute_teacher_id)
        .eq('date', form.date)
        .eq('period', form.period)
        .maybeSingle()

      if (existingSub) {
        setAvailability({ 
          status: 'busy', 
          message: `Already substituting in ${(existingSub.class as any)?.name || 'Class'}` 
        })
        return
      }

      setAvailability({ status: 'free', message: 'Teacher is available' })
    } catch (err) {
      console.error('Availability check failed', err)
      setAvailability({ status: 'idle' })
    }
  }, [form.substitute_teacher_id, form.date, form.period, school?.id])

  useEffect(() => {
    if (form.substitute_teacher_id) checkAvailability()
  }, [form.substitute_teacher_id, form.date, form.period, checkAvailability])

  useEffect(() => {
    if (school?.id) {
      fetchTeachers()
      fetchSubstitutions()
    }
  }, [school?.id, fetchTeachers, fetchSubstitutions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return
    if (form.absent_teacher_id === form.substitute_teacher_id) {
      toast.error('Absent and substitute teacher cannot be the same')
      return
    }

    if (availability.status === 'busy') {
      const proceed = confirm(`Warning: ${availability.message}. Do you still want to log this substitution?`)
      if (!proceed) return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('teacher_substitutions')
        .insert({
          school_id: school.id,
          absent_teacher_id: form.absent_teacher_id,
          substitute_teacher_id: form.substitute_teacher_id,
          class_id: form.class_id,
          date: form.date,
          period: form.period,
          reason: form.reason,
          status: 'completed'
        })

      if (error) throw error

      toast.success('Substitution logged')
      setShowModal(false)
      setForm({
        absent_teacher_id: '',
        substitute_teacher_id: '',
        date: new Date().toISOString().split('T')[0],
        period: 1,
        class_id: '',
        reason: 'Sick',
      })
      fetchSubstitutions()
    } catch (err) {
      console.error('Failed to log substitution', err)
      toast.error('Failed to log substitution')
    } finally {
      setSaving(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const todaySubs = substitutions.filter(s => s.date === today)

  const teacherSubCounts = new Map<string, number>()
  substitutions.forEach(sub => {
    const name = sub.substitute_teacher?.full_name
    if (name) {
      teacherSubCounts.set(name, (teacherSubCounts.get(name) || 0) + 1)
    }
  })

  const getReasonBadge = (reason: string) => {
    const colors: Record<string, string> = {
      Sick: 'bg-red-100 text-red-800',
      Personal: 'bg-blue-100 text-blue-800',
      Training: 'bg-purple-100 text-purple-800',
      Other: 'bg-gray-100 text-gray-800',
    }
    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${colors[reason] || colors.Other}`}>
        {reason}
      </span>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Substitutions"
        subtitle="Track teacher substitutions and coverage"
        actions={
          <div className="flex gap-3">
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium" />
            <Button onClick={() => setShowModal(true)}>
              <MaterialIcon icon="swap_horiz" className="text-lg" />
              Log Substitution
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--primary)]">{substitutions.length}</div>
          <div className="text-sm text-[var(--t3)]">Substitutions This Month</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{todaySubs.length}</div>
          <div className="text-sm text-[var(--t3)]">Today&apos;s Substitutions</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-[var(--t1)] mb-2">Top Substitutes</div>
          {Array.from(teacherSubCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => (
            <div key={name} className="flex items-center justify-between text-sm">
              <span className="text-[var(--t3)] truncate">{name}</span>
              <span className="font-medium text-[var(--t1)]">{count}</span>
            </div>
          ))}
          {teacherSubCounts.size === 0 && <div className="text-sm text-[var(--t3)]">No data</div>}
        </Card>
      </div>

      {todaySubs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[var(--t1)] mb-3">Today&apos;s Substitutions</h2>
          <div className="space-y-3">
            {todaySubs.map((sub) => {
              return (
                <Card key={sub.id} className="p-4 border-2 border-blue-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-[var(--t1)]">
                        {sub.absent_teacher?.full_name || 'Unknown'} → {sub.substitute_teacher?.full_name || 'Unknown'}
                      </div>
                      <div className="text-sm text-[var(--t3)] mt-1">
                        Period {sub.period} · {sub.class?.name || 'Unknown class'}
                      </div>
                      <div className="mt-2">{getReasonBadge(sub.reason)}</div>
                    </div>
                    <span className="text-xs text-[var(--t3)]">
                      {new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <Card>
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--t1)]">History</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-[var(--t3)]">Loading...</div>
        ) : substitutions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-[var(--surface-container)] rounded-full flex items-center justify-center mx-auto mb-4">
              <MaterialIcon className="text-3xl text-[var(--t3)]">swap_horiz</MaterialIcon>
            </div>
            <h3 className="text-lg font-semibold text-[var(--t1)] mb-2">No substitutions yet</h3>
            <p className="text-[var(--t3)]">Log a substitution when a teacher is absent</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Date</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Absent Teacher</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Substitute</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Period</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Class</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Reason</th>
                </tr>
              </thead>
              <tbody>
                {substitutions.map((sub) => {
                  return (
                    <tr key={sub.id} className="border-t border-[var(--border)]">
                      <td className="p-4 text-sm text-[var(--t1)]">
                        {new Date(sub.date).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-sm text-[var(--t1)]">{sub.absent_teacher?.full_name || 'Unknown'}</td>
                      <td className="p-4 text-sm text-[var(--t1)]">{sub.substitute_teacher?.full_name || 'Unknown'}</td>
                      <td className="p-4 text-sm text-[var(--t1)]">{sub.period}</td>
                      <td className="p-4 text-sm text-[var(--t1)]">{sub.class?.name || 'Unknown'}</td>
                      <td className="p-4">{getReasonBadge(sub.reason)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--t1)]">Log Substitution</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-[var(--t3)] hover:text-[var(--t1)]">
                  <MaterialIcon className="text-xl" icon="close" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Absent Teacher</label>
                <select
                  value={form.absent_teacher_id}
                  onChange={(e) => setForm({ ...form, absent_teacher_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                >
                  <option value="">Select teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Period</label>
                  <select
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                      <option key={p} value={p}>Period {p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Class Affected</label>
                <select
                  value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Substitute Teacher</label>
                <select
                  value={form.substitute_teacher_id}
                  onChange={(e) => setForm({ ...form, substitute_teacher_id: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border bg-[var(--surface)] text-[var(--on-surface)] ${
                    availability.status === 'busy' ? 'border-red-500 bg-red-50' : 
                    availability.status === 'free' ? 'border-green-500 bg-green-50' : 
                    'border-[var(--border)]'
                  }`}
                  required
                >
                  <option value="">Select substitute</option>
                  {teachers
                    .filter((t) => t.id !== form.absent_teacher_id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                </select>
                {availability.status !== 'idle' && (
                  <div className={`mt-2 text-xs font-medium flex items-center gap-1 ${
                    availability.status === 'busy' ? 'text-red-600' : 
                    availability.status === 'free' ? 'text-green-600' : 
                    'text-[var(--t3)]'
                  }`}>
                    {availability.status === 'loading' ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /> 
                        Checking availability...
                      </span>
                    ) : (
                      <>
                        <MaterialIcon icon={availability.status === 'busy' ? 'warning' : 'check_circle'} className="text-base" />
                        {availability.message}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Reason</label>
                <select
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                >
                  <option value="Sick">Sick</option>
                  <option value="Personal">Personal</option>
                  <option value="Training">Training</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" disabled={saving}>
                  {saving ? 'Saving...' : 'Log Substitution'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
