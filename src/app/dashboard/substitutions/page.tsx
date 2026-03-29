'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useClasses } from '@/lib/hooks'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

interface Teacher {
  id: string
  full_name: string
}

interface Substitution {
  id: string
  title: string
  description: string
  start_date: string
  created_at: string
}

interface SubstitutionData {
  absent_teacher_id: string
  substitute_teacher_id: string
  class_id: string
  period: number
  reason: string
  absent_teacher_name?: string
  substitute_teacher_name?: string
  class_name?: string
}

export default function SubstitutionsPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { classes } = useClasses(school?.id)

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [substitutions, setSubstitutions] = useState<Substitution[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [form, setForm] = useState({
    absent_teacher_id: '',
    substitute_teacher_id: '',
    date: new Date().toISOString().split('T')[0],
    period: 1,
    class_id: '',
    reason: 'Sick',
  })

  useEffect(() => {
    if (school?.id) {
      fetchTeachers()
      fetchSubstitutions()
    }
  }, [school?.id])

  useEffect(() => {
    if (school?.id) fetchSubstitutions()
  }, [selectedMonth])

  const fetchTeachers = async () => {
    if (!school?.id) return
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('school_id', school.id)
      .eq('role', 'teacher')
      .eq('is_active', true)
      .order('full_name')
    setTeachers(data || [])
  }

  const fetchSubstitutions = async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const startDate = `${selectedMonth}-01`
      const [year, month] = selectedMonth.split('-').map(Number)
      const endDate = `${selectedMonth}-${new Date(year, month, 0).getDate()}`

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('school_id', school.id)
        .eq('event_type', 'substitution')
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .order('start_date', { ascending: false })

      if (error) throw error
      setSubstitutions(data || [])
    } catch {
      setSubstitutions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return
    if (form.absent_teacher_id === form.substitute_teacher_id) {
      toast.error('Absent and substitute teacher cannot be the same')
      return
    }

    setSaving(true)
    try {
      const absentName = teachers.find(t => t.id === form.absent_teacher_id)?.full_name || 'Unknown'
      const substituteName = teachers.find(t => t.id === form.substitute_teacher_id)?.full_name || 'Unknown'
      const className = classes.find(c => c.id === form.class_id)?.name || 'Unknown'

      const description = JSON.stringify({
        absent_teacher_id: form.absent_teacher_id,
        substitute_teacher_id: form.substitute_teacher_id,
        class_id: form.class_id,
        period: form.period,
        reason: form.reason,
        absent_teacher_name: absentName,
        substitute_teacher_name: substituteName,
        class_name: className,
      })

      const { error } = await supabase
        .from('events')
        .insert({
          school_id: school.id,
          title: `Substitution: ${absentName} → ${substituteName}`,
          description,
          event_type: 'substitution',
          start_date: form.date,
          end_date: form.date,
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
    } catch {
      toast.error('Failed to log substitution')
    } finally {
      setSaving(false)
    }
  }

  const parseSubstitution = (sub: Substitution): SubstitutionData | null => {
    try {
      return JSON.parse(sub.description || '{}')
    } catch {
      return null
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const todaySubs = substitutions.filter(s => s.start_date === today)

  const teacherSubCounts = new Map<string, number>()
  substitutions.forEach(sub => {
    const data = parseSubstitution(sub)
    if (data?.substitute_teacher_name) {
      teacherSubCounts.set(data.substitute_teacher_name, (teacherSubCounts.get(data.substitute_teacher_name) || 0) + 1)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Substitutions</h1>
          <p className="text-[#5c6670] mt-1">Track teacher substitutions and coverage</p>
        </div>
        <div className="flex gap-3">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="input" />
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <MaterialIcon icon="swap_horiz" className="text-lg" />
            Log Substitution
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card"><div className="card-body text-center">
          <div className="text-2xl font-bold text-[#002045]">{substitutions.length}</div>
          <div className="text-sm text-[#5c6670]">Substitutions This Month</div>
        </div></div>
        <div className="card"><div className="card-body text-center">
          <div className="text-2xl font-bold text-blue-600">{todaySubs.length}</div>
          <div className="text-sm text-[#5c6670]">Today&apos;s Substitutions</div>
        </div></div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm font-medium text-[#191c1d] mb-2">Top Substitutes</div>
            {Array.from(teacherSubCounts.entries()).slice(0, 3).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-[#5c6670] truncate">{name}</span>
                <span className="font-medium text-[#191c1d]">{count}</span>
              </div>
            ))}
            {teacherSubCounts.size === 0 && <div className="text-sm text-[#5c6670]">No data</div>}
          </div>
        </div>
      </div>

      {todaySubs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[#191c1d] mb-3">Today&apos;s Substitutions</h2>
          <div className="space-y-3">
            {todaySubs.map((sub) => {
              const data = parseSubstitution(sub)
              if (!data) return null
              return (
                <div key={sub.id} className="bg-white rounded-2xl border-2 border-[#e3f2fd] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-[#191c1d]">
                        {data.absent_teacher_name || 'Unknown'} → {data.substitute_teacher_name || 'Unknown'}
                      </div>
                      <div className="text-sm text-[#5c6670] mt-1">
                        Period {data.period} · {data.class_name || 'Unknown class'}
                      </div>
                      <div className="mt-2">{getReasonBadge(data.reason)}</div>
                    </div>
                    <span className="text-xs text-[#5c6670]">
                      {new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
        <div className="p-4 border-b border-[#e8eaed]">
          <h2 className="font-semibold text-[#191c1d]">History</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-[#5c6670]">Loading...</div>
        ) : substitutions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
              <MaterialIcon icon="swap_horiz" className="text-3xl text-[#5c6670]" />
            </div>
            <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No substitutions yet</h3>
            <p className="text-[#5c6670]">Log a substitution when a teacher is absent</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f8fafb]">
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d]">Date</th>
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d]">Absent Teacher</th>
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d]">Substitute</th>
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d]">Period</th>
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d]">Class</th>
                  <th className="p-4 text-left text-sm font-semibold text-[#191c1d]">Reason</th>
                </tr>
              </thead>
              <tbody>
                {substitutions.map((sub) => {
                  const data = parseSubstitution(sub)
                  if (!data) return null
                  return (
                    <tr key={sub.id} className="border-t border-[#e8eaed]">
                      <td className="p-4 text-sm text-[#191c1d]">
                        {new Date(sub.start_date).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-sm text-[#191c1d]">{data.absent_teacher_name || 'Unknown'}</td>
                      <td className="p-4 text-sm text-[#191c1d]">{data.substitute_teacher_name || 'Unknown'}</td>
                      <td className="p-4 text-sm text-[#191c1d]">{data.period}</td>
                      <td className="p-4 text-sm text-[#191c1d]">{data.class_name || 'Unknown'}</td>
                      <td className="p-4">{getReasonBadge(data.reason)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Log Substitution</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Absent Teacher</label>
                <select
                  value={form.absent_teacher_id}
                  onChange={(e) => setForm({ ...form, absent_teacher_id: e.target.value })}
                  className="input"
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
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Period</label>
                  <select
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: Number(e.target.value) })}
                    className="input"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                      <option key={p} value={p}>Period {p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Class Affected</label>
                <select
                  value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Substitute Teacher</label>
                <select
                  value={form.substitute_teacher_id}
                  onChange={(e) => setForm({ ...form, substitute_teacher_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select substitute</option>
                  {teachers
                    .filter((t) => t.id !== form.absent_teacher_id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Reason</label>
                <select
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="input"
                >
                  <option value="Sick">Sick</option>
                  <option value="Personal">Personal</option>
                  <option value="Training">Training</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? 'Saving...' : 'Log Substitution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
