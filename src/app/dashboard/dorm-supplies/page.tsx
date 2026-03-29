'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

const SUPPLIES = ['Mattress', 'Blanket', 'Mosquito net', 'Bed sheet', 'Pillow'] as const
type Supply = typeof SUPPLIES[number]

interface StudentSupply {
  student_id: string
  supply: Supply
  issued: boolean
  issued_date?: string
}

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

  useEffect(() => {
    if (school?.id) fetchDorms()
  }, [school?.id])

  useEffect(() => {
    if (selectedDorm) fetchStudentSupplies()
  }, [selectedDorm])

  const fetchDorms = async () => {
    const { data } = await supabase.from('dorms').select('*').eq('school_id', school?.id)
    setDorms(data || [])
  }

  const fetchStudentSupplies = async () => {
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
  }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Dorm Supplies</h1>
          <p className="text-[#5c6670] mt-1">Track supplies issued to boarding students</p>
        </div>
        <div className="flex gap-3">
          <select value={selectedDorm?.id || ''} onChange={e => setSelectedDorm(dorms.find(d => d.id === e.target.value))} className="input sm:w-48">
            <option value="">Select dorm...</option>
            {dorms.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {selectedDorm && (
            <button onClick={() => setShowBulk(true)} className="btn btn-primary">
              <MaterialIcon icon="inventory_2" style={{ fontSize: 18 }} />
              Bulk Action
            </button>
          )}
        </div>
      </div>

      {!selectedDorm ? (
        <div className="card">
          <div className="card-body text-center py-12 text-[#5c6670]">
            <MaterialIcon icon="inventory_2" style={{ fontSize: 48, opacity: 0.5 }} />
            <p className="mt-2">Select a dorm to manage supplies</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-title">{selectedDorm.name} — Supplies</div>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  {SUPPLIES.map(s => <th key={s} className="text-center">{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const studentSupplies = supplies.get(student.id) || new Set()
                  return (
                    <tr key={student.id}>
                      <td className="font-medium">{student.first_name} {student.last_name}</td>
                      {SUPPLIES.map(supply => (
                        <td key={supply} className="text-center">
                          <button
                            onClick={() => toggleSupply(student.id, supply)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              studentSupplies.has(supply)
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={studentSupplies.has(supply) ? `Return ${supply}` : `Issue ${supply}`}
                          >
                            <MaterialIcon icon={studentSupplies.has(supply) ? 'check' : 'add'} style={{ fontSize: 16 }} />
                          </button>
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {students.length === 0 && !loading && (
                  <tr><td colSpan={SUPPLIES.length + 1} className="text-center py-8 text-[#5c6670]">No students in this dorm</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showBulk && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowBulk(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Bulk Supply Action</h2>
                <button onClick={() => setShowBulk(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Action</label>
                <select value={bulkAction} onChange={e => setBulkAction(e.target.value as 'issue' | 'return')} className="input">
                  <option value="issue">Issue Supplies</option>
                  <option value="return">Return Supplies</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Supply</label>
                <select value={bulkSupply} onChange={e => setBulkSupply(e.target.value as Supply)} className="input">
                  <option value="">Select supply...</option>
                  {SUPPLIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowBulk(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleBulkAction} disabled={saving || !bulkSupply} className="btn btn-primary flex-1">
                  {saving ? 'Processing...' : bulkAction === 'issue' ? 'Issue to All' : 'Return from All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
