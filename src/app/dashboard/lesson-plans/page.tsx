'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses, useSubjects } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { useToast } from '@/components/Toast'

interface LessonPlan {
  id: string
  title: string
  class_id: string
  subject_id: string
  week: number
  lesson: number
  duration: number
  topic: string
  subtopic: string
  objectives: string
  description: string
  resources: string
  homework: string
  notes: string
  status: 'draft' | 'submitted' | 'approved'
  created_at: string
  subjects?: { name: string }
  classes?: { name: string }
  users?: { full_name: string }
}

export default function LessonPlansPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id, false)
  
  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<LessonPlan | null>(null)
  
  const [form, setForm] = useState({
    class_id: '',
    subject_id: '',
    week: '1',
    lesson: '1',
    duration: '40',
    title: '',
    topic: '',
    subtopic: '',
    objectives: '',
    introduction: '',
    presentation: '',
    consolidation: '',
    evaluation: '',
    resources: '',
    homework: '',
    notes: ''
  })

  useEffect(() => {
    fetchPlans()
  }, [school?.id])

  const fetchPlans = async () => {
    if (!school?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('lesson_plans')
      .select('*, subjects(name), classes(name), users(full_name)')
      .eq('school_id', school.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setPlans(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id || !user?.id) return
    
    setSaving(true)
    try {
      const payload = {
        school_id: school.id,
        class_id: form.class_id,
        subject_id: form.subject_id,
        title: form.title,
        topic: form.topic,
        subtopic: form.subtopic,
        objectives: form.objectives,
        description: `${form.introduction}\n\n${form.presentation}\n\n${form.consolidation}\n\n${form.evaluation}`,
        resources: form.resources,
        homework: form.homework,
        duration: parseInt(form.duration),
        week: parseInt(form.week),
        lesson: parseInt(form.lesson),
        created_by: user.id,
        status: 'draft',
        academic_year: '2026',
        term: 1
      }
      
      const { error } = await supabase.from('lesson_plans').insert(payload)
      if (error) throw error
      
      toast.success('Lesson plan saved!')
      setShowForm(false)
      resetForm()
      fetchPlans()
    } catch (err) {
      toast.error('Failed to save lesson plan')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setForm({
      class_id: '', subject_id: '', week: '1', lesson: '1', duration: '40',
      title: '', topic: '', subtopic: '', objectives: '',
      introduction: '', presentation: '', consolidation: '', evaluation: '',
      resources: '', homework: '', notes: ''
    })
  }

  const openEdit = (plan: LessonPlan) => {
    setSelectedPlan(plan)
    setForm({
      class_id: plan.class_id,
      subject_id: plan.subject_id,
      week: String(plan.week),
      lesson: String(plan.lesson),
      duration: String(plan.duration),
      title: plan.title,
      topic: plan.topic || '',
      subtopic: plan.subtopic || '',
      objectives: plan.objectives || '',
      introduction: '',
      presentation: '',
      consolidation: '',
      evaluation: '',
      resources: plan.resources || '',
      homework: plan.homework || '',
      notes: plan.notes || ''
    })
    setShowForm(true)
  }

  // Parse description back into sections
  const getDescriptionSection = (desc: string, section: string) => {
    if (!desc) return ''
    const parts = desc.split('\n\n')
    const sectionMap: Record<string, number> = {
      introduction: 0, presentation: 1, consolidation: 2, evaluation: 3
    }
    return parts[sectionMap[section]] || ''
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Lesson Plans</h1>
          <p className="text-[#5c6670] mt-1">Detailed lesson plans for effective teaching</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="btn btn-primary">
          <MaterialIcon icon="add" style={{ fontSize: '16px' }} />
          New Lesson Plan
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[#17325F] border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 text-[#5c6670]">
          <MaterialIcon style={{ fontSize: 48, opacity: 0.5 }}>assignment</MaterialIcon>
          <p className="mt-2">No lesson plans yet</p>
          <button onClick={() => setShowForm(true)} className="btn btn-primary mt-4">
            Create First Lesson Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div 
              key={plan.id} 
              onClick={() => openEdit(plan)}
              className="card hover:shadow-md cursor-pointer"
            >
              <div className="card-header">
                <div>
                  <div className="card-title">{plan.title}</div>
                  <div className="card-sub">{plan.subjects?.name} - {plan.classes?.name}</div>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  plan.status === 'approved' ? 'bg-green-100 text-green-700' :
                  plan.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {plan.status}
                </span>
              </div>
              <div className="card-body">
                <div className="flex items-center gap-4 text-xs text-[#5c6670] mb-2">
                  <span>Week {plan.week}, Lesson {plan.lesson}</span>
                  <span>{plan.duration} min</span>
                </div>
                {plan.topic && (
                  <p className="text-sm text-[#5c6670] line-clamp-2">{plan.topic}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lesson Plan Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl my-8">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#17325F]">
                  {selectedPlan ? 'Edit Lesson Plan' : 'New Lesson Plan'}
                </h2>
                <button onClick={() => { setShowForm(false); setSelectedPlan(null) }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <MaterialIcon>close</MaterialIcon>
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">Class *</label>
                  <select
                    value={form.class_id}
                    onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    required
                  >
                    <option value="">Select</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">Subject *</label>
                  <select
                    value={form.subject_id}
                    onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    required
                  >
                    <option value="">Select</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">Week</label>
                  <select
                    value={form.week}
                    onChange={(e) => setForm({ ...form, week: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  >
                    {[...Array(12)].map((_, i) => <option key={i} value={i+1}>Week {i+1}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">Lesson #</label>
                  <select
                    value={form.lesson}
                    onChange={(e) => setForm({ ...form, lesson: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  >
                    {[...Array(8)].map((_, i) => <option key={i} value={i+1}>{i+1}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">Lesson Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="e.g., Introduction to Fractions"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">Duration (min)</label>
                  <select
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  >
                    <option value="30">30 min</option>
                    <option value="40">40 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">Topic</label>
                  <input
                    type="text"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="Main topic"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">Subtopic</label>
                  <input
                    type="text"
                    value={form.subtopic}
                    onChange={(e) => setForm({ ...form, subtopic: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="Specific subtopic"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#17325F] mb-1">Learning Objectives</label>
                <textarea
                  value={form.objectives}
                  onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="By end of lesson, students will be able to..."
                  rows={2}
                />
              </div>

              {/* Lesson Structure */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#17325F]">Lesson Structure</h3>
                
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">🎯 Introduction (5 min)</label>
                  <textarea
                    value={form.introduction}
                    onChange={(e) => setForm({ ...form, introduction: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="How you'll start the lesson, hook, prior knowledge..."
                    rows={2}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">📚 Presentation (15 min)</label>
                  <textarea
                    value={form.presentation}
                    onChange={(e) => setForm({ ...form, presentation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="New content delivery, demonstration, examples..."
                    rows={2}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">✋ Consolidation (15 min)</label>
                  <textarea
                    value={form.consolidation}
                    onChange={(e) => setForm({ ...form, consolidation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="Group work, practice activities, guided practice..."
                    rows={2}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">✅ Evaluation (5 min)</label>
                  <textarea
                    value={form.evaluation}
                    onChange={(e) => setForm({ ...form, evaluation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="Exit ticket, quick quiz, Q&A..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">📦 Resources</label>
                  <textarea
                    value={form.resources}
                    onChange={(e) => setForm({ ...form, resources: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="Charts, flashcards, digital..."
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#17325F] mb-1">🏠 Homework</label>
                  <textarea
                    value={form.homework}
                    onChange={(e) => setForm({ ...form, homework: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="Assignment for next lesson..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setSelectedPlan(null) }}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-[#17325F] text-white rounded-xl font-semibold"
                >
                  {saving ? 'Saving...' : 'Save Lesson Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}