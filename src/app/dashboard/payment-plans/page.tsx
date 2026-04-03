'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

interface PaymentPlan {
  id: string
  student_id: string
  total_amount: number
  installments: number
  start_date: string
  status: 'active' | 'completed' | 'defaulted'
  students?: { first_name: string; last_name: string; classes: { name: string } }
}

interface Installment {
  id: string
  plan_id: string
  due_date: string
  amount: number
  paid: boolean
  paid_date?: string
}

export default function PaymentPlansPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  
  const [newPlan, setNewPlan] = useState({
    student_id: '',
    total_amount: 0,
    installments: 3,
    start_date: new Date().toISOString().split('T')[0]
  })

  const fetchPlans = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('payment_plans')
      .select('*, students(first_name, last_name, classes(name))')
      .eq('school_id', school?.id)
      .order('created_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }, [school?.id])

  const fetchStudents = useCallback(async () => {
    if (!school?.id) return
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, classes(name)')
      .eq('school_id', school?.id)
      .eq('status', 'active')
    setStudents(data || [])
  }, [school?.id])

  const fetchInstallments = useCallback(async () => {
    if (!selectedPlan) return
    const { data } = await supabase
      .from('payment_plan_installments')
      .select('*')
      .eq('plan_id', selectedPlan.id)
      .order('due_date')
    setInstallments(data || [])
  }, [selectedPlan])

  useEffect(() => {
    if (school?.id) {
      fetchPlans()
      fetchStudents()
    }
  }, [school?.id, fetchPlans, fetchStudents])

  useEffect(() => {
    if (selectedPlan) {
      fetchInstallments()
    }
  }, [selectedPlan, fetchInstallments])

  const createPlan = async () => {
    if (!newPlan.student_id || newPlan.total_amount <= 0) {
      toast.error('Please fill all fields')
      return
    }

    const installmentAmount = Math.round(newPlan.total_amount / newPlan.installments)
    const planData = {
      school_id: school?.id,
      student_id: newPlan.student_id,
      total_amount: newPlan.total_amount,
      installments: newPlan.installments,
      start_date: newPlan.start_date,
      status: 'active',
      academic_year: academicYear
    }

    try {
      // Create plan
      const { data: plan, error } = await supabase
        .from('payment_plans')
        .insert(planData)
        .select()
        .single()

      if (error) throw error

      // Create installments
      const installmentData = []
      for (let i = 0; i < newPlan.installments; i++) {
        const dueDate = new Date(newPlan.start_date)
        dueDate.setMonth(dueDate.getMonth() + i)
        installmentData.push({
          plan_id: plan.id,
          due_date: dueDate.toISOString().split('T')[0],
          amount: installmentAmount,
          paid: false
        })
      }

      await supabase.from('payment_plan_installments').insert(installmentData)

      toast.success('Payment plan created')
      setShowCreate(false)
      setNewPlan({ student_id: '', total_amount: 0, installments: 3, start_date: new Date().toISOString().split('T')[0] })
      fetchPlans()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create plan')
    }
  }

  const markPaid = async (installmentId: string) => {
    try {
      await supabase
        .from('payment_plan_installments')
        .update({ paid: true, paid_date: new Date().toISOString() })
        .eq('id', installmentId)

      // Check if all paid
      const updated = installments.map(i => i.id === installmentId ? { ...i, paid: true } : i)
      setInstallments(updated)

      if (updated.every(i => i.paid)) {
        await supabase.from('payment_plans').update({ status: 'completed' }).eq('id', selectedPlan?.id)
      }

      toast.success('Payment recorded')
    } catch (err) {
      toast.error('Failed to record payment')
    }
  }

  const activeCount = plans.filter(p => p.status === 'active').length
  const completedCount = plans.filter(p => p.status === 'completed').length
  const totalOutstanding = plans
    .filter(p => p.status === 'active')
    .reduce((sum, p) => {
      const planInstallments = installments.filter(i => i.plan_id === p.id && !i.paid)
      return sum + planInstallments.reduce((s, i) => s + i.amount, 0)
    }, 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader 
        title="Fee Payment Plans (EMI)" 
        subtitle="Manage installment plans for parents"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <MaterialIcon icon="add" style={{ fontSize: 18 }} />
            Create Plan
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-[#002045]">{plans.length}</div>
            <div className="text-sm text-[#5c6670] mt-1">Total Plans</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">{activeCount}</div>
            <div className="text-sm text-[#5c6670] mt-1">Active</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <div className="text-sm text-[#5c6670] mt-1">Completed</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-amber-600">UGX {totalOutstanding.toLocaleString()}</div>
            <div className="text-sm text-[#5c6670] mt-1">Outstanding</div>
          </CardBody>
        </Card>
      </div>

      {/* Plans List */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Plans</CardTitle>
        </CardHeader>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Total</th>
                <th>Installments</th>
                <th>Start Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id}>
                  <td>{plan.students?.first_name} {plan.students?.last_name}</td>
                  <td>{plan.students?.classes?.name}</td>
                  <td>UGX {Number(plan.total_amount).toLocaleString()}</td>
                  <td>{plan.installments}</td>
                  <td>{new Date(plan.start_date).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${
                      plan.status === 'completed' ? 'bg-green-100 text-green-800' :
                      plan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {plan.status}
                    </span>
                  </td>
                  <td>
                    <Button size="sm" onClick={() => setSelectedPlan(plan)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-8 text-[#5c6670]">No payment plans</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Payment Plan</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student</label>
                {students.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No students available</div>
                ) : (
                  <select 
                    value={newPlan.student_id}
                    onChange={(e) => setNewPlan({...newPlan, student_id: e.target.value})}
                    className="input"
                  >
                    <option value="">Select student...</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name} - {s.classes?.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Total Amount (UGX)</label>
                <input 
                  type="number"
                  value={newPlan.total_amount}
                  onChange={(e) => setNewPlan({...newPlan, total_amount: Number(e.target.value)})}
                  className="input"
                  placeholder="Enter total amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Number of Installments</label>
                <select 
                  value={newPlan.installments}
                  onChange={(e) => setNewPlan({...newPlan, installments: Number(e.target.value)})}
                  className="input"
                >
                  <option value={2}>2 Installments</option>
                  <option value={3}>3 Installments</option>
                  <option value={4}>4 Installments</option>
                  <option value={5}>5 Installments</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input 
                  type="date"
                  value={newPlan.start_date}
                  onChange={(e) => setNewPlan({...newPlan, start_date: e.target.value})}
                  className="input"
                />
              </div>

              {newPlan.total_amount > 0 && newPlan.installments > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-800">
                    Each installment: <strong>UGX {Math.round(newPlan.total_amount / newPlan.installments).toLocaleString()}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="btn flex-1 bg-gray-100">Cancel</button>
              <button onClick={createPlan} className="btn btn-primary flex-1">Create Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* Installments Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">Payment Details</h2>
            <p className="text-sm text-[#5c6670] mb-4">
              {selectedPlan.students?.first_name} {selectedPlan.students?.last_name} - {selectedPlan.students?.classes?.name}
            </p>
            
            <div className="space-y-3">
              {installments.map((inst, idx) => (
                <div key={inst.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Installment {idx + 1}</div>
                    <div className="text-sm text-[#5c6670]">Due: {new Date(inst.due_date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">UGX {inst.amount.toLocaleString()}</div>
                    {inst.paid ? (
                      <span className="text-sm text-green-600">✓ Paid</span>
                    ) : (
                      <button onClick={() => markPaid(inst.id)} className="btn-sm bg-green-600 text-white px-3 py-1 rounded text-sm">
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedPlan(null)} className="btn w-full mt-4 bg-gray-100">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
