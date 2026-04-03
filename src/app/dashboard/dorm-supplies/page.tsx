'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

const SUPPLIES = ['Mattress', 'Blanket', 'Mosquito net', 'Bed sheet', 'Pillow'] as const
type Supply = typeof SUPPLIES[number]

export default function DormSuppliesPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [dorms, setDorms] = useState<any[]>([])
  const [selectedDorm, setSelectedDorm] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [supplies, setSupplies] = useState<Map<string, Set<Supply>>>(new Map())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkSupply, setBulkSupply] = useState<Supply | ''>('')
  const [bulkAction, setBulkAction] = useState<'issue' | 'return'>('issue')

  const fetchDorms = useCallback(async () => {
    const { data } = await supabase.from('dorms').select('*').eq('school_id', school?.id)
    setDorms(data || [])
  }, [school?.id])

  const fetchStudentSupplies = useCallback(async () => {
    if (!selectedDorm) return
    setLoading(true)

    const { data: dormStudents } = await supabase
      .from('dorm_students')
      .select('student_id, students(id, first_name, last_name)')
      .eq('dorm_id', selectedDorm.id)

    const studentList = dormStudents?.map((ds: any) => ds.students) || []
    setStudents(studentList)

    const { data: supplyData } = await supabase
      .from('dorm_supplies')
      .select('*')
      .eq('dorm_id', selectedDorm.id)

    const supplyMap = new Map<string, Set<Supply>>()
    supplyData?.forEach((s: any) => {
      if (!supplyMap.has(s.student_id)) supplyMap.set(s.student_id, new Set())
      supplyMap.get(s.student_id)!.add(s.supply as Supply)
    })
    setSupplies(supplyMap)
    setLoading(false)
  }, [selectedDorm])

  useEffect(() => {
    if (school?.id) fetchDorms()
  }, [fetchDorms, school?.id])

  useEffect(() => {
    if (selectedDorm) fetchStudentSupplies()
  }, [selectedDorm, fetchStudentSupplies])

  const toggleSupply = async (studentId: string, supply: Supply) => {
    const current = supplies.get(studentId) || new Set()
    const isIssued = current.has(supply)

    try {
      if (isIssued) {
        await supabase
          .from('dorm_supplies')
          .delete()
          .eq('dorm_id', selectedDorm.id)
          .eq('student_id', studentId)
          .eq('supply', supply)
        current.delete(supply)
      } else {
        await supabase.from('dorm_supplies').insert({
          dorm_id: selectedDorm.id,
          student_id: studentId,
          supply,
          issued_by: user?.id,
          issued_date: new Date().toISOString(),
        })
        current.add(supply)
      }
      const newMap = new Map(supplies)
      newMap.set(studentId, new Set(current))
      setSupplies(newMap)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update supply')
    }
  }

  const handleBulkAction = async () => {
    if (!bulkSupply) return
    setSaving(true)
    try {
      for (const student of students) {
        const current = supplies.get(student.id) || new Set()
        const hasSupply = current.has(bulkSupply)

        if (bulkAction === 'issue' && !hasSupply) {
          await supabase.from('dorm_supplies').insert({
            dorm_id: selectedDorm.id,
            student_id: student.id,
            supply: bulkSupply,
            issued_by: user?.id,
            issued_date: new Date().toISOString(),
          })
          current.add(bulkSupply)
        } else if (bulkAction === 'return' && hasSupply) {
          await supabase
            .from('dorm_supplies')
            .delete()
            .eq('dorm_id', selectedDorm.id)
            .eq('student_id', student.id)
            .eq('supply', bulkSupply)
          current.delete(bulkSupply)
        }
        const newMap = new Map(supplies)
        newMap.set(student.id, new Set(current))
        setSupplies(newMap)
      }
      toast.success(`${bulkAction === 'issue' ? 'Issued' : 'Returned'} ${bulkSupply} ${bulkAction === 'issue' ? 'to' : 'from'} all students`)
      setShowBulk(false)
      setBulkSupply('')
    } catch (err: any) {
      toast.error(err.message || 'Bulk action failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Dorm Supplies"
        subtitle="Track supplies issued to boarding students"
        actions={
          <div className="flex gap-3">
            {dorms.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-800">No dorms available</div>
            ) : (
              <select value={selectedDorm?.id || ''} onChange={e => setSelectedDorm(dorms.find(d => d.id === e.target.value))} className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium sm:w-48">
                <option value="">Select dorm...</option>
                {dorms.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            {selectedDorm && (
              <Button onClick={() => setShowBulk(true)}>
                <MaterialIcon icon="inventory_2" className="text-lg" />
                Bulk Action
              </Button>
            )}
          </div>
        }
      />

      {!selectedDorm ? (
        <Card className="p-12 text-center">
          <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">inventory_2</MaterialIcon>
          <p className="mt-2 text-[var(--t3)]">Select a dorm to manage supplies</p>
        </Card>
      ) : (
        <Card>
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--t1)]">{selectedDorm.name} — Supplies</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Student</th>
                  {SUPPLIES.map(s => <th key={s} className="p-4 text-center text-sm font-semibold text-[var(--t1)]">{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const studentSupplies = supplies.get(student.id) || new Set()
                  return (
                    <tr key={student.id} className="border-b border-[var(--border)]">
                      <td className="p-4 font-medium text-[var(--t1)]">{student.first_name} {student.last_name}</td>
                      {SUPPLIES.map(supply => (
                        <td key={supply} className="p-4 text-center">
                          <button
                            onClick={() => toggleSupply(student.id, supply)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              studentSupplies.has(supply)
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={studentSupplies.has(supply) ? `Return ${supply}` : `Issue ${supply}`}
                          >
                            <MaterialIcon icon={studentSupplies.has(supply) ? 'check' : 'add'} className="text-base" />
                          </button>
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {students.length === 0 && !loading && (
                  <tr><td colSpan={SUPPLIES.length + 1} className="text-center py-8 text-[var(--t3)]">No students in this dorm</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showBulk && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowBulk(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--t1)]">Bulk Supply Action</h2>
                <button onClick={() => setShowBulk(false)} className="p-2 text-[var(--t3)] hover:text-[var(--t1)]">
                  <MaterialIcon className="text-xl" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Action</label>
                <select value={bulkAction} onChange={e => setBulkAction(e.target.value as 'issue' | 'return')} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]">
                  <option value="issue">Issue Supplies</option>
                  <option value="return">Return Supplies</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Supply</label>
                <select value={bulkSupply} onChange={e => setBulkSupply(e.target.value as Supply)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]">
                  <option value="">Select supply...</option>
                  {SUPPLIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" className="flex-1" onClick={() => setShowBulk(false)}>Cancel</Button>
                <Button className="flex-1" disabled={saving || !bulkSupply}>
                  {saving ? 'Processing...' : bulkAction === 'issue' ? 'Issue to All' : 'Return from All'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
