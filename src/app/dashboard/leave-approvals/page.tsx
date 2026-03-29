'use client'
import { useState, useEffect } from 'react'
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

const LEAVE_TYPES: Record<string, string> = {
  sick: 'Sick Leave',
  personal: 'Personal',
  bereavement: 'Bereavement',
  maternity: 'Maternity',
  study: 'Study Leave',
  other: 'Other',
}

export default function LeaveApprovalsPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'dos_approved' | 'approved' | 'rejected'>('all')
  const [commentModal, setCommentModal] = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null)
  const [comments, setComments] = useState('')

  const isDOS = user?.role === 'dean_of_studies'
  const isHM = user?.role === 'headmaster' || user?.role === 'school_admin'

  useEffect(() => {
    if (school?.id) fetchRequests()
  }, [school?.id])

  const fetchRequests = async () => {
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
  }

  const handleApproval = async (requestId: string, action: 'approved' | 'rejected', commentText: string = '') => {
    if (!user?.id || !school?.id) return
    setProcessing(requestId)
    try {
      const request = requests.find(r => r.id === requestId)
      if (!request) return

      let newStatus: string
      if (action === 'rejected') {
        newStatus = 'rejected'
      } else if (isDOS) {
        // DOS approval: if ≤3 days, approve directly; otherwise mark dos_approved
        if (request.days_count <= 3) {
          newStatus = 'approved'
        } else {
          newStatus = 'dos_approved'
        }
      } else {
        // HM final approval
        newStatus = 'approved'
      }

      await supabase
        .from('leave_requests')
        .update({ status: newStatus, approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', requestId)

      await supabase
        .from('leave_approvals')
        .insert({
          school_id: school.id,
          leave_request_id: requestId,
          approver_id: user.id,
          status: action,
          comments: commentText,
          approved_at: new Date().toISOString(),
        })

      setRequests(requests.map(r => r.id === requestId ? { ...r, status: newStatus } : r))
      toast.success(action === 'approved' ? 'Leave approved' : 'Leave rejected')
    } catch {
      toast.error('Failed to process approval')
    } finally {
      setProcessing(null)
      setCommentModal(null)
      setComments('')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-[#fff8e1]', text: 'text-[#b8860b]', label: 'Pending' },
      dos_approved: { bg: 'bg-[#e3f2fd]', text: 'text-[#002045]', label: 'DOS Approved' },
      approved: { bg: 'bg-[#e8f5e9]', text: 'text-[#006e1c]', label: 'Approved' },
      rejected: { bg: 'bg-[#fef2f2]', text: 'text-[#ba1a1a]', label: 'Rejected' },
    }
    const s = styles[status] || styles.pending
    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    )
  }

  const canApprove = (req: LeaveRequest) => {
    if (req.status === 'approved' || req.status === 'rejected') return false
    if (isDOS && req.status === 'pending') return true
    if (isHM && req.status === 'dos_approved') return true
    if (isHM && req.status === 'pending' && req.days_count <= 3) return true
    return false
  }

  const getActionLabel = (req: LeaveRequest) => {
    if (isDOS && req.status === 'pending') {
      return req.days_count <= 3 ? 'Approve Directly' : 'Approve (Forward to HM)'
    }
    if (isHM && req.status === 'dos_approved') return 'Final Approve'
    if (isHM && req.status === 'pending' && req.days_count <= 3) return 'Approve'
    return 'Approve'
  }

  const filteredRequests = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const dosApprovedCount = requests.filter(r => r.status === 'dos_approved').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Leave Approvals</h1>
        <p className="text-[#5c6670] mt-1">
          {isDOS ? 'DOS: Review and approve staff leave requests' :
           isHM ? 'Headmaster: Final approval for leave requests' :
           'Review and approve staff leave requests'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 mb-6">
        <div className="flex items-center gap-3">
          <MaterialIcon icon="info" className="text-[#5c6670]" />
          <div className="text-sm text-[#5c6670]">
            {isDOS && 'Leave ≤ 3 days: approve directly. Leave > 3 days: approve first, then HM gives final approval.'}
            {isHM && 'You finalize leave requests that DOS has already approved. You can also approve short leave directly.'}
            {!isDOS && !isHM && 'Multi-level approval: DOS approves first, HM gives final approval for leave > 3 days.'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {([
          { key: 'all', label: 'All', count: requests.length },
          { key: 'pending', label: 'Pending', count: pendingCount },
          { key: 'dos_approved', label: 'DOS Approved', count: dosApprovedCount },
          { key: 'approved', label: 'Approved', count: approvedCount },
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
            <MaterialIcon icon="verified" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No requests</h3>
          <p className="text-[#5c6670]">No leave requests matching this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[#191c1d]">{req.users?.full_name || 'Unknown'}</span>
                    <span className="text-sm text-[#5c6670]">·</span>
                    <span className="text-sm text-[#5c6670]">{LEAVE_TYPES[req.leave_type] || req.leave_type}</span>
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
                      Substitute: {req.substitute_suggestion}
                    </div>
                  )}
                </div>

                {canApprove(req) && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setCommentModal({ id: req.id, action: 'approved' })}
                      disabled={processing === req.id}
                      className="btn btn-sm bg-green-600 text-white hover:bg-green-700"
                    >
                      <MaterialIcon icon="check" className="text-sm" />
                      {getActionLabel(req)}
                    </button>
                    <button
                      onClick={() => setCommentModal({ id: req.id, action: 'rejected' })}
                      disabled={processing === req.id}
                      className="btn btn-sm bg-red-600 text-white hover:bg-red-700"
                    >
                      <MaterialIcon icon="close" className="text-sm" />
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {req.status === 'pending' && req.days_count > 3 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-[#5c6670]">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#fff8e1] border border-[#b8860b]" />
                    Pending
                  </div>
                  <MaterialIcon icon="arrow_forward" className="text-xs" />
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#e3f2fd] border border-[#002045]" />
                    DOS Approval
                  </div>
                  <MaterialIcon icon="arrow_forward" className="text-xs" />
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#e8f5e9] border border-[#006e1c]" />
                    HM Final
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {commentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCommentModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">
                  {commentModal.action === 'approved' ? 'Approve Leave' : 'Reject Leave'}
                </h2>
                <button onClick={() => setCommentModal(null)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Comments (Optional)</label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Add any comments..."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCommentModal(null)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={() => handleApproval(commentModal.id, commentModal.action, comments)}
                  disabled={processing === commentModal.id}
                  className={`btn flex-1 ${commentModal.action === 'approved' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                >
                  {processing === commentModal.id ? 'Processing...' : commentModal.action === 'approved' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
