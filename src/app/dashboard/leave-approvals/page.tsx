'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function LeaveApprovalsPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  useEffect(() => {
    if (school?.id) fetchRequests()
  }, [school?.id])

  const fetchRequests = async () => {
    setLoading(true)
    let query = supabase
      .from('leave_requests')
      .select('*, users(full_name), leave_approvals(*)')
      .eq('school_id', school?.id)
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchRequests()
  }, [filter])

  const handleApproval = async (requestId: string, status: 'approved' | 'rejected', comments: string = '') => {
    try {
      // Update leave request status
      await supabase.from('leave_requests').update({ status }).eq('id', requestId)

      // Create approval record
      await supabase.from('leave_approvals').insert({
        school_id: school?.id,
        leave_request_id: requestId,
        approver_id: user?.id,
        status,
        comments,
        approved_at: new Date().toISOString()
      })

      toast.success(`Leave ${status}`)
      fetchRequests()
    } catch (err) {
      toast.error('Failed to process approval')
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Leave Approvals</h1>
        <p className="text-[#5c6670] mt-1">Approve or reject staff leave requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <button onClick={() => setFilter('all')} className={`card ${filter === 'all' ? 'border-2 border-blue-500' : ''}`}>
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-[#002045]">{requests.length}</div>
            <div className="text-sm text-[#5c6670]">All</div>
          </div>
        </button>
        <button onClick={() => setFilter('pending')} className={`card ${filter === 'pending' ? 'border-2 border-amber-500' : ''}`}>
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <div className="text-sm text-[#5c6670]">Pending</div>
          </div>
        </button>
        <button onClick={() => setFilter('approved')} className={`card ${filter === 'approved' ? 'border-2 border-green-500' : ''}`}>
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            <div className="text-sm text-[#5c6670]">Approved</div>
          </div>
        </button>
        <button onClick={() => setFilter('rejected')} className={`card ${filter === 'rejected' ? 'border-2 border-red-500' : ''}`}>
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
            <div className="text-sm text-[#5c6670]">Rejected</div>
          </div>
        </button>
      </div>

      {/* Requests List */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Leave Requests</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(request => (
                <tr key={request.id}>
                  <td>{request.users?.full_name}</td>
                  <td>{request.leave_type}</td>
                  <td>{new Date(request.start_date).toLocaleDateString()}</td>
                  <td>{new Date(request.end_date).toLocaleDateString()}</td>
                  <td className="max-w-xs truncate">{request.reason}</td>
                  <td>
                    <span className={`badge ${
                      request.status === 'approved' ? 'bg-green-100 text-green-800' :
                      request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {request.status}
                    </span>
                  </td>
                  <td>
                    {request.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleApproval(request.id, 'approved')} className="btn-sm bg-green-600 text-white px-2 py-1 rounded">
                          Approve
                        </button>
                        <button onClick={() => handleApproval(request.id, 'rejected')} className="btn-sm bg-red-600 text-white px-2 py-1 rounded">
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-8 text-[#5c6670]">No leave requests</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
