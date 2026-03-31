'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useClasses, useSubjects } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { useFormDraft } from '@/lib/useAutoSave'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface Homework {
  id: string
  title: string
  description: string
  subject_id: string
  class_id: string
  due_date: string
  marks: number
  status: string
  created_by: string
  created_at: string
  subjects?: { name: string; code: string }
  classes?: { name: string }
}

export default function HomeworkPage() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  
  const [homework, setHomework] = useState<Homework[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState('')
  
  // Auto-save for homework form
  const homeworkDraft = useFormDraft('homework_add_form')
  const [newHomework, setNewHomework] = useState({
    title: '',
    description: '',
    subject_id: '',
    class_id: '',
    due_date: '',
    marks: 10,
  })

  const fetchHomework = async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      let query = supabase
        .from('homework')
        .select('*, subjects(name, code), classes(name)')
        .eq('school_id', school.id)
        .order('due_date', { ascending: false })

      if (selectedClass) {
        query = query.eq('class_id', selectedClass)
      }

      const { data, error } = await query
      if (error) throw error
      setHomework(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateHomework = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id || !user?.id) return

    try {
      const { error } = await supabase.from('homework').insert({
        school_id: school.id,
        title: newHomework.title,
        description: newHomework.description,
        subject_id: newHomework.subject_id,
        class_id: newHomework.class_id,
        due_date: newHomework.due_date,
        marks: newHomework.marks,
        created_by: user.id,
        academic_year: academicYear,
        term: currentTerm,
      })

      if (error) throw error
      toast.success('Homework assigned')
      setShowModal(false)
      homeworkDraft.clearSaved() // Clear auto-save after success
      setNewHomework({ title: '', description: '', subject_id: '', class_id: '', due_date: '', marks: 10 })
      fetchHomework()
    } catch (err) {
      toast.error('Failed to create homework')
    }
  }

  const getStatusBadge = (homework: Homework) => {
    const dueDate = new Date(homework.due_date)
    const now = new Date()
    const isOverdue = dueDate < now
    
    if (isOverdue) {
      return <span className="px-2 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-600">Overdue</span>
    }
    return <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-600">Active</span>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-2xl text-gray-900">Homework & Assignments</h2>
          <p className="text-gray-500 mt-1">Manage class assignments and track submissions</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 shadow-lg transition-all"
        >
          <MaterialIcon icon="add" className="text-lg" />
          Assign Homework
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); fetchHomework() }}
          className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium"
        >
          <option value="">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Homework Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
              <div className="skeleton h-5 w-24 mb-3"></div>
              <div className="skeleton h-6 w-full mb-2"></div>
              <div className="skeleton h-4 w-3/4"></div>
            </div>
          ))}
        </div>
      ) : homework.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon className="text-3xl text-gray-400">assignment</MaterialIcon>
          </div>
          <h3 className="font-bold text-gray-900 mb-2">No Homework Assigned</h3>
          <p className="text-gray-500 mb-4">Assign your first homework to get started</p>
          <button onClick={() => setShowModal(true)} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-semibold">
            Assign Homework
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {homework.map(hw => (
            <div key={hw.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <MaterialIcon className="text-blue-600">menu_book</MaterialIcon>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">{hw.subjects?.name || 'Subject'}</p>
                    <p className="text-xs text-gray-400">{hw.classes?.name}</p>
                  </div>
                </div>
                {getStatusBadge(hw)}
              </div>
              
              <h3 className="font-bold text-gray-900 mb-2">{hw.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-2 mb-4">{hw.description}</p>
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <MaterialIcon className="text-sm">calendar_today</MaterialIcon>
                    {hw.due_date}
                  </span>
                  <span className="flex items-center gap-1">
                    <MaterialIcon className="text-sm">grade</MaterialIcon>
                    {hw.marks} marks
                  </span>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <MaterialIcon className="text-gray-400">chevron_right</MaterialIcon>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-gray-900 mb-4">Assign Homework</h3>
            <form onSubmit={handleCreateHomework} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Title</label>
                <input
                  type="text"
                  value={newHomework.title}
                  onChange={e => setNewHomework({...newHomework, title: e.target.value})}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Description</label>
                <textarea
                  value={newHomework.description}
                  onChange={e => setNewHomework({...newHomework, description: e.target.value})}
                  className="input"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Class</label>
                  {classes.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">No classes available</div>
                  ) : (
                    <select
                      value={newHomework.class_id}
                      onChange={e => setNewHomework({...newHomework, class_id: e.target.value})}
                      className="input"
                      required
                    >
                      <option value="">Select Class</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Subject</label>
                  {subjects.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">No subjects available</div>
                  ) : (
                    <select
                      value={newHomework.subject_id}
                      onChange={e => setNewHomework({...newHomework, subject_id: e.target.value})}
                      className="input"
                      required
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Due Date</label>
                  <input
                    type="date"
                    value={newHomework.due_date}
                    onChange={e => setNewHomework({...newHomework, due_date: e.target.value})}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Marks</label>
                  <input
                    type="number"
                    value={newHomework.marks}
                    onChange={e => setNewHomework({...newHomework, marks: parseInt(e.target.value) || 10})}
                    className="input"
                    min={1}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800">
                  Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
