'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

export default function LeavePage() {
  const { school, user } = useAuth()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    async function fetchRequests() {
      if (!school?.id) return
      setLoading(true)
      const { data } = await supabase
        .from('leave_requests')
        .select('*, users(full_name)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
      setRequests(data || [])
      setLoading(false)
    }
    fetchRequests()
  }, [school?.id])

  const handleStatus = async (id: string, status: 'approved' | 'rejected') => {
    await supabase.from('leave_requests').update({ status }).eq('id', id)
    setRequests(requests.map(r => r.id === id ? { ...r, status } : r))
    toast.success(`Leave ${status}`)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Leave Requests</h1>
        <p className="text-[#5c6670] mt-1">Manage staff leave applications</p>
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
                <td>{request.start_date}</td>
                <td>{request.end_date}</td>
                <td>{request.reason}</td>
                <td>
                  <span className={`badge ${request.status === 'approved' ? 'bg-green-100 text-green-800' : request.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {request.status || 'pending'}
                  </span>
                </td>
                <td>
                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleStatus(request.id, 'approved')} className="btn-sm bg-green-500 text-white px-2 py-1 rounded">Approve</button>
                      <button onClick={() => handleStatus(request.id, 'rejected')} className="btn-sm bg-red-500 text-white px-2 py-1 rounded">Reject</button>
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
  )
}
