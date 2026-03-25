'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 mt-1">{students.length} students registered</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="btn btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, parent, or student number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
          />
        </div>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="input sm:w-48"
        >
          <option value="all">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Students List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card">
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
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No students found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'Try a different search term' : 'Add your first student to get started'}
          </p>
          {!searchTerm && (
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
              Add Student
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student Number</th>
                  <th>Class</th>
                  <th>Parent</th>
                  <th>Phone</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <Link href={`/dashboard/students/${student.id}`} className="flex items-center gap-3 hover:text-blue-600">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 font-semibold text-sm">
                            {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{student.first_name} {student.last_name}</div>
                          <div className="text-xs text-gray-500">{student.gender === 'M' ? 'Male' : 'Female'}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="text-gray-600">{student.student_number || '-'}</td>
                    <td className="text-gray-600">{student.classes?.name || '-'}</td>
                    <td className="text-gray-600">{student.parent_name || '-'}</td>
                    <td className="text-gray-600">{student.parent_phone || '-'}</td>
                    <td>
                      <button
                        onClick={() => handleDeleteStudent(student.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Add New Student</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input
                    type="text"
                    value={newStudent.first_name}
                    onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input
                    type="text"
                    value={newStudent.last_name}
                    onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Gender</label>
                  <select
                    value={newStudent.gender}
                    onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value as 'M' | 'F' })}
                    className="input"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input
                    type="date"
                    value={newStudent.date_of_birth}
                    onChange={(e) => setNewStudent({ ...newStudent, date_of_birth: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Class</label>
                <select
                  value={newStudent.class_id}
                  onChange={(e) => setNewStudent({ ...newStudent, class_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Parent Name</label>
                <input
                  type="text"
                  value={newStudent.parent_name}
                  onChange={(e) => setNewStudent({ ...newStudent, parent_name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Parent Phone</label>
                  <input
                    type="tel"
                    placeholder="0700000000"
                    value={newStudent.parent_phone}
                    onChange={(e) => setNewStudent({ ...newStudent, parent_phone: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Second Phone (Optional)</label>
                  <input
                    type="tel"
                    placeholder="0700000000"
                    value={newStudent.parent_phone2}
                    onChange={(e) => setNewStudent({ ...newStudent, parent_phone2: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
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
