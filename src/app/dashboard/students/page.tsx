'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function StudentsPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { students, loading, createStudent, updateStudent, deleteStudent } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
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

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    try {
      setSaving(true)
      const studentNumber = newStudent.student_number || `STU${String(students.length + 1).padStart(5, '0')}`
      await createStudent({
        ...newStudent,
        student_number: studentNumber,
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
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Number</th>
                  <th>Class</th>
                  <th>Parent</th>
                  <th>Phone</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id}>
                    <td>
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
                    <td style={{ fontFamily: 'DM Mono', fontSize: 12 }}>{student.student_number || '-'}</td>
                    <td>
                      <span style={{ padding: '4px 10px', background: 'var(--bg)', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        {student.classes?.name || '-'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{student.parent_name || '-'}</td>
                    <td style={{ fontSize: 13, fontFamily: 'DM Mono' }}>{student.parent_phone || '-'}</td>
                    <td>
                      <button onClick={() => handleDeleteStudent(student.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }}>
                        <MaterialIcon style={{ fontSize: 16, color: 'var(--t3)' }}>delete</MaterialIcon>
                      </button>
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
                <select value={newStudent.class_id} onChange={(e) => setNewStudent({ ...newStudent, class_id: e.target.value })} className="input" required>
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
    </div>
  )
}
