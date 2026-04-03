'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { useSalaries, useSalaryPayments } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'
import { StaffSalary } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Tabs } from '@/components/ui/Tabs'

export default function PayrollPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { salaries, loading: loadingSalaries, updateSalary } = useSalaries(school?.id)
  const { payments, loading: loadingPayments, processPayment } = useSalaryPayments(school?.id)
  
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffSalary | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState('staff')

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const handleProcessPayroll = async (salary: StaffSalary) => {
    setIsProcessing(true)
    try {
      const netPaid = salary.base_salary + salary.allowances - salary.deductions
      const result = await processPayment({
        school_id: school!.id,
        staff_id: salary.staff_id,
        academic_year_id: 'current-year-id',
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
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <PageHeader title="Payroll Management" subtitle="Manage staff salaries and monthly payments" />
        <Card>
          <CardBody>
            <TableSkeleton rows={5} />
          </CardBody>
        </Card>
      </div>
    )
  }

  const totalMonthlyPayroll = salaries.reduce((acc, s) => acc + (s.base_salary + s.allowances - s.deductions), 0)

  const tabs = [
    { id: 'staff', label: 'Staff Salary List', count: salaries.length },
    { id: 'payments', label: 'Recent Payments', count: payments.length },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Payroll Management" 
        subtitle="Manage staff salaries and monthly payments"
        actions={
          <Card className="flex items-center gap-4 py-3 px-6">
            <div className="p-2 bg-[var(--primary)]/20 rounded-lg text-[var(--primary)]">
              <MaterialIcon icon="payments" />
            </div>
            <div>
              <p className="text-xs text-[var(--t3)] uppercase tracking-wider font-semibold">Total Monthly Payroll</p>
              <p className="text-xl font-bold text-[var(--on-surface)]">UGX {totalMonthlyPayroll.toLocaleString()}</p>
            </div>
          </Card>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'staff' && (
        <Card>
          <CardBody>
            {salaries.length === 0 ? (
              <EmptyState
                icon="payments"
                title="No salary records"
                description="Configure staff salaries to process monthly payroll"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-[var(--border)]">
                      <th className="pb-4 font-semibold text-[var(--t3)]">Staff Member</th>
                      <th className="pb-4 font-semibold text-[var(--t3)]">Base Salary</th>
                      <th className="pb-4 font-semibold text-[var(--t3)]">Allowances</th>
                      <th className="pb-4 font-semibold text-[var(--t3)]">Deductions</th>
                      <th className="pb-4 font-semibold text-[var(--t3)]">Net Pay</th>
                      <th className="pb-4 font-semibold text-[var(--t3)]">Method</th>
                      <th className="pb-4 text-right font-semibold text-[var(--t3)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {salaries.map((salary) => (
                      <tr key={salary.id} className="hover:bg-[var(--surface-container-low)] transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] font-bold">
                              {salary.staff?.full_name?.[0] || 'S'}
                            </div>
                            <div>
                              <p className="font-semibold text-[var(--on-surface)]">{salary.staff?.full_name || 'Demo Staff'}</p>
                              <p className="text-xs text-[var(--t3)] capitalize">{salary.staff?.role || 'Teacher'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-[var(--on-surface)]">UGX {salary.base_salary.toLocaleString()}</td>
                        <td className="py-4 text-[var(--green)]">+{salary.allowances.toLocaleString()}</td>
                        <td className="py-4 text-[var(--red)]">-{salary.deductions.toLocaleString()}</td>
                        <td className="py-4 font-bold text-[var(--on-surface)]">
                          UGX {(salary.base_salary + salary.allowances - salary.deductions).toLocaleString()}
                        </td>
                        <td className="py-4">
                          <span className="px-2 py-1 rounded-full bg-[var(--surface-container)] text-xs text-[var(--t3)] capitalize">
                            {salary.payment_method}
                          </span>
                        </td>
                        <td className="py-4 text-right space-x-2">
                          <Button 
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedStaff(salary); setShowConfigModal(true); }}
                          >
                            <MaterialIcon icon="settings" />
                          </Button>
                          <Button 
                            variant="primary"
                            size="sm"
                            onClick={() => handleProcessPayroll(salary)}
                            disabled={isProcessing}
                          >
                            <MaterialIcon icon="account_balance_wallet" />
                            Pay Now
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'payments' && (
        <Card>
          <CardBody>
            {payments.length === 0 ? (
              <EmptyState
                icon="history"
                title="No payments recorded"
                description="Process payroll to see payment history"
              />
            ) : (
              <div className="space-y-4">
                {payments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-container-low)] border border-[var(--border)]">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-[var(--green-soft)] rounded-lg text-[var(--green)]">
                        <MaterialIcon icon="check_circle" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--on-surface)]">{payment.staff?.full_name || 'Demo Staff'}</p>
                        <p className="text-xs text-[var(--t3)]">Month: {payment.month}/{payment.year} • {payment.payment_date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[var(--on-surface)]">UGX {payment.net_paid.toLocaleString()}</p>
                      <p className="text-xs text-[var(--green)] font-semibold uppercase tracking-widest">{payment.payment_status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {showConfigModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[var(--on-surface)]">Configure Salary</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowConfigModal(false)}>
                  <MaterialIcon icon="close" />
                </Button>
              </div>
            </div>
            
            <form onSubmit={handleUpdateConfig} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--on-surface)]">Base Salary (UGX)</label>
                <input 
                  name="base_salary"
                  type="number" 
                  defaultValue={selectedStaff.base_salary}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Allowances</label>
                  <input 
                    name="allowances"
                    type="number" 
                    defaultValue={selectedStaff.allowances}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Deductions</label>
                  <input 
                    name="deductions"
                    type="number" 
                    defaultValue={selectedStaff.deductions}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--on-surface)]">Payment Method</label>
                <select 
                  name="payment_method"
                  defaultValue={selectedStaff.payment_method}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              
              <Button type="submit" variant="primary" className="w-full mt-4">
                Save Configuration
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
