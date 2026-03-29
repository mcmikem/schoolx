'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

type ExpenseCategory = 'Supplies' | 'Transport' | 'Food' | 'Repairs' | 'Other'
const CATEGORIES: ExpenseCategory[] = ['Supplies', 'Transport', 'Food', 'Repairs', 'Other']

interface PettyCashEntry {
  id: string
  date: string
  description: string
  amount: number
  category: ExpenseCategory
  receipt_url?: string
  created_at: string
}

export default function PettyCashPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [entries, setEntries] = useState<PettyCashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [balance, setBalance] = useState(0)
  const [replenishAmount, setReplenishAmount] = useState(500000)

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    category: '' as ExpenseCategory | '',
  })

  useEffect(() => {
    if (school?.id) {
      fetchEntries()
      fetchBalance()
    }
  }, [school?.id])

  const fetchEntries = async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('petty_cash')
        .select('*')
        .eq('school_id', school.id)
        .order('date', { ascending: false })
      setEntries(data || [])
    } catch {
      console.error('Error fetching petty cash')
    } finally {
      setLoading(false)
    }
  }

  const fetchBalance = async () => {
    if (!school?.id) return
    const { data } = await supabase
      .from('petty_cash_replenishments')
      .select('amount')
      .eq('school_id', school.id)
    const totalReplenished = data?.reduce((s: number, r: any) => s + Number(r.amount), 0) || 0
    const totalSpent = entries.reduce((s, e) => s + e.amount, 0)
    setBalance(totalReplenished - totalSpent)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id || !formData.description || !formData.amount || !formData.category) return

    setSubmitting(true)
    try {
      const { error } = await supabase.from('petty_cash').insert({
        school_id: school.id,
        date: formData.date,
        description: formData.description,
        amount: formData.amount,
        category: formData.category,
        recorded_by: user?.id,
      })
      if (error) throw error
      toast.success('Expense recorded')
      setShowModal(false)
      setFormData({ date: new Date().toISOString().split('T')[0], description: '', amount: 0, category: '' })
      fetchEntries()
      fetchBalance()
    } catch (err: any) {
      toast.error(err.message || 'Failed to record expense')
    } finally {
      setSubmitting(false)
    }
  }

  const requestReplenishment = async () => {
    if (!school?.id) return
    try {
      await supabase.from('petty_cash_replenishments').insert({
        school_id: school.id,
        amount: replenishAmount,
        requested_by: user?.id,
      })
      toast.success(`Replenishment of UGX ${replenishAmount.toLocaleString()} requested`)
      setBalance(prev => prev + replenishAmount)
    } catch (err: any) {
      toast.error(err.message || 'Failed to request replenishment')
    }
  }

  const getFilteredEntries = () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    if (viewMode === 'daily') return entries.filter(e => e.date === today)
    if (viewMode === 'weekly') return entries.filter(e => e.date >= weekAgo)
    return entries.filter(e => e.date >= monthAgo)
  }

  const filtered = getFilteredEntries()
  const totalSpent = filtered.reduce((s, e) => s + e.amount, 0)

  const categoryTotals = CATEGORIES.map(cat => ({
    category: cat,
    total: filtered.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Petty Cash</h1>
          <p className="text-[#5c6670] mt-1">Track small day-to-day expenses</p>
        </div>
        <div className="flex gap-3">
          {balance < 100000 && (
            <button onClick={requestReplenishment} className="btn bg-amber-500 text-white">
              <MaterialIcon icon="add_card" style={{ fontSize: 18 }} />
              Request Replenishment
            </button>
          )}
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <MaterialIcon icon="add" style={{ fontSize: 18 }} />
            Record Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card"><div className="card-body text-center">
          <div className="text-sm text-[#5c6670]">Running Balance</div>
          <div className={`text-2xl font-bold ${balance >= 100000 ? 'text-green-600' : 'text-red-600'}`}>UGX {balance.toLocaleString()}</div>
          {balance < 100000 && <div className="badge bg-red-100 text-red-800 mt-1">Low Balance</div>}
        </div></div>
        <div className="card"><div className="card-body text-center">
          <div className="text-sm text-[#5c6670]">{viewMode === 'daily' ? 'Today' : viewMode === 'weekly' ? 'This Week' : 'This Month'}</div>
          <div className="text-2xl font-bold text-red-600">UGX {totalSpent.toLocaleString()}</div>
        </div></div>
        <div className="card"><div className="card-body text-center">
          <div className="text-sm text-[#5c6670]">Transactions</div>
          <div className="text-2xl font-bold text-[#002045]">{filtered.length}</div>
        </div></div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['daily', 'weekly', 'monthly'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} className={`btn btn-sm ${viewMode === mode ? 'btn-primary' : 'btn-secondary'}`}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="card">
            <div className="card-header"><div className="card-title">Expenses</div></div>
            {loading ? (
              <div className="card-body text-center py-8"><div className="skeleton h-4 w-32 mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="card-body text-center py-12 text-[#5c6670]">
                <MaterialIcon icon="receipt_long" style={{ fontSize: 48, opacity: 0.5 }} />
                <p className="mt-2">No expenses recorded</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(entry => (
                      <tr key={entry.id}>
                        <td>{new Date(entry.date).toLocaleDateString()}</td>
                        <td className="font-medium">{entry.description}</td>
                        <td><span className="badge bg-blue-100 text-blue-800">{entry.category}</span></td>
                        <td className="font-medium">UGX {entry.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-header"><div className="card-title">Summary</div></div>
            <div className="p-4 space-y-3">
              {categoryTotals.filter(c => c.total > 0).map(({ category, total }) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm text-[#5c6670]">{category}</span>
                  <span className="text-sm font-medium text-[#191c1d]">UGX {total.toLocaleString()}</span>
                </div>
              ))}
              {categoryTotals.every(c => c.total === 0) && (
                <div className="text-sm text-[#5c6670] text-center">No expenses</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Record Expense</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Date</label>
                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="input" placeholder="e.g., Soap, Water, Transport" required />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Amount (UGX)</label>
                <input type="number" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="input" required />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ExpenseCategory})} className="input" required>
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
