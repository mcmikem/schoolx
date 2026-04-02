'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { useSalaries, useSalaryPayments } from '@/lib/hooks'
import GlassCard from '@/components/GlassCard'
import MaterialIcon from '@/components/MaterialIcon'
import { StaffSalary } from '@/types'

export default function PayrollPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { salaries, loading: loadingSalaries, updateSalary } = useSalaries(school?.id)
  const { payments, loading: loadingPayments, processPayment } = useSalaryPayments(school?.id)
  
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffSalary | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const handleProcessPayroll = async (salary: StaffSalary) => {
    setIsProcessing(true)
    try {
      const netPaid = salary.base_salary + salary.allowances - salary.deductions
      const result = await processPayment({
        school_id: school!.id,
        staff_id: salary.staff_id,
        academic_year_id: 'current-year-id', // Simplified for demo
        month: currentMonth,
        year: currentYear,
        base_paid: salary.base_salary,
        allowances_paid: salary.allowances,
        deductions_applied: salary.deductions,
        net_paid: netPaid,
        payment_date: new Date().toISOString().split('T')[0],
        payment_status: 'paid',
        processed_by: user!.id
      })

      if (result.success) {
        toast.success(`Payroll processed for ${salary.staff?.full_name || 'Staff'}`)
      } else {
        throw new Error(result.error)
      }
    } catch (err: any) {
      toast.error(`Failed to process payroll: ${err.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdateConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const updates = {
      base_salary: Number(formData.get('base_salary')),
      allowances: Number(formData.get('allowances')),
      deductions: Number(formData.get('deductions')),
      payment_method: formData.get('payment_method') as 'bank' | 'mobile_money' | 'cash' | 'cheque',
    }

    if (selectedStaff) {
      const result = await updateSalary(selectedStaff.staff_id, updates)
      if (result.success) {
        toast.success('Salary configuration updated')
        setShowConfigModal(false)
      } else {
        toast.error('Update failed')
      }
    }
  }

  if (loadingSalaries || loadingPayments) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const totalMonthlyPayroll = salaries.reduce((acc, s) => acc + (s.base_salary + s.allowances - s.deductions), 0)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Payroll Management
          </h1>
          <p className="text-white/60">Manage staff salaries and monthly payments</p>
        </div>
        
        <GlassCard className="flex items-center gap-4 py-3 px-6">
          <div className="p-2 bg-primary-500/20 rounded-lg text-primary-400">
            <MaterialIcon icon="payments" />
          </div>
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Total Monthly Payroll</p>
            <p className="text-xl font-bold text-white">UGX {totalMonthlyPayroll.toLocaleString()}</p>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <MaterialIcon icon="groups" className="text-primary-400" />
              Staff Salary List
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-white/10">
                  <th className="pb-4 font-semibold text-white/60">Staff Member</th>
                  <th className="pb-4 font-semibold text-white/60">Base Salary</th>
                  <th className="pb-4 font-semibold text-white/60">Allowances</th>
                  <th className="pb-4 font-semibold text-white/60">Deductions</th>
                  <th className="pb-4 font-semibold text-white/60">Net Pay</th>
                  <th className="pb-4 font-semibold text-white/60">Method</th>
                  <th className="pb-4 text-right font-semibold text-white/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {salaries.map((salary) => (
                  <tr key={salary.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">
                          {salary.staff?.full_name?.[0] || 'S'}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{salary.staff?.full_name || 'Demo Staff'}</p>
                          <p className="text-xs text-white/40 capitalize">{salary.staff?.role || 'Teacher'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-white">UGX {salary.base_salary.toLocaleString()}</td>
                    <td className="py-4 text-green-400">+{salary.allowances.toLocaleString()}</td>
                    <td className="py-4 text-red-400">-{salary.deductions.toLocaleString()}</td>
                    <td className="py-4 font-bold text-white">
                      UGX {(salary.base_salary + salary.allowances - salary.deductions).toLocaleString()}
                    </td>
                    <td className="py-4">
                      <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-white/60 capitalize">
                        {salary.payment_method}
                      </span>
                    </td>
                    <td className="py-4 text-right space-x-2">
                      <button 
                        onClick={() => { setSelectedStaff(salary); setShowConfigModal(true); }}
                        className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Configure Salary"
                      >
                        <MaterialIcon icon="settings" />
                      </button>
                      <button 
                        onClick={() => handleProcessPayroll(salary)}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2 ml-auto"
                      >
                        <MaterialIcon icon="account_balance_wallet" className="text-sm" />
                        Pay Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
            <MaterialIcon icon="history" className="text-blue-400" />
            Recent Payments
          </h2>
          <div className="space-y-4">
            {payments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
                    <MaterialIcon icon="check_circle" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{payment.staff?.full_name || 'Demo Staff'}</p>
                    <p className="text-xs text-white/40">Month: {payment.month}/{payment.year} • {payment.payment_date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">UGX {payment.net_paid.toLocaleString()}</p>
                  <p className="text-xs text-green-400 font-semibold uppercase tracking-widest">{payment.payment_status}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {showConfigModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Configure Salary</h2>
              <button onClick={() => setShowConfigModal(false)} className="text-white/40 hover:text-white">
                <MaterialIcon icon="close" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateConfig} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Base Salary (UGX)</label>
                <input 
                  name="base_salary"
                  type="number" 
                  defaultValue={selectedStaff.base_salary}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Allowances</label>
                  <input 
                    name="allowances"
                    type="number" 
                    defaultValue={selectedStaff.allowances}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Deductions</label>
                  <input 
                    name="deductions"
                    type="number" 
                    defaultValue={selectedStaff.deductions}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Payment Method</label>
                <select 
                  name="payment_method"
                  defaultValue={selectedStaff.payment_method}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value="bank" className="bg-slate-900">Bank Transfer</option>
                  <option value="mobile_money" className="bg-slate-900">Mobile Money</option>
                  <option value="cash" className="bg-slate-900">Cash</option>
                  <option value="cheque" className="bg-slate-900">Cheque</option>
                </select>
              </div>
              
              <button 
                type="submit"
                className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 mt-4"
              >
                Save Configuration
              </button>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
