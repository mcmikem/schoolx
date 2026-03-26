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
  const { students, loading, createStudent, deleteStudent } = useStudents(school?.id)
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

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Student Registry</h2>
          <p className="text-on-surface-variant text-sm font-medium">{students.length} students enrolled</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant/30 text-primary font-semibold text-sm hover:bg-surface-container-low transition-all">
            <MaterialIcon className="text-lg">download</MaterialIcon>
            Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/10">
            <MaterialIcon className="text-lg">person_add</MaterialIcon>
            Add Student
          </button>
        </div>
      </header>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-low p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center">
              <MaterialIcon className="text-primary" style={{ fontVariationSettings: 'FILL 1' }}>group</MaterialIcon>
            </div>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total</span>
          </div>
          <p className="text-2xl font-headline font-bold text-primary">{students.length}</p>
        </div>
        <div className="bg-surface-container-low p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MaterialIcon className="text-blue-700">male</MaterialIcon>
            </div>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Boys</span>
          </div>
          <p className="text-2xl font-headline font-bold text-primary">{boysCount}</p>
        </div>
        <div className="bg-surface-container-low p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
              <MaterialIcon className="text-pink-700">female</MaterialIcon>
            </div>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Girls</span>
          </div>
          <p className="text-2xl font-headline font-bold text-primary">{girlsCount}</p>
        </div>
        <div className="bg-surface-container-low p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-secondary-container rounded-lg flex items-center justify-center">
              <MaterialIcon className="text-secondary" style={{ fontVariationSettings: 'FILL 1' }}>school</MaterialIcon>
            </div>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Classes</span>
          </div>
          <p className="text-2xl font-headline font-bold text-primary">{classes.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-low rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative w-full lg:flex-1">
            <MaterialIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</MaterialIcon>
            <input
              type="text"
              placeholder="Search by name, parent, or student number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-lowest border-none rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/40"
            />
          </div>
          <div className="flex gap-3 w-full lg:w-auto overflow-x-auto no-scrollbar pb-2 lg:pb-0">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-xs font-bold text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[140px]"
            >
              <option value="all">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button className="bg-surface-container-highest px-4 py-3 rounded-xl flex items-center justify-center hover:bg-outline-variant/30 transition-colors">
              <MaterialIcon className="text-lg">filter_list</MaterialIcon>
            </button>
          </div>
        </div>
      </div>

      {/* Students Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-surface-container-lowest p-4 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="skeleton w-12 h-12 rounded-full" />
                <div className="flex-1">
                  <div className="skeleton w-32 h-4 mb-2" />
                  <div className="skeleton w-24 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded-xl text-center">
          <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon className="text-3xl text-on-surface-variant">group</MaterialIcon>
          </div>
          <h3 className="font-headline font-bold text-lg text-primary mb-2">No students found</h3>
          <p className="text-on-surface-variant text-sm mb-4">
            {searchTerm ? 'Try a different search term' : 'Add your first student to get started'}
          </p>
          {!searchTerm && (
            <button onClick={() => setShowAddModal(true)} className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm">
              Add Student
            </button>
          )}
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-left">
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Student</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Number</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Class</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Parent</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Phone</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {filtered.map((student) => (
                  <tr key={student.id} className="hover:bg-surface-bright transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/students/${student.id}`} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-on-primary-container font-bold text-sm">
                            {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="font-bold text-primary">{student.first_name} {student.last_name}</div>
                          <div className="text-xs text-on-surface-variant">{student.gender === 'M' ? 'Male' : 'Female'}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-on-surface-variant">{student.student_number || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-surface-container text-on-surface-variant text-xs font-bold rounded-full">
                        {student.classes?.name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface">{student.parent_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{student.parent_phone || '-'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteStudent(student.id)}
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-colors"
                      >
                        <MaterialIcon className="text-lg">delete</MaterialIcon>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/10">
              <div className="flex items-center justify-between">
                <h2 className="font-headline font-bold text-xl text-primary">Add New Student</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg">
                  <MaterialIcon>close</MaterialIcon>
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateStudent} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">First Name</label>
                  <input
                    type="text"
                    value={newStudent.first_name}
                    onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
                    className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Last Name</label>
                  <input
                    type="text"
                    value={newStudent.last_name}
                    onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
                    className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Gender</label>
                  <select
                    value={newStudent.gender}
                    onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value as 'M' | 'F' })}
                    className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={newStudent.date_of_birth}
                    onChange={(e) => setNewStudent({ ...newStudent, date_of_birth: e.target.value })}
                    className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Class</label>
                <select
                  value={newStudent.class_id}
                  onChange={(e) => setNewStudent({ ...newStudent, class_id: e.target.value })}
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Parent Name</label>
                <input
                  type="text"
                  value={newStudent.parent_name}
                  onChange={(e) => setNewStudent({ ...newStudent, parent_name: e.target.value })}
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Parent Phone</label>
                  <input
                    type="tel"
                    placeholder="0700000000"
                    value={newStudent.parent_phone}
                    onChange={(e) => setNewStudent({ ...newStudent, parent_phone: e.target.value })}
                    className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Alt. Phone</label>
                  <input
                    type="tel"
                    placeholder="0700000000"
                    value={newStudent.parent_phone2}
                    onChange={(e) => setNewStudent({ ...newStudent, parent_phone2: e.target.value })}
                    className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold text-sm rounded-xl hover:bg-surface-bright transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-3 bg-primary text-white font-semibold text-sm rounded-xl hover:opacity-90 transition-colors">
                  {saving ? 'Adding...' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}