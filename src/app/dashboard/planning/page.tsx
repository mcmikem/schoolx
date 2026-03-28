'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useClasses, useSubjects } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

interface Syllabus {
  id: string
  subject_id: string
  class_id: string
  term: number
  academic_year: string
  topic: string
  subtopics: string
  objectives: string
  weeks_covered: string
  resources: string
  subjects?: { name: string; code: string }
  classes?: { name: string }
}

export default function PlanningPage() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)

  const [syllabus, setSyllabus] = useState<Syllabus[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'syllabus' | 'lessonplans'>('syllabus')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [showAddTopic, setShowAddTopic] = useState(false)
  const [showAddLesson, setShowAddLesson] = useState(false)

  const [newTopic, setNewTopic] = useState<{
    subject_id: string
    class_id: string
    term: number
    topic: string
    subtopics: string
    objectives: string
    weeks_covered: string
    resources: string
  }>({
    subject_id: '',
    class_id: '',
    term: currentTerm || 1,
    topic: '',
    subtopics: '',
    objectives: '',
    weeks_covered: '',
    resources: '',
  })

  const [newLesson, setNewLesson] = useState({
    subject_id: '',
    class_id: '',
    topic: '',
    lesson_title: '',
    objectives: '',
    materials: '',
    procedure: '',
    duration: 40,
    date: '',
  })

  const fetchSyllabus = async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      let query = supabase
        .from('syllabus')
        .select('*, subjects(name, code), classes(name)')
        .eq('school_id', school.id)
        .eq('academic_year', academicYear)

      if (selectedClass) query = query.eq('class_id', selectedClass)
      if (selectedSubject) query = query.eq('subject_id', selectedSubject)

      const { data, error } = await query.order('term', { ascending: true })
      if (error) throw error
      setSyllabus(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id || !user?.id) return

    try {
      const { error } = await supabase.from('syllabus').insert({
        school_id: school.id,
        subject_id: newTopic.subject_id,
        class_id: newTopic.class_id,
        term: newTopic.term,
        academic_year: academicYear,
        topic: newTopic.topic,
        subtopics: newTopic.subtopics,
        objectives: newTopic.objectives,
        weeks_covered: newTopic.weeks_covered,
        resources: newTopic.resources,
        created_by: user.id,
      })

      if (error) throw error
      toast.success('Topic added to syllabus')
      setShowAddTopic(false)
      setNewTopic({ subject_id: '', class_id: '', term: currentTerm || 1, topic: '', subtopics: '', objectives: '', weeks_covered: '', resources: '' })
      fetchSyllabus()
    } catch (err) {
      toast.error('Failed to add topic')
    }
  }

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id || !user?.id) return

    try {
      const { error } = await supabase.from('lesson_plans').insert({
        school_id: school.id,
        subject_id: newLesson.subject_id,
        class_id: newLesson.class_id,
        topic: newLesson.topic,
        lesson_title: newLesson.lesson_title,
        objectives: newLesson.objectives,
        materials: newLesson.materials,
        procedure: newLesson.procedure,
        duration: newLesson.duration,
        date: newLesson.date || new Date().toISOString().split('T')[0],
        term: currentTerm || 1,
        academic_year: academicYear,
        created_by: user.id,
      })

      if (error) throw error
      toast.success('Lesson plan saved')
      setShowAddLesson(false)
      setNewLesson({ subject_id: '', class_id: '', topic: '', lesson_title: '', objectives: '', materials: '', procedure: '', duration: 40, date: '' })
    } catch (err) {
      toast.error('Failed to save lesson plan')
    }
  }

  const getTopicsByTerm = (term: number) => {
    return syllabus.filter(s => s.term === term)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-2xl text-gray-900">Teacher Planning</h2>
          <p className="text-gray-500 mt-1">Scheme of work, lesson plans & topic coverage</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddTopic(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 shadow-lg"
          >
            <MaterialIcon icon="add" className="text-lg" />
            Add Topic
          </button>
          <button
            onClick={() => setShowAddLesson(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50"
          >
            <MaterialIcon icon="note_add" className="text-lg" />
            Lesson Plan
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('syllabus')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'syllabus' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
          Scheme of Work
        </button>
        <button onClick={() => setTab('lessonplans')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'lessonplans' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
          Lesson Plans
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); fetchSyllabus() }} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); fetchSyllabus() }} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm">
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {tab === 'syllabus' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(term => (
            <div key={term} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Term {term}</h3>
                <p className="text-sm text-gray-500">{getTopicsByTerm(term).length} topics</p>
              </div>
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {getTopicsByTerm(term).map(topic => (
                  <div key={topic.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <MaterialIcon className="text-blue-600 text-sm">menu_book</MaterialIcon>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm">{topic.topic}</h4>
                        <p className="text-xs text-gray-500">{topic.subjects?.name} • {topic.weeks_covered}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {getTopicsByTerm(term).length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No topics</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddTopic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddTopic(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl mb-4">Add Topic to Syllabus</h3>
            <form onSubmit={handleAddTopic} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select value={newTopic.class_id} onChange={e => setNewTopic({...newTopic, class_id: e.target.value})} className="input" required>
                  <option value="">Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={newTopic.subject_id} onChange={e => setNewTopic({...newTopic, subject_id: e.target.value})} className="input" required>
                  <option value="">Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select value={newTopic.term} onChange={e => setNewTopic({...newTopic, term: parseInt(e.target.value)})} className="input">
                  {[1,2,3].map(t => <option key={t} value={t}>Term {t}</option>)}
                </select>
                <input type="text" value={newTopic.weeks_covered} onChange={e => setNewTopic({...newTopic, weeks_covered: e.target.value})} placeholder="Weeks" className="input" />
              </div>
              <input type="text" value={newTopic.topic} onChange={e => setNewTopic({...newTopic, topic: e.target.value})} placeholder="Topic" className="input" required />
              <textarea value={newTopic.subtopics} onChange={e => setNewTopic({...newTopic, subtopics: e.target.value})} placeholder="Subtopics" className="input" rows={2} />
              <textarea value={newTopic.objectives} onChange={e => setNewTopic({...newTopic, objectives: e.target.value})} placeholder="Objectives" className="input" rows={2} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddTopic(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddLesson(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl mb-4">Create Lesson Plan</h3>
            <form onSubmit={handleAddLesson} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select value={newLesson.class_id} onChange={e => setNewLesson({...newLesson, class_id: e.target.value})} className="input" required>
                  <option value="">Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={newLesson.subject_id} onChange={e => setNewLesson({...newLesson, subject_id: e.target.value})} className="input">
                  <option value="">Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <input type="text" value={newLesson.topic} onChange={e => setNewLesson({...newLesson, topic: e.target.value})} placeholder="Topic" className="input" required />
              <input type="text" value={newLesson.lesson_title} onChange={e => setNewLesson({...newLesson, lesson_title: e.target.value})} placeholder="Lesson Title" className="input" required />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" value={newLesson.duration} onChange={e => setNewLesson({...newLesson, duration: parseInt(e.target.value)})} placeholder="Duration (mins)" className="input" />
                <input type="date" value={newLesson.date} onChange={e => setNewLesson({...newLesson, date: e.target.value})} className="input" />
              </div>
              <textarea value={newLesson.objectives} onChange={e => setNewLesson({...newLesson, objectives: e.target.value})} placeholder="Objectives" className="input" rows={2} />
              <input type="text" value={newLesson.materials} onChange={e => setNewLesson({...newLesson, materials: e.target.value})} placeholder="Materials" className="input" />
              <textarea value={newLesson.procedure} onChange={e => setNewLesson({...newLesson, procedure: e.target.value})} placeholder="Lesson Procedure" className="input" rows={4} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddLesson(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
