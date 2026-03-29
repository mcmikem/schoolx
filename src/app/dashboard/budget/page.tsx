'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

interface BudgetItem {
  id?: string
  category: string
  type: 'income' | 'expense'
  budgeted: number
  actual: number
}

const INCOME_CATEGORIES = [
  { key: 'fees', label: 'Expected Fees', auto: true },
  { key: 'government_grant', label: 'Government Grant' },
  { key: 'donations', label: 'Donations' },
  { key: 'other_income', label: 'Other Income' },
]

const EXPENSE_CATEGORIES = [
  { key: 'salaries', label: 'Salaries' },
  { key: 'supplies', label: 'Supplies' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'transport', label: 'Transport' },
  { key: 'other_expense', label: 'Other' },
]

export default function BudgetPage() {
  const { school } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [studentCount, setStudentCount] = useState(0)
  const [feePerTerm, setFeePerTerm] = useState(0)
  const [budgetItems, setBudgetItems] = useState<Record<string, BudgetItem>>({})
  const [activeTab, setActiveTab] = useState<'planner' | 'actual'>('planner')

  const loadData = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const { count } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', school.id)
        .eq('status', 'active')
      setStudentCount(count || 0)

      const { data: feeData } = await supabase
        .from('fee_structure')
        .select('amount')
        .eq('school_id', school.id)
        .limit(1)
      const feeAmount = feeData?.[0]?.amount ? Number(feeData[0].amount) : 50000
      setFeePerTerm(feeAmount)

      const { data: budgetData } = await supabase
        .from('budget_items')
        .select('*')
        .eq('school_id', school.id)

      const items: Record<string, BudgetItem> = {}
      budgetData?.forEach((b: any) => {
        items[b.category] = {
          id: b.id,
          category: b.category,
          type: b.type,
          budgeted: Number(b.budgeted),
          actual: Number(b.actual || 0),
        }
      })

      INCOME_CATEGORIES.forEach(c => {
        if (!items[c.key]) {
          const autoBudget = c.auto ? (count || 0) * feeAmount : 0
          items[c.key] = { category: c.key, type: 'income', budgeted: autoBudget, actual: 0 }
        } else if (c.auto) {
          items[c.key].budgeted = (count || 0) * feeAmount
        }
      })
      EXPENSE_CATEGORIES.forEach(c => {
        if (!items[c.key]) {
          items[c.key] = { category: c.key, type: 'expense', budgeted: 0, actual: 0 }
        }
      })

      setBudgetItems(items)

      const { data: expenses } = await supabase
        .from('expenses')
        .select('category, amount')
        .eq('school_id', school.id)

      expenses?.forEach((e: any) => {
        const cat = (e.category || '').toLowerCase().replace(/\s+/g, '_')
        if (items[cat]) {
          items[cat].actual += Number(e.amount)
        }
      })

      const { data: fees } = await supabase
        .from('fee_payments')
        .select('amount_paid, students!inner(school_id)')
        .eq('students.school_id', school.id)
      const totalFees = fees?.reduce((s: number, f: any) => s + Number(f.amount_paid), 0) || 0
      if (items.fees) items.fees.actual = totalFees

      setBudgetItems({ ...items })
    } catch (err) {
      console.error('Error loading budget data:', err)
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  useEffect(() => {
    if (school?.id) loadData()
  }, [school?.id, loadData])

  const updateBudgeted = (key: string, value: number) => {
    setBudgetItems(prev => ({
      ...prev,
      [key]: { ...prev[key], budgeted: value },
    }))
  }

  const totalIncome = Object.values(budgetItems).filter(b => b.type === 'income').reduce((s, b) => s + b.budgeted, 0)
  const totalExpense = Object.values(budgetItems).filter(b => b.type === 'expense').reduce((s, b) => s + b.budgeted, 0)
  const surplus = totalIncome - totalExpense

  const actualIncome = Object.values(budgetItems).filter(b => b.type === 'income').reduce((s, b) => s + b.actual, 0)
  const actualExpense = Object.values(budgetItems).filter(b => b.type === 'expense').reduce((s, b) => s + b.actual, 0)

  const saveBudget = async () => {
    if (!school?.id) return
    setSaving(true)
    try {
      for (const item of Object.values(budgetItems)) {
        if (item.id) {
          await supabase.from('budget_items').update({ budgeted: item.budgeted }).eq('id', item.id)
        } else {
          const { data } = await supabase.from('budget_items').insert({
            school_id: school.id,
            category: item.category,
            type: item.type,
            budgeted: item.budgeted,
            actual: 0,
          }).select().single()
          if (data) item.id = data.id
        }
      }
      setBudgetItems({ ...budgetItems })
      toast.success('Budget saved successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save budget')
    } finally {
      setSaving(false)
    }
  }

  const getUsageColor = (budgeted: number, actual: number) => {
    if (budgeted === 0) return 'text-[#5c6670]'
    const pct = (actual / budgeted) * 100
    if (pct > 90) return 'text-red-600'
    if (pct > 75) return 'text-amber-600'
    return 'text-green-600'
  }

  const getUsageBarColor = (budgeted: number, actual: number) => {
    if (budgeted === 0) return 'bg-gray-300'
    const pct = (actual / budgeted) * 100
    if (pct > 90) return 'bg-red-500'
    if (pct > 75) return 'bg-amber-500'
    return 'bg-green-500'
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Budget & Finance</h1>
          <p className="text-[#5c6670] mt-1">Plan, track and manage school finances</p>
        </div>
        <div className="flex gap-3">
          <button onClick={saveBudget} disabled={saving} className="btn btn-primary">
            <MaterialIcon icon="save" style={{ fontSize: 18 }} />
            {saving ? 'Saving...' : 'Save Budget'}
          </button>
          <button onClick={() => window.print()} className="btn btn-secondary">
            <MaterialIcon icon="print" style={{ fontSize: 18 }} />
            Print
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('planner')} className={`btn ${activeTab === 'planner' ? 'btn-primary' : 'btn-secondary'}`}>
          Budget Planner
        </button>
        <button onClick={() => setActiveTab('actual')} className={`btn ${activeTab === 'actual' ? 'btn-primary' : 'btn-secondary'}`}>
          Budget vs Actual
        </button>
      </div>

      {activeTab === 'planner' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="card"><div className="card-body text-center">
              <div className="text-sm text-[#5c6670]">Total Income</div>
              <div className="text-2xl font-bold text-green-600">UGX {totalIncome.toLocaleString()}</div>
            </div></div>
            <div className="card"><div className="card-body text-center">
              <div className="text-sm text-[#5c6670]">Total Expenses</div>
              <div className="text-2xl font-bold text-red-600">UGX {totalExpense.toLocaleString()}</div>
            </div></div>
            <div className="card"><div className="card-body text-center">
              <div className="text-sm text-[#5c6670]">Surplus / Deficit</div>
              <div className={`text-2xl font-bold ${surplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                UGX {surplus.toLocaleString()}
              </div>
              {surplus < 0 && <div className="badge bg-red-100 text-red-800 mt-1">DEFICIT</div>}
            </div></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header"><div className="card-title">Income</div></div>
              <div className="p-4 space-y-3">
                {INCOME_CATEGORIES.map(cat => {
                  const item = budgetItems[cat.key]
                  return (
                    <div key={cat.key} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[#191c1d]">{cat.label}</div>
                        {cat.auto && <div className="text-xs text-[#5c6670]">{studentCount} students × UGX {feePerTerm.toLocaleString()}</div>}
                      </div>
                      <input
                        type="number"
                        value={item?.budgeted || 0}
                        onChange={e => updateBudgeted(cat.key, Number(e.target.value))}
                        className="input w-36 text-right"
                        disabled={!!cat.auto}
                      />
                    </div>
                  )
                })}
                <div className="border-t border-[#e8eaed] pt-3 flex items-center justify-between">
                  <span className="font-semibold text-[#191c1d]">Total Income</span>
                  <span className="font-bold text-green-600">UGX {totalIncome.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Expenses</div></div>
              <div className="p-4 space-y-3">
                {EXPENSE_CATEGORIES.map(cat => {
                  const item = budgetItems[cat.key]
                  return (
                    <div key={cat.key} className="flex items-center gap-3">
                      <div className="flex-1 text-sm font-medium text-[#191c1d]">{cat.label}</div>
                      <input
                        type="number"
                        value={item?.budgeted || 0}
                        onChange={e => updateBudgeted(cat.key, Number(e.target.value))}
                        className="input w-36 text-right"
                      />
                    </div>
                  )
                })}
                <div className="border-t border-[#e8eaed] pt-3 flex items-center justify-between">
                  <span className="font-semibold text-[#191c1d]">Total Expenses</span>
                  <span className="font-bold text-red-600">UGX {totalExpense.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'actual' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div className="card"><div className="card-body text-center">
              <div className="text-sm text-[#5c6670]">Budget Income</div>
              <div className="text-xl font-bold text-[#002045]">UGX {totalIncome.toLocaleString()}</div>
            </div></div>
            <div className="card"><div className="card-body text-center">
              <div className="text-sm text-[#5c6670]">Actual Income</div>
              <div className="text-xl font-bold text-green-600">UGX {actualIncome.toLocaleString()}</div>
            </div></div>
            <div className="card"><div className="card-body text-center">
              <div className="text-sm text-[#5c6670]">Budget Expenses</div>
              <div className="text-xl font-bold text-[#002045]">UGX {totalExpense.toLocaleString()}</div>
            </div></div>
            <div className="card"><div className="card-body text-center">
              <div className="text-sm text-[#5c6670]">Actual Expenses</div>
              <div className="text-xl font-bold text-red-600">UGX {actualExpense.toLocaleString()}</div>
            </div></div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Budget vs Actual by Category</div></div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Category</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>% Used</th></tr>
                </thead>
                <tbody>
                  {[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map(cat => {
                    const item = budgetItems[cat.key]
                    if (!item) return null
                    const remaining = item.budgeted - item.actual
                    const pct = item.budgeted > 0 ? Math.round((item.actual / item.budgeted) * 100) : 0
                    return (
                      <tr key={cat.key}>
                        <td className="font-medium">{cat.label}</td>
                        <td>UGX {item.budgeted.toLocaleString()}</td>
                        <td>UGX {item.actual.toLocaleString()}</td>
                        <td className={remaining >= 0 ? 'text-green-600' : 'text-red-600'}>UGX {remaining.toLocaleString()}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${getUsageBarColor(item.budgeted, item.actual)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className={`text-sm font-medium ${getUsageColor(item.budgeted, item.actual)}`}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {Object.values(budgetItems).some(b => b.budgeted > 0 && (b.actual / b.budgeted) > 0.9) && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-6 flex items-center gap-3">
              <MaterialIcon icon="warning" className="text-red-600 text-2xl" />
              <div>
                <div className="font-semibold text-red-800">Budget Alert</div>
                <div className="text-sm text-red-700">
                  {Object.values(budgetItems)
                    .filter(b => b.budgeted > 0 && (b.actual / b.budgeted) > 0.9)
                    .map(b => {
                      const cat = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].find(c => c.key === b.category)
                      return `${cat?.label || b.category} budget ${Math.round((b.actual / b.budgeted) * 100)}% used`
                    }).join(', ')}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="card"><div className="card-body text-center py-8"><div className="skeleton h-4 w-32 mx-auto" /></div></div>
      )}
    </div>
  )
}
