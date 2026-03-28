'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function ExpenseApprovalsPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  useEffect(() => {
    if (school?.id) fetchExpenses()
  }, [school?.id])

  const fetchExpenses = async () => {
    setLoading(true)
    let query = supabase
      .from('expenses')
      .select('*, expense_approvals(*), users(full_name)')
      .eq('school_id', school?.id)
      .order('expense_date', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    setExpenses(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchExpenses()
  }, [filter])

  const handleApproval = async (expenseId: string, status: 'approved' | 'rejected', comments: string = '') => {
    try {
      // Update expense status
      await supabase.from('expenses').update({ status }).eq('id', expenseId)

      // Create approval record
      await supabase.from('expense_approvals').insert({
        school_id: school?.id,
        expense_id: expenseId,
        approver_id: user?.id,
        status,
        comments,
        approved_at: new Date().toISOString()
      })

      toast.success(`Expense ${status}`)
      fetchExpenses()
    } catch (err) {
      toast.error('Failed to process approval')
    }
  }

  const pendingExpenses = expenses.filter(e => e.status === 'pending')
  const approvedExpenses = expenses.filter(e => e.status === 'approved')
  const rejectedExpenses = expenses.filter(e => e.status === 'rejected')

  const pendingTotal = pendingExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Expense Approvals</h1>
        <p className="text-[#5c6670] mt-1">Review and approve school expenses</p>
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
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Requested By</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(expense => (
                <tr key={expense.id}>
                  <td>{new Date(expense.expense_date).toLocaleDateString()}</td>
                  <td>{expense.description}</td>
                  <td>{expense.category}</td>
                  <td className="font-bold">UGX {Number(expense.amount).toLocaleString()}</td>
                  <td>{expense.users?.full_name || '-'}</td>
                  <td>
                    <span className={`badge ${
                      expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                      expense.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {expense.status || 'pending'}
                    </span>
                  </td>
                  <td>
                    {expense.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleApproval(expense.id, 'approved')} className="btn-sm bg-green-600 text-white px-2 py-1 rounded">
                          Approve
                        </button>
                        <button onClick={() => handleApproval(expense.id, 'rejected')} className="btn-sm bg-red-600 text-white px-2 py-1 rounded">
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-8 text-[#5c6670]">No expenses</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
