'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function BudgetPage() {
  const { school } = useAuth()
  const [budgets, setBudgets] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!school?.id) return
      setLoading(true)
      const [budgetData, expenseData] = await Promise.all([
        supabase.from('budgets').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
        supabase.from('expenses').select('*, budgets(name)').eq('school_id', school.id).order('expense_date', { ascending: false })
      ])
      setBudgets(budgetData.data || [])
      setExpenses(expenseData.data || [])
      setLoading(false)
    }
    fetchData()
  }, [school?.id])

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const balance = totalBudget - totalExpenses

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Budget & Expenses</h1>
        <p className="text-[#5c6670] mt-1">Track school budget and spending</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card-body text-center">
            <div className="text-sm text-[#5c6670]">Total Budget</div>
            <div className="text-2xl font-bold text-[#002045]">UGX {totalBudget.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="text-sm text-[#5c6670]">Total Expenses</div>
            <div className="text-2xl font-bold text-red-600">UGX {totalExpenses.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="text-sm text-[#5c6670]">Balance</div>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              UGX {balance.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Expenses</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {expenses.slice(0, 10).map(expense => (
                <tr key={expense.id}>
                  <td>{expense.description}</td>
                  <td>{expense.category}</td>
                  <td>UGX {Number(expense.amount).toLocaleString()}</td>
                  <td>{new Date(expense.expense_date).toLocaleDateString()}</td>
                </tr>
              ))}
              {expenses.length === 0 && !loading && (
                <tr><td colSpan={4} className="text-center py-8 text-[#5c6670]">No expenses</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
