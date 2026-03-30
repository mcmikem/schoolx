'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { SendSMSModal } from '@/components/SendSMSModal'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

const STUDENT_TEMPLATE_COLUMNS = [
  'student_number',
  'first_name',
  'last_name',
  'gender',
  'class_name',
  'class_id',
  'ple_index_number',
  'parent_name',
  'parent_phone',
  'parent_phone2',
]

export default function StudentsPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { students, loading, createStudent, updateStudent, deleteStudent } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [newStudent, setNewStudent] = useState({
    first_name: '',
    last_name: '',
    gender: 'M' as 'M' | 'F',
    date_of_birth: '',
    parent_name: '',
    parent_phone: '',
    parent_phone2: '',
    class_id: '',
    student_number: '',
    ple_index_number: '',
  })
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    gender: 'M' as 'M' | 'F',
    date_of_birth: '',
    parent_name: '',
    parent_phone: '',
    parent_phone2: '',
    class_id: '',
    student_number: '',
    ple_index_number: '',
  })
  const [smsTarget, setSmsTarget] = useState<{ id: string; first_name: string; last_name: string; parent_phone?: string } | null>(null)
  const [templateRows, setTemplateRows] = useState<Record<string, string>[]>([])
  const [templatePreviewRows, setTemplatePreviewRows] = useState<Record<string, string>[]>([])
  const [templateStatus, setTemplateStatus] = useState<'idle' | 'parsing' | 'ready'>('idle')
  const [templateErrors, setTemplateErrors] = useState<string | null>(null)
  const [importingTemplate, setImportingTemplate] = useState(false)
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number; total: number } | null>(null)

  const resolveClassId = (row: Record<string, string>) => {
    if (row.class_id) return row.class_id
    if (!row.class_name) return ''
    const match = classes.find((c) => c.name.toLowerCase() === row.class_name?.toLowerCase())
    return match?.id || ''
  }

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase()
      const matchesSearch = name.includes(searchTerm.toLowerCase()) ||
        s.parent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_number?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesClass = selectedClass === 'all' || s.class_id === selectedClass
      return matchesSearch && matchesClass
    })
  }, [students, searchTerm, selectedClass])

  const handleStudentTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setTemplateStatus('parsing')
    setTemplateErrors(null)
    setTemplateRows([])
    setTemplatePreviewRows([])
    setImportSummary(null)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const normalized: Record<string, string>[] = results.data.map((row) => ({
          student_number: row.student_number?.trim() || '',
          first_name: row.first_name?.trim() || '',
          last_name: row.last_name?.trim() || '',
          gender: row.gender?.trim().toUpperCase() === 'F' ? 'F' : 'M',
          class_name: row.class_name?.trim() || '',
          class_id: row.class_id?.trim() || '',
          ple_index_number: row.ple_index_number?.trim() || '',
          parent_name: row.parent_name?.trim() || '',
          parent_phone: row.parent_phone?.trim() || '',
          parent_phone2: row.parent_phone2?.trim() || '',
        }))

        setTemplateRows(normalized)
        setTemplatePreviewRows(normalized.slice(0, 5))
        setTemplateStatus('ready')
      },
      error: (error) => {
        setTemplateErrors(error.message)
        setTemplateStatus('idle')
      },
    })
  }

  const handleSeedStudentsFromTemplate = async () => {
    if (!templateRows.length) {
      setTemplateErrors('Upload a template before seeding.')
      return
    }
    setImportingTemplate(true)
    let success = 0
    let failed = 0

    for (const row of templateRows) {
      const classId = resolveClassId(row)
      if (!row.first_name || !row.last_name || !classId) {
        failed++
        continue
      }
      try {
        await createStudent({
          first_name: row.first_name,
          last_name: row.last_name,
          gender: row.gender === 'F' ? 'F' : 'M',
          class_id: classId,
          student_number: row.student_number || undefined,
          ple_index_number: row.ple_index_number || undefined,
          parent_name: row.parent_name || '',
          parent_phone: row.parent_phone || '',
          parent_phone2: row.parent_phone2 || undefined,
          status: 'active',
        })
        success++
      } catch (error) {
        console.error('Bulk student import error:', error)
        failed++
      }
    }

    setImportSummary({ success, failed, total: templateRows.length })
    setImportingTemplate(false)
  }

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    // Validate required fields
    if (!newStudent.first_name?.trim()) {
      toast.error('First name is required')
      return
    }
    if (!newStudent.last_name?.trim()) {
      toast.error('Last name is required')
      return
    }
    if (!newStudent.class_id) {
      toast.error('Please select a class')
      return
    }
    if (!newStudent.parent_name?.trim()) {
      toast.error('Parent/Guardian name is required')
      return
    }
    if (!newStudent.parent_phone?.trim()) {
      toast.error('Parent phone is required')
      return
    }

    try {
      setSaving(true)
      const studentNumber = newStudent.student_number || `STU${String(students.length + 1).padStart(5, '0')}`
      await createStudent({
        first_name: newStudent.first_name.trim(),
        last_name: newStudent.last_name.trim(),
        gender: newStudent.gender,
        date_of_birth: newStudent.date_of_birth || undefined,
        parent_name: newStudent.parent_name.trim(),
        parent_phone: newStudent.parent_phone.trim(),
        parent_phone2: newStudent.parent_phone2?.trim() || undefined,
        class_id: newStudent.class_id,
        student_number: studentNumber,
        ple_index_number: newStudent.ple_index_number?.trim() || undefined,
        status: 'active',
      })
      toast.success('Student added successfully')
      setShowAddModal(false)
      setNewStudent({
        first_name: '',
        last_name: '',
        gender: 'M',
        date_of_birth: '',
        parent_name: '',
        parent_phone: '',
        parent_phone2: '',
        class_id: '',
        student_number: '',
        ple_index_number: '',
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add student'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Are you sure you want to remove this student?')) return
    try {
      await deleteStudent(id)
      toast.success('Student removed')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove student'
      toast.error(errorMessage)
    }
  }

  const openEditModal = (student: any) => {
    setEditingStudent(student)
    setEditForm({
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      gender: student.gender || 'M',
      date_of_birth: student.date_of_birth || '',
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      parent_phone2: student.parent_phone2 || '',
      class_id: student.class_id || '',
      student_number: student.student_number || '',
      ple_index_number: student.ple_index_number || '',
    })
    setShowEditModal(true)
  }

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStudent) return
    try {
      setSaving(true)
      await updateStudent(editingStudent.id, editForm)
      toast.success('Student updated successfully')
      setShowEditModal(false)
      setEditingStudent(null)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update student'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    if (students.length === 0) {
      toast.error('No students to export')
      return
    }
    
    const headers = ['Name', 'Student Number', 'Gender', 'Parent Name', 'Parent Phone', 'Class']
    const rows = students.map(s => [
      `${s.first_name} ${s.last_name}`,
      s.student_number || '',
      s.gender === 'M' ? 'Male' : 'Female',
      s.parent_name || '',
      s.parent_phone || '',
      s.classes?.name || '',
    ])
    
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'students.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export downloaded')
  }

  const boysCount = students.filter(s => s.gender === 'M').length
  const girlsCount = students.filter(s => s.gender === 'F').length

  const generatePLEIndexNumbers = async () => {
    const p7Students = students.filter(s => s.classes?.name?.startsWith('P.7') && !s.ple_index_number)
    if (p7Students.length === 0) {
      toast.error('No P.7 students without index numbers')
      return
    }
    
    try {
      const year = new Date().getFullYear()
      const schoolCode = school?.school_code || 'SCHL'
      let startNum = 1
      
      const existingNumbers = students.filter(s => s.ple_index_number?.startsWith(schoolCode + year))
      if (existingNumbers.length > 0) {
        const nums = existingNumbers.map(s => parseInt(s.ple_index_number?.slice(-4) || '0'))
        startNum = Math.max(...nums) + 1
      }
      
      for (const student of p7Students) {
        const indexNum = `${schoolCode}${year}${String(startNum).padStart(4, '0')}`
        await updateStudent(student.id, { ple_index_number: indexNum })
        startNum++
      }
      
      toast.success(`Generated ${p7Students.length} PLE index numbers`)
    } catch (err) {
      toast.error('Failed to generate index numbers')
    }
  }

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <div className="ph-title">Student Registry</div>
          <div className="ph-sub">{students.length} students enrolled</div>
        </div>
        <div className="ph-actions">
          <button onClick={generatePLEIndexNumbers} className="btn btn-ghost">
            <MaterialIcon icon="tag" style={{ fontSize: '16px' }} />
            Generate PLE Index
          </button>
          <button onClick={handleExport} className="btn btn-ghost">
            <MaterialIcon icon="download" style={{ fontSize: '16px' }} />
            Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <MaterialIcon icon="person_add" style={{ fontSize: '16px' }} />
            Add Student
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '22px', borderRadius: '24px', marginBottom: '20px' }}>
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[#17325F] mb-2">Quick import</div>
        <div className="flex flex-wrap gap-3 text-sm text-[#5c6670]">
          <p className="flex-1 min-w-[220px]">
            Download the structured templates, drop your data, and let the AI-like parser map columns to fields. The preview lets you confirm before seeding the students registry.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="/templates/classes-template.csv" download target="_blank" className="btn btn-ghost btn-sm">Class template</a>
            <a href="/templates/staff-template.csv" download target="_blank" className="btn btn-ghost btn-sm">Staff template</a>
            <a href="/templates/students-template.csv" download target="_blank" className="btn btn-ghost btn-sm">Student template</a>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <div className="space-y-3 rounded-[20px] border border-[#e5e9f0] bg-white/60 p-4">
            <div className="text-sm font-semibold text-[#10233b]">Upload student list</div>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleStudentTemplateUpload}
              className="w-full text-sm text-slate-600"
              disabled={templateStatus === 'parsing'}
            />
            <p className="text-xs text-[#5c6670]">We auto-map Excel columns using simple heuristics; add headers exactly as shown.</p>
            {templateStatus === 'parsing' && <p className="text-xs text-[#2e7d32]">Parsing file...</p>}
            {templateErrors && <p className="text-xs text-[#b45309]">{templateErrors}</p>}
            {templateStatus === 'ready' && (
              <button
                onClick={handleSeedStudentsFromTemplate}
                className="btn btn-primary btn-sm"
                disabled={importingTemplate}
              >
                {importingTemplate ? 'Seeding...' : 'Seed students from template'}
              </button>
            )}
            {importSummary && (
              <p className="text-xs text-[#17325F]">
                Imported {importSummary.success}/{importSummary.total} students ({importSummary.failed} failed).
              </p>
            )}
          </div>
          <div className="rounded-[20px] border border-[#e5e9f0] bg-[#f8fbff] p-4 space-y-3">
            <div className="text-sm font-semibold text-[#10233b]">Preview & AI hints</div>
            {templatePreviewRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {Object.keys(templatePreviewRows[0]).map((col) => (
                        <th key={col} className="px-2 py-1 text-left text-[11px] uppercase tracking-[0.2em] text-[#5b6272]">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {templatePreviewRows.map((row, index) => (
                      <tr key={index} className="border-t border-[#d8dee9]">
                        {Object.values(row).map((value, idx) => (
                          <td key={`${index}-${idx}`} className="px-2 py-1 truncate max-w-[120px]">{value || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[#5c6670]">Upload a file to preview the parsed rows.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: 'var(--navy)' }}>group</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Total</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>{students.length}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(23,50,95,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: 'var(--navy)' }}>male</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Boys</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>{boysCount}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(192,57,43,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: 'var(--red)' }}>female</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Girls</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>{girlsCount}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: 'var(--green)' }}>school</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Classes</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>{classes.length}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <MaterialIcon style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--t3)' }}>search</MaterialIcon>
            <input
              type="text"
              placeholder="Search by name, parent, or student number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--bg)', color: 'var(--t1)' }}
            />
          </div>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface)', color: 'var(--t1)', minWidth: 140, cursor: 'pointer' }}
          >
            <option value="all">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ height: 40, width: '100%' }}></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <MaterialIcon style={{ fontSize: 24, color: 'var(--t3)' }}>group</MaterialIcon>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>No students found</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>{searchTerm ? 'Try a different search term' : 'Add your first student to get started'}</div>
            {!searchTerm && (
              <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ marginTop: 16 }}>
                <MaterialIcon icon="person_add" style={{ fontSize: '16px' }} />
                Add Student
              </button>
            )}
          </div>
        ) : (
          <div className="tbl-wrap table-responsive">
            <table>
              <thead>
                <tr>
                  <th data-label="Student">Student</th>
                  <th data-label="Number">Number</th>
                  <th data-label="Class">Class</th>
                  <th data-label="Parent">Parent</th>
                  <th data-label="Phone">Phone</th>
                  <th data-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id}>
                    <td data-label="Student">
                      <Link href={`/dashboard/students/${student.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', background: student.gender === 'M' ? 'var(--navy)' : 'var(--red)' }}>
                          {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{student.first_name} {student.last_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--t3)' }}>{student.gender === 'M' ? 'Male' : 'Female'}</div>
                        </div>
                      </Link>
                    </td>
                    <td data-label="Number" style={{ fontFamily: 'DM Mono', fontSize: 12 }}>{student.student_number || '-'}</td>
                    <td data-label="Class">
                      <span style={{ padding: '4px 10px', background: 'var(--bg)', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        {student.classes?.name || '-'}
                      </span>
                    </td>
                    <td data-label="Parent" style={{ fontSize: 13 }}>{student.parent_name || '-'}</td>
                    <td data-label="Phone" style={{ fontSize: 13, fontFamily: 'DM Mono' }}>{student.parent_phone || '-'}</td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setSmsTarget(student)} title="SMS Parent" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }}>
                          <MaterialIcon style={{ fontSize: 16, color: 'var(--t3)' }}>sms</MaterialIcon>
                        </button>
                        <button onClick={() => openEditModal(student)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }}>
                          <MaterialIcon style={{ fontSize: 16, color: 'var(--t3)' }}>edit</MaterialIcon>
                        </button>
                        <button onClick={() => handleDeleteStudent(student.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }}>
                          <MaterialIcon style={{ fontSize: 16, color: 'var(--t3)' }}>delete</MaterialIcon>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700 }}>Add New Student</div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>close</MaterialIcon>
              </button>
            </div>
            <form onSubmit={handleCreateStudent} style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>First Name</label>
                  <input type="text" value={newStudent.first_name} onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })} className="input" required />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Last Name</label>
                  <input type="text" value={newStudent.last_name} onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })} className="input" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Gender</label>
                  <select value={newStudent.gender} onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value as 'M' | 'F' })} className="input">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Date of Birth</label>
                  <input type="date" value={newStudent.date_of_birth} onChange={(e) => setNewStudent({ ...newStudent, date_of_birth: e.target.value })} className="input" />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Class</label>
                {classes.length === 0 ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, padding: 16 }}>
                    <p style={{ color: '#92400E', fontSize: 14, fontWeight: 600 }}>No classes found</p>
                    <p style={{ color: '#B45309', fontSize: 12, marginTop: 4 }}>Contact support if this persists.</p>
                  </div>
                ) : (
                  <select value={newStudent.class_id} onChange={(e) => setNewStudent({ ...newStudent, class_id: e.target.value })} className="input" required>
                    <option value="">Select class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Parent Name</label>
                <input type="text" value={newStudent.parent_name} onChange={(e) => setNewStudent({ ...newStudent, parent_name: e.target.value })} className="input" required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Parent Phone</label>
                  <input type="tel" placeholder="0700000000" value={newStudent.parent_phone} onChange={(e) => setNewStudent({ ...newStudent, parent_phone: e.target.value })} className="input" required />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Alt. Phone</label>
                  <input type="tel" placeholder="0700000000" value={newStudent.parent_phone2} onChange={(e) => setNewStudent({ ...newStudent, parent_phone2: e.target.value })} className="input" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Adding...' : 'Add Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingStudent && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700 }}>Edit Student</div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>close</MaterialIcon>
              </button>
            </div>
            <form onSubmit={handleUpdateStudent} style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>First Name</label>
                  <input type="text" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className="input" required />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Last Name</label>
                  <input type="text" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className="input" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Gender</label>
                  <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as 'M' | 'F' })} className="input">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Date of Birth</label>
                  <input type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} className="input" />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Class</label>
                <select value={editForm.class_id} onChange={(e) => setEditForm({ ...editForm, class_id: e.target.value })} className="input" required>
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Parent Name</label>
                <input type="text" value={editForm.parent_name} onChange={(e) => setEditForm({ ...editForm, parent_name: e.target.value })} className="input" required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Parent Phone</label>
                  <input type="tel" placeholder="0700000000" value={editForm.parent_phone} onChange={(e) => setEditForm({ ...editForm, parent_phone: e.target.value })} className="input" required />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Alt. Phone</label>
                  <input type="tel" placeholder="0700000000" value={editForm.parent_phone2} onChange={(e) => setEditForm({ ...editForm, parent_phone2: e.target.value })} className="input" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Updating...' : 'Update Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {smsTarget && (
        <SendSMSModal
          student={smsTarget}
          isOpen={!!smsTarget}
          onClose={() => setSmsTarget(null)}
        />
      )}
    </div>
  )
}
