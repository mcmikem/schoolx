'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface LeaveRequest {
  id: string
  staff_id: string
  leave_type: string
  start_date: string
  end_date: string
  days_count: number
  reason: string
  status: string
  substitute_suggestion: string | null
  created_at: string
  users?: { full_name: string }
}

const LEAVE_TYPES = [
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'study', label: 'Study Leave' },
  { value: 'other', label: 'Other' },
]

export default function LeavePage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'dos_approved' | 'approved' | 'rejected'>('all')
  const [form, setForm] = useState({
    leave_type: 'sick',
    start_date: '',
    end_date: '',
    reason: '',
    substitute_suggestion: '',
  })

  const fetchRequests = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*, users!staff_id(full_name)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRequests(data || [])
    } catch {
      console.error('Error fetching leave requests')
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  useEffect(() => {
    if (school?.id) fetchRequests()
  }, [school?.id, fetchRequests])

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0
    const diff = new Date(end).getTime() - new Date(start).getTime()
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id || !user?.id) return

    setSaving(true)
    try {
      const days = calcDays(form.start_date, form.end_date)

      const { data, error } = await supabase
        .from('leave_requests')
        .insert({
          school_id: school.id,
          staff_id: user.id,
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date,
          days_count: days,
          reason: form.reason,
          substitute_suggestion: form.substitute_suggestion || null,
          status: 'pending',
        })
        .select('*, users!staff_id(full_name)')
        .single()

      if (error) throw error

      setRequests(prev => [data, ...prev])
      toast.success('Leave request submitted')
      setShowModal(false)
      setForm({ leave_type: 'sick', start_date: '', end_date: '', reason: '', substitute_suggestion: '' })
    } catch {
      toast.error('Failed to submit leave request')
    } finally {
      setSaving(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-[#fff8e1]', text: 'text-[#b8860b]', label: 'Pending' },
      dos_approved: { bg: 'bg-[#e3f2fd]', text: 'text-[#002045]', label: 'DOS Approved' },
      approved: { bg: 'bg-[#e8f5e9]', text: 'text-[#006e1c]', label: 'HM Approved' },
      rejected: { bg: 'bg-[#fef2f2]', text: 'text-[#ba1a1a]', label: 'Rejected' },
    }
    const s = styles[status] || styles.pending
    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    )
  }

  const getLeaveTypeLabel = (type: string) => {
    return LEAVE_TYPES.find(t => t.value === type)?.label || type
  }

  const filteredRequests = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const dosApprovedCount = requests.filter(r => r.status === 'dos_approved').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">My Leave Requests</h1>
          <p className="text-[#5c6670] mt-1">Submit and track your leave applications</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <MaterialIcon icon="add" className="text-lg" />
          Request Leave
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {([
          { key: 'all', label: 'All', count: requests.length },
          { key: 'pending', label: 'Pending', count: pendingCount },
          { key: 'dos_approved', label: 'DOS Approved', count: dosApprovedCount },
          { key: 'approved', label: 'HM Approved', count: approvedCount },
          { key: 'rejected', label: 'Rejected', count: rejectedCount },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-2xl border p-3 text-center transition-all ${
              filter === f.key ? 'border-2 border-blue-500 bg-white' : 'border-[#e8eaed] bg-white'
            }`}
          >
            <div className="text-xl font-bold text-[#002045]">{f.count}</div>
            <div className="text-xs text-[#5c6670]">{f.label}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-8 text-center text-[#5c6670]">Loading...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="event_busy" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No leave requests</h3>
          <p className="text-[#5c6670]">Submit a request when you need time off</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#191c1d]">{getLeaveTypeLabel(req.leave_type)}</span>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="text-sm text-[#5c6670] mt-1">
                    {new Date(req.start_date).toLocaleDateString()} – {new Date(req.end_date).toLocaleDateString()}
                    {' '}({req.days_count} day{req.days_count !== 1 ? 's' : ''})
                  </div>
                  {req.reason && (
                    <div className="text-sm text-[#5c6670] mt-1">{req.reason}</div>
                  )}
                  {req.substitute_suggestion && (
                    <div className="text-sm text-[#5c6670] mt-1">
                      <MaterialIcon icon="person" className="text-xs align-middle" /> Suggested substitute: {req.substitute_suggestion}
                    </div>
                  )}
                </div>
                <span className="text-xs text-[#5c6670]">
                  {new Date(req.created_at).toLocaleDateString()}
                </span>
              </div>
              {req.status === 'pending' && req.days_count > 3 && (
                <div className="mt-2 text-xs text-[#5c6670] bg-[#f8fafb] rounded-lg p-2">
                  Requires DOS approval → HM final approval
                </div>
              )}
              {req.status === 'pending' && req.days_count <= 3 && (
                <div className="mt-2 text-xs text-[#5c6670] bg-[#f8fafb] rounded-lg p-2">
                  DOS can approve directly (≤ 3 days)
                </div>
              )}
              {req.status === 'dos_approved' && (
                <div className="mt-2 text-xs text-[#5c6670] bg-[#e3f2fd] rounded-lg p-2">
                  Awaiting Headmaster final approval
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Request Leave</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Leave Type</label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                  className="input"
                  required
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              {form.start_date && form.end_date && (
                <div className="text-sm text-[#5c6670] bg-[#f8fafb] rounded-lg p-2">
                  {calcDays(form.start_date, form.end_date)} day{calcDays(form.start_date, form.end_date) !== 1 ? 's' : ''}
                  {calcDays(form.start_date, form.end_date) > 3
                    ? ' — Requires DOS → HM approval'
                    : ' — DOS can approve directly'}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="input min-h-[80px]"
                  required
                  placeholder="Brief reason for your leave..."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Substitute Suggestion (Optional)</label>
                <input
                  type="text"
                  value={form.substitute_suggestion}
                  onChange={(e) => setForm({ ...form, substitute_suggestion: e.target.value })}
                  className="input"
                  placeholder="Name of suggested substitute teacher"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
