'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

type ExpenseStatus = 'pending' | 'dos_approved' | 'approved' | 'rejected'
type FilterType = 'all' | 'pending' | 'approved' | 'rejected'

interface ApprovalRecord {
  id: string
  approver_id: string
  status: string
  comments: string | null
  approved_at: string
  users?: { full_name: string }
}

function getApprovalTier(amount: number): string {
  if (amount < 100000) return 'small'
  if (amount <= 500000) return 'medium'
  return 'large'
}

function getApprovalLabel(amount: number): string {
  const tier = getApprovalTier(amount)
  if (tier === 'small') return 'Bursar can approve'
  if (tier === 'medium') return 'DOS → HM'
  return 'HM only'
}

function getStatusColor(status: string) {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800'
    case 'rejected': return 'bg-red-100 text-red-800'
    case 'dos_approved': return 'bg-blue-100 text-blue-800'
    default: return 'bg-amber-100 text-amber-800'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'approved': return 'Approved'
    case 'rejected': return 'Rejected'
    case 'dos_approved': return 'DOS Approved (pending HM)'
    default: return 'Pending'
  }
}

export default function ExpenseApprovalsPage() {
  const { school, user } = useAuth()
  const toast = useToast()

  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [rejectModal, setRejectModal] = useState<{ open: boolean; expenseId: string | null }>({ open: false, expenseId: null })
  const [rejectComments, setRejectComments] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const isHeadmaster = user?.role === 'headmaster' || user?.role === 'school_admin'
  const isBursar = user?.role === 'bursar'
  const isDos = user?.role === 'dean_of_studies'

  useEffect(() => {
    if (school?.id) fetchExpenses()
  }, [school?.id])

  useEffect(() => {
    fetchExpenses()
  }, [filter])

  const fetchExpenses = async () => {
    setLoading(true)
    let query = supabase
      .from('expenses')
      .select('*, users(full_name), expense_approvals(*, users(full_name))')
      .eq('school_id', school?.id)
      .order('amount', { ascending: true })

    if (filter !== 'all') {
      if (filter === 'pending') {
        query = query.in('status', ['pending', 'dos_approved'])
      } else {
        query = query.eq('status', filter)
      }
    }

    const { data } = await query
    setExpenses(data || [])
    setLoading(false)
  }

  const handleApprove = async (expenseId: string) => {
    const expense = expenses.find(e => e.id === expenseId)
    if (!expense) return

    setProcessing(expenseId)
    try {
      const amount = Number(expense.amount)
      const tier = getApprovalTier(amount)

      let newStatus: ExpenseStatus = 'approved'

      if (tier === 'medium' && isDos) {
        newStatus = 'dos_approved'
      }
      // small: bursar approves directly -> approved
      // medium: dos approves -> dos_approved, then HM -> approved
      // large: hm approves -> approved

      await supabase.from('expenses').update({ status: newStatus }).eq('id', expenseId)

      await supabase.from('expense_approvals').insert({
        school_id: school?.id,
        expense_id: expenseId,
        approver_id: user?.id,
        status: 'approved',
        comments: null,
        approved_at: new Date().toISOString()
      })

      const msg = newStatus === 'dos_approved'
        ? 'Approved by DOS. Awaiting Headmaster approval.'
        : 'Expense approved'
      toast.success(msg)
      fetchExpenses()
    } catch (err) {
      toast.error('Failed to approve expense')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async () => {
    if (!rejectModal.expenseId) return

    setProcessing(rejectModal.expenseId)
    try {
      await supabase.from('expenses').update({ status: 'rejected' }).eq('id', rejectModal.expenseId)

      await supabase.from('expense_approvals').insert({
        school_id: school?.id,
        expense_id: rejectModal.expenseId,
        approver_id: user?.id,
        status: 'rejected',
        comments: rejectComments,
        approved_at: new Date().toISOString()
      })

      toast.success('Expense rejected')
      setRejectModal({ open: false, expenseId: null })
      setRejectComments('')
      fetchExpenses()
    } catch (err) {
      toast.error('Failed to reject expense')
    } finally {
      setProcessing(null)
    }
  }

  const canApprove = (expense: any): boolean => {
    if (expense.status === 'approved' || expense.status === 'rejected') return false
    const amount = Number(expense.amount)
    const tier = getApprovalTier(amount)

    if (tier === 'small') return isBursar || isHeadmaster
    if (tier === 'medium') {
      if (expense.status === 'pending') return isDos
      if (expense.status === 'dos_approved') return isHeadmaster
    }
    if (tier === 'large') return isHeadmaster
    return false
  }

  // Sort pending by amount ascending
  const sortedExpenses = [...expenses].sort((a, b) => {
    const aPending = a.status === 'pending' || a.status === 'dos_approved'
    const bPending = b.status === 'pending' || b.status === 'dos_approved'
    if (aPending && bPending) return Number(a.amount) - Number(b.amount)
    if (aPending) return -1
    if (bPending) return 1
    return 0
  })

  const pendingExpenses = expenses.filter(e => e.status === 'pending' || e.status === 'dos_approved')
  const approvedExpenses = expenses.filter(e => e.status === 'approved')
  const rejectedExpenses = expenses.filter(e => e.status === 'rejected')
  const pendingTotal = pendingExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Expense Approvals</h1>
        <p className="text-[#5c6670] mt-1">Multi-level approval workflow</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full">{'<'} 100K: Bursar approves</span>
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">100K-500K: DOS → HM</span>
          <span className="px-2 py-1 bg-red-50 text-red-700 rounded-full">{'>'} 500K: HM only</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <button onClick={() => setFilter('all')} className={`card ${filter === 'all' ? 'border-2 border-blue-500' : ''}`}>
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-[#002045]">{expenses.length}</div>
            <div className="text-sm text-[#5c6670]">All</div>
          </div>
        </button>
        <button onClick={() => setFilter('pending')} className={`card ${filter === 'pending' ? 'border-2 border-amber-500' : ''}`}>
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-amber-600">{pendingExpenses.length}</div>
            <div className="text-sm text-[#5c6670]">Pending</div>
            <div className="text-xs text-amber-600">UGX {pendingTotal.toLocaleString()}</div>
          </div>
        </button>
        <button onClick={() => setFilter('approved')} className={`card ${filter === 'approved' ? 'border-2 border-green-500' : ''}`}>
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-green-600">{approvedExpenses.length}</div>
            <div className="text-sm text-[#5c6670]">Approved</div>
          </div>
        </button>
        <button onClick={() => setFilter('rejected')} className={`card ${filter === 'rejected' ? 'border-2 border-red-500' : ''}`}>
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-red-600">{rejectedExpenses.length}</div>
            <div className="text-sm text-[#5c6670]">Rejected</div>
          </div>
        </button>
      </div>

      {/* Expenses List */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Expense Requests</div>
          <div className="text-xs text-[#5c6670]">Pending items sorted lowest to highest amount</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Approval Tier</th>
                <th>Requested By</th>
                <th>Status</th>
                <th>Approvals</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedExpenses.map(expense => {
                const approvals: ApprovalRecord[] = expense.expense_approvals || []
                return (
                  <tr key={expense.id}>
                    <td>{new Date(expense.expense_date).toLocaleDateString()}</td>
                    <td>{expense.description}</td>
                    <td>{expense.category}</td>
                    <td className="font-bold">UGX {Number(expense.amount).toLocaleString()}</td>
                    <td>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {getApprovalLabel(Number(expense.amount))}
                      </span>
                    </td>
                    <td>{expense.users?.full_name || '-'}</td>
                    <td>
                      <span className={`badge ${getStatusColor(expense.status)}`}>
                        {getStatusLabel(expense.status)}
                      </span>
                    </td>
                    <td>
                      {approvals.length > 0 ? (
                        <div className="space-y-1">
                          {approvals.map((a: any) => (
                            <div key={a.id} className="text-xs">
                              <span className="font-medium">{a.users?.full_name || 'Unknown'}</span>
                              {' - '}
                              <span className={a.status === 'approved' ? 'text-green-600' : 'text-red-600'}>
                                {a.status}
                              </span>
                              {a.approved_at && (
                                <span className="text-[#5c6670]"> ({new Date(a.approved_at).toLocaleDateString()})</span>
                              )}
                              {a.comments && (
                                <div className="text-[#5c6670] italic">&quot;{a.comments}&quot;</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[#5c6670]">-</span>
                      )}
                    </td>
                    <td>
                      {canApprove(expense) ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(expense.id)}
                            disabled={processing === expense.id}
                            className="btn-sm bg-green-600 text-white px-2 py-1 rounded disabled:opacity-50"
                          >
                            {processing === expense.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => setRejectModal({ open: true, expenseId: expense.id })}
                            disabled={processing === expense.id}
                            className="btn-sm bg-red-600 text-white px-2 py-1 rounded disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#5c6670]">
                          {(expense.status === 'approved' || expense.status === 'rejected') ? '-' : 'Awaiting approval'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {sortedExpenses.length === 0 && !loading && (
                <tr><td colSpan={9} className="text-center py-8 text-[#5c6670]">No expenses</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, margin: 16 }}>
            <div className="card-header">
              <div className="card-title">Reject Expense</div>
            </div>
            <div className="card-body" style={{ padding: 16 }}>
              <label className="block text-sm font-medium mb-2">Reason for rejection</label>
              <textarea
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                placeholder="Enter reason..."
                className="w-full border border-[#e8eaed] rounded-lg p-3 text-sm min-h-[100px]"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setRejectModal({ open: false, expenseId: null }); setRejectComments('') }}
                  className="btn btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectComments.trim() || processing !== null}
                  className="btn bg-red-600 text-white flex-1 disabled:opacity-50"
                >
                  Reject Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
