'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses, useSubjects } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { useToast } from '@/components/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

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

  const fetchPlans = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('lesson_plans')
        .select('*, subjects(name), classes(name), users(full_name)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setPlans(data || [])
    } catch (err) {
      console.error('Failed to fetch lesson plans:', err)
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Lesson Plans"
        subtitle="Detailed lesson plans for effective teaching"
        actions={
          <Button onClick={() => { resetForm(); setShowForm(true) }}>
            <MaterialIcon icon="add" className="text-base" />
            New Lesson Plan
          </Button>
        }
      />

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : plans.length === 0 ? (
        <Card className="p-12 text-center">
          <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">assignment</MaterialIcon>
          <p className="mt-2 text-[var(--t3)]">No lesson plans yet</p>
          <Button className="mt-4" onClick={() => setShowForm(true)}>
            Create First Lesson Plan
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <Card 
              key={plan.id} 
              className="p-4 hover:shadow-md cursor-pointer"
              onClick={() => openEdit(plan)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[var(--t1)]">{plan.title}</h3>
                  <p className="text-sm text-[var(--t3)]">{plan.subjects?.name} - {plan.classes?.name}</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  plan.status === 'approved' ? 'bg-green-100 text-green-700' :
                  plan.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {plan.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[var(--t3)] mb-2">
                <span>Week {plan.week}, Lesson {plan.lesson}</span>
                <span>{plan.duration} min</span>
              </div>
              {plan.topic && (
                <p className="text-sm text-[var(--t3)] line-clamp-2">{plan.topic}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-3xl my-8">
            <div className="p-6 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[var(--t1)]">
                  {selectedPlan ? 'Edit Lesson Plan' : 'New Lesson Plan'}
                </h2>
                <button onClick={() => { setShowForm(false); setSelectedPlan(null) }} className="p-2 hover:bg-[var(--surface-container)] rounded-lg">
                  <MaterialIcon>close</MaterialIcon>
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Class *</label>
                  <select
                    value={form.class_id}
                    onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    required
                  >
                    <option value="">Select</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Subject *</label>
                  <select
                    value={form.subject_id}
                    onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    required
                  >
                    <option value="">Select</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Week</label>
                  <select
                    value={form.week}
                    onChange={(e) => setForm({ ...form, week: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                  >
                    {[...Array(12)].map((_, i) => <option key={i} value={i+1}>Week {i+1}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Lesson #</label>
                  <select
                    value={form.lesson}
                    onChange={(e) => setForm({ ...form, lesson: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                  >
                    {[...Array(8)].map((_, i) => <option key={i} value={i+1}>{i+1}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Lesson Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="e.g., Introduction to Fractions"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Duration (min)</label>
                  <select
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
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
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Topic</label>
                  <input
                    type="text"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="Main topic"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Subtopic</label>
                  <input
                    type="text"
                    value={form.subtopic}
                    onChange={(e) => setForm({ ...form, subtopic: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="Specific subtopic"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--t3)] mb-1">Learning Objectives</label>
                <textarea
                  value={form.objectives}
                  onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                  placeholder="By end of lesson, students will be able to..."
                  rows={2}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[var(--t1)]">Lesson Structure</h3>
                
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Introduction (5 min)</label>
                  <textarea
                    value={form.introduction}
                    onChange={(e) => setForm({ ...form, introduction: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="How you'll start the lesson, hook, prior knowledge..."
                    rows={2}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Presentation (15 min)</label>
                  <textarea
                    value={form.presentation}
                    onChange={(e) => setForm({ ...form, presentation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="New content delivery, demonstration, examples..."
                    rows={2}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Consolidation (15 min)</label>
                  <textarea
                    value={form.consolidation}
                    onChange={(e) => setForm({ ...form, consolidation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="Group work, practice activities, guided practice..."
                    rows={2}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Evaluation (5 min)</label>
                  <textarea
                    value={form.evaluation}
                    onChange={(e) => setForm({ ...form, evaluation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="Exit ticket, quick quiz, Q&A..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Resources</label>
                  <textarea
                    value={form.resources}
                    onChange={(e) => setForm({ ...form, resources: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="Charts, flashcards, digital..."
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--t3)] mb-1">Homework</label>
                  <textarea
                    value={form.homework}
                    onChange={(e) => setForm({ ...form, homework: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                    placeholder="Assignment for next lesson..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => { setShowForm(false); setSelectedPlan(null) }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Lesson Plan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
