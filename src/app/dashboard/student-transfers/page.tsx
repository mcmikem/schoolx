'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

const TRANSFER_REASONS = [
  'Family relocation',
  'School closure',
  'Better opportunity',
  'Fee constraints',
  'Disciplinary',
  'Academic reasons',
  'Other',
]

type Tab = 'in' | 'out'

interface TransferOutRecord {
  id: string
  student_id: string
  transfer_to: string
  reason: string
  transfer_date: string
  student_name: string
  class_name: string
  student_number: string
  gender: string
  admission_date: string
}

export default function StudentTransfersPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { students, createStudent, updateStudent } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const printRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState<Tab>('in')
  const [showTransferInModal, setShowTransferInModal] = useState(false)
  const [showTransferOutModal, setShowTransferOutModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [transferHistory, setTransferHistory] = useState<TransferOutRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [printData, setPrintData] = useState<TransferOutRecord | null>(null)

  const [transferInForm, setTransferInForm] = useState({
    first_name: '',
    last_name: '',
    gender: 'M' as 'M' | 'F',
    date_of_birth: '',
    previous_school: '',
    reason: '',
    class_id: '',
    parent_name: '',
    parent_phone: '',
    parent_phone2: '',
  })

  const [transferOutForm, setTransferOutForm] = useState({
    student_id: '',
    transfer_to: '',
    reason: '',
    transfer_date: new Date().toISOString().split('T')[0],
  })

  const fetchTransferHistory = useCallback(async () => {
    if (!school?.id) return
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, classes(name)')
        .eq('school_id', school.id)
        .eq('status', 'transferred')
        .order('updated_at', { ascending: false })

      if (error) throw error

      const records: TransferOutRecord[] = (data || []).map((s: any) => ({
        id: s.id,
        student_id: s.id,
        transfer_to: s.transfer_to || 'Unknown',
        reason: s.transfer_reason || '',
        transfer_date: s.dropout_date || s.updated_at?.split('T')[0] || '',
        student_name: `${s.first_name} ${s.last_name}`,
        class_name: s.classes?.name || '-',
        student_number: s.student_number || '',
        gender: s.gender || '',
        admission_date: s.admission_date || s.created_at?.split('T')[0] || '',
      }))
      setTransferHistory(records)
    } catch (err) {
      console.error('Error fetching transfer history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }, [school?.id])

  useEffect(() => {
    if (school?.id) fetchTransferHistory()
  }, [school?.id, fetchTransferHistory])

  const activeStudents = students.filter(s => s.status === 'active')

  const transferredIn = students.filter(s => s.status === 'active' && s.transfer_from)

  const handleTransferIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return
    if (!transferInForm.class_id) {
      toast.error('Please assign a class')
      return
    }

    setSaving(true)
    try {
      const studentCount = students.length + 1
      const studentNumber = `TRF${String(studentCount).padStart(5, '0')}`

      await createStudent({
        first_name: transferInForm.first_name,
        last_name: transferInForm.last_name,
        gender: transferInForm.gender,
        date_of_birth: transferInForm.date_of_birth,
        parent_name: transferInForm.parent_name,
        parent_phone: transferInForm.parent_phone,
        parent_phone2: transferInForm.parent_phone2,
        class_id: transferInForm.class_id,
        student_number: studentNumber,
        status: 'active',
        transfer_from: transferInForm.previous_school,
        transfer_reason: transferInForm.reason,
      })

      toast.success('Transfer-in student added successfully')
      setShowTransferInModal(false)
      setTransferInForm({
        first_name: '',
        last_name: '',
        gender: 'M',
        date_of_birth: '',
        previous_school: '',
        reason: '',
        class_id: '',
        parent_name: '',
        parent_phone: '',
        parent_phone2: '',
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add transfer student'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleTransferOut = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferOutForm.student_id) {
      toast.error('Please select a student')
      return
    }

    setSaving(true)
    try {
      const student = students.find(s => s.id === transferOutForm.student_id)
      if (!student) throw new Error('Student not found')

      await updateStudent(transferOutForm.student_id, {
        status: 'transferred',
        transfer_to: transferOutForm.transfer_to,
        transfer_reason: transferOutForm.reason,
        dropout_date: transferOutForm.transfer_date,
      })

      const record: TransferOutRecord = {
        id: transferOutForm.student_id,
        student_id: transferOutForm.student_id,
        transfer_to: transferOutForm.transfer_to,
        reason: transferOutForm.reason,
        transfer_date: transferOutForm.transfer_date,
        student_name: `${student.first_name} ${student.last_name}`,
        class_name: student.classes?.name || '-',
        student_number: student.student_number || '',
        gender: student.gender || '',
        admission_date: student.admission_date || student.created_at?.split('T')[0] || '',
      }

      setPrintData(record)
      toast.success('Student transferred out successfully')
      setShowTransferOutModal(false)
      setTransferOutForm({
        student_id: '',
        transfer_to: '',
        reason: '',
        transfer_date: new Date().toISOString().split('T')[0],
      })
      fetchTransferHistory()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Transfer failed'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>Transfer Letter</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; }
        .letterhead { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; }
        .letterhead h1 { margin: 0; font-size: 22px; color: #1e3a5f; }
        .letterhead p { margin: 4px 0; font-size: 13px; color: #555; }
        .title { text-align: center; font-size: 18px; font-weight: 700; margin: 20px 0; text-decoration: underline; }
        .content { line-height: 1.8; font-size: 14px; }
        .content p { margin: 8px 0; }
        .field { font-weight: 600; }
        .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
        .sig-block { text-align: center; width: 200px; }
        .sig-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; font-size: 12px; }
        .stamp-area { width: 100px; height: 100px; border: 2px dashed #aaa; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; margin: 0 auto; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>${printRef.current.innerHTML}</body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const transferredOutCount = transferHistory.length
  const transferredInCount = transferredIn.length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Student Transfers</h1>
        <p className="text-[#5c6670] mt-1">Manage students transferring in and out of the school</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: 'var(--navy)' }}>group</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Active</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>{activeStudents.length}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: 'var(--green)' }}>login</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Transferred In</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: 'var(--green)' }}>{transferredInCount}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(231,76,60,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: '#e74c3c' }}>logout</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Transferred Out</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: '#e74c3c' }}>{transferredOutCount}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(192,57,43,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>swap_horiz</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Total Moves</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: 'var(--t1)' }}>{transferredInCount + transferredOutCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('in')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'in' ? 'bg-white shadow text-[#002045]' : 'text-[#5c6670] hover:text-[#002045]'
          }`}
        >
          <MaterialIcon icon="login" style={{ fontSize: 16, marginRight: 6, verticalAlign: 'middle' }} />
          Transfer In
        </button>
        <button
          onClick={() => setActiveTab('out')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'out' ? 'bg-white shadow text-[#002045]' : 'text-[#5c6670] hover:text-[#002045]'
          }`}
        >
          <MaterialIcon icon="logout" style={{ fontSize: 16, marginRight: 6, verticalAlign: 'middle' }} />
          Transfer Out
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'in' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="card-title">Students Transferred In</div>
            <button onClick={() => setShowTransferInModal(true)} className="btn btn-primary">
              <MaterialIcon icon="person_add" style={{ fontSize: 16 }} />
              New Transfer
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student No.</th>
                  <th>Class</th>
                  <th>Previous School</th>
                  <th>Reason</th>
                  <th>Parent Phone</th>
                </tr>
              </thead>
              <tbody>
                {transferredIn.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[#5c6670]">
                      No transfer-in students recorded yet
                    </td>
                  </tr>
                ) : (
                  transferredIn.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: student.gender === 'M' ? 'var(--navy)' : 'var(--red)' }}>
                            {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{student.first_name} {student.last_name}</div>
                            <div className="text-xs text-[#5c6670]">{student.gender === 'M' ? 'Male' : 'Female'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm font-mono">{student.student_number || '-'}</td>
                      <td>
                        <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold">{student.classes?.name || '-'}</span>
                      </td>
                      <td className="text-sm">{student.transfer_from || '-'}</td>
                      <td className="text-sm">{student.transfer_reason || '-'}</td>
                      <td className="text-sm font-mono">{student.parent_phone || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'out' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="card-title">Students Transferred Out</div>
            <button onClick={() => setShowTransferOutModal(true)} className="btn btn-primary">
              <MaterialIcon icon="swap_horiz" style={{ fontSize: 16 }} />
              Transfer Out
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student No.</th>
                  <th>Former Class</th>
                  <th>Transferred To</th>
                  <th>Reason</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transferHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#5c6670]">
                      No transfer-out records yet
                    </td>
                  </tr>
                ) : (
                  transferHistory.map((record) => (
                    <tr key={record.id}>
                      <td className="font-semibold text-sm">{record.student_name}</td>
                      <td className="text-sm font-mono">{record.student_number || '-'}</td>
                      <td>
                        <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold">{record.class_name}</span>
                      </td>
                      <td className="text-sm">{record.transfer_to}</td>
                      <td className="text-sm">{record.reason || '-'}</td>
                      <td className="text-sm">{record.transfer_date ? new Date(record.transfer_date).toLocaleDateString() : '-'}</td>
                      <td>
                        <button
                          onClick={() => {
                            setPrintData(record)
                            setTimeout(handlePrint, 200)
                          }}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <MaterialIcon icon="print" style={{ fontSize: 14 }} />
                          Letter
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer In Modal */}
      {showTransferInModal && (
        <div className="modal-overlay" onClick={() => setShowTransferInModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700 }}>New Transfer In</div>
              <button onClick={() => setShowTransferInModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>close</MaterialIcon>
              </button>
            </div>
            <form onSubmit={handleTransferIn} style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>First Name</label>
                  <input type="text" value={transferInForm.first_name} onChange={(e) => setTransferInForm({ ...transferInForm, first_name: e.target.value })} className="input" required />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Last Name</label>
                  <input type="text" value={transferInForm.last_name} onChange={(e) => setTransferInForm({ ...transferInForm, last_name: e.target.value })} className="input" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Gender</label>
                  <select value={transferInForm.gender} onChange={(e) => setTransferInForm({ ...transferInForm, gender: e.target.value as 'M' | 'F' })} className="input">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Date of Birth</label>
                  <input type="date" value={transferInForm.date_of_birth} onChange={(e) => setTransferInForm({ ...transferInForm, date_of_birth: e.target.value })} className="input" />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Previous School</label>
                <input type="text" value={transferInForm.previous_school} onChange={(e) => setTransferInForm({ ...transferInForm, previous_school: e.target.value })} className="input" required placeholder="Name of previous school" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Transfer Reason</label>
                <select value={transferInForm.reason} onChange={(e) => setTransferInForm({ ...transferInForm, reason: e.target.value })} className="input" required>
                  <option value="">Select reason</option>
                  {TRANSFER_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Assign to Class</label>
                <select value={transferInForm.class_id} onChange={(e) => setTransferInForm({ ...transferInForm, class_id: e.target.value })} className="input" required>
                  <option value="">Select class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Parent/Guardian Name</label>
                <input type="text" value={transferInForm.parent_name} onChange={(e) => setTransferInForm({ ...transferInForm, parent_name: e.target.value })} className="input" required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Parent Phone</label>
                  <input type="tel" placeholder="0700000000" value={transferInForm.parent_phone} onChange={(e) => setTransferInForm({ ...transferInForm, parent_phone: e.target.value })} className="input" required />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Alt. Phone</label>
                  <input type="tel" placeholder="0700000000" value={transferInForm.parent_phone2} onChange={(e) => setTransferInForm({ ...transferInForm, parent_phone2: e.target.value })} className="input" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowTransferInModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Adding...' : 'Add Transfer Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Out Modal */}
      {showTransferOutModal && (
        <div className="modal-overlay" onClick={() => setShowTransferOutModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700 }}>Transfer Student Out</div>
              <button onClick={() => setShowTransferOutModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>close</MaterialIcon>
              </button>
            </div>
            <form onSubmit={handleTransferOut} style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Select Student</label>
                {activeStudents.length === 0 ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>No active students</div>
                ) : (
                  <select value={transferOutForm.student_id} onChange={(e) => setTransferOutForm({ ...transferOutForm, student_id: e.target.value })} className="input" required>
                    <option value="">Select student...</option>
                    {activeStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name} - {s.classes?.name || 'No class'}</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Transferring To (School Name)</label>
                <input type="text" value={transferOutForm.transfer_to} onChange={(e) => setTransferOutForm({ ...transferOutForm, transfer_to: e.target.value })} className="input" required placeholder="Name of new school" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Reason</label>
                <select value={transferOutForm.reason} onChange={(e) => setTransferOutForm({ ...transferOutForm, reason: e.target.value })} className="input" required>
                  <option value="">Select reason</option>
                  {TRANSFER_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Transfer Date</label>
                <input type="date" value={transferOutForm.transfer_date} onChange={(e) => setTransferOutForm({ ...transferOutForm, transfer_date: e.target.value })} className="input" required />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowTransferOutModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Processing...' : 'Transfer Out'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Transfer Letter for Printing */}
      {printData && (
        <div style={{ display: 'none' }}>
          <div ref={printRef}>
            <div className="letterhead">
              <h1>{school?.name || 'School Name'}</h1>
              <p>{school?.district ? `${school.district} District` : ''} {school?.phone ? `| Tel: ${school.phone}` : ''}</p>
              <p>{school?.email || ''}</p>
            </div>
            <div className="title">TRANSFER LETTER</div>
            <div className="content">
              <p>Date: <span className="field">{new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
              <p>&nbsp;</p>
              <p>To Whom It May Concern,</p>
              <p>&nbsp;</p>
              <p>This is to certify that <span className="field">{printData.student_name}</span> ({printData.gender === 'M' ? 'Male' : 'Female'}) was a student at <span className="field">{school?.name || 'our school'}</span>.</p>
              <p>&nbsp;</p>
              <p><strong>Student Details:</strong></p>
              <p>Student Number: <span className="field">{printData.student_number || 'N/A'}</span></p>
              <p>Class: <span className="field">{printData.class_name}</span></p>
              <p>Period of Study: <span className="field">{printData.admission_date ? new Date(printData.admission_date).toLocaleDateString('en-UG', { year: 'numeric', month: 'long' }) : 'N/A'} - {new Date(printData.transfer_date).toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
              <p>Reason for Transfer: <span className="field">{printData.reason || 'Not specified'}</span></p>
              <p>Transferring To: <span className="field">{printData.transfer_to}</span></p>
              <p>&nbsp;</p>
              <p>We wish the student all the best in their future academic endeavors.</p>
              <p>&nbsp;</p>
              <p>Yours faithfully,</p>
            </div>
            <div className="signatures">
              <div className="sig-block">
                <div className="stamp-area">School Stamp</div>
              </div>
              <div className="sig-block">
                <div className="sig-line">Head Teacher&apos;s Signature</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
