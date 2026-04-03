'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses, useSubjects, useExamScores, useExams } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { EXAM_TYPES, SECONDARY_EXAM_TYPES, PRIMARY_EXAM_TYPES, calculateWeightedGrade, getExamTypeLabel, getExamColor, ExamConfig } from '@/lib/exams'
import { getUNEBGrade, getUNEBDivision } from '@/lib/grading'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { Tabs } from '@/components/ui/Tabs'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { NoData } from '@/components/EmptyState'

export default function ExamsPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm, isTermLocked } = useAcademic()
  const toast = useToast()
  
  const termLocked = isTermLocked ? isTermLocked(academicYear, currentTerm) : false
  
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id, false)
  const { exams, loading: examsLoading, createExam, deleteExam } = useExams(school?.id)
  const { examScores, loading: scoresLoading, saveExamScore, deleteExamScore } = useExamScores(
    undefined, undefined, currentTerm, academicYear
  )

  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedExamType, setSelectedExamType] = useState('eot')
  const [showAddExam, setShowAddExam] = useState(false)
  const [examTypeTab, setExamTypeTab] = useState('secondary')
  const [saving, setSaving] = useState(false)
  const [newExam, setNewExam] = useState({
    name: '',
    exam_type: 'eot',
    class_id: '',
    subject_id: '',
    exam_date: '',
    max_score: 100,
    weight: 50,
  })

  const isSecondary = examTypeTab === 'secondary'

  const filteredStudents = useMemo(() => {
    return students.filter(s => !selectedClass || s.class_id === selectedClass)
  }, [students, selectedClass])

  const studentExamScores = useMemo(() => {
    if (!selectedClass || !selectedSubject) return {}
    
    const scores: Record<string, Record<string, number>> = {}
    examScores
      .filter(s => s.class_id === selectedClass && s.subject_id === selectedSubject)
      .forEach(score => {
        if (!scores[score.student_id]) scores[score.student_id] = {}
        scores[score.student_id][score.exam_type] = score.score
      })
    return scores
  }, [examScores, selectedClass, selectedSubject])

  const handleSaveScore = async (studentId: string, score: number) => {
    if (!selectedClass || !selectedSubject) {
      toast.error('Select class and subject first')
      return
    }
    
    try {
      await saveExamScore({
        student_id: studentId,
        subject_id: selectedSubject,
        class_id: selectedClass,
        exam_type: selectedExamType,
        score,
        max_score: 100,
        term: currentTerm || 1,
        academic_year: academicYear || '2026',
      })
      toast.success('Score saved')
    } catch (err) {
      toast.error('Failed to save score')
    }
  }

  const handleAddExam = async () => {
    if (!newExam.name || !newExam.class_id || !newExam.subject_id) {
      toast.error('Fill all required fields')
      return
    }

    try {
      await createExam({
        ...newExam,
        term: currentTerm || 1,
        academic_year: academicYear || '2026',
      })
      toast.success('Exam created')
      setShowAddExam(false)
      setNewExam({ name: '', exam_type: 'eot', class_id: '', subject_id: '', exam_date: '', max_score: 100, weight: 50 })
    } catch (err) {
      toast.error('Failed to create exam')
    }
  }

  const examConfigs = isSecondary ? SECONDARY_EXAM_TYPES : PRIMARY_EXAM_TYPES

  const getStudentTotal = (studentId: string) => {
    const scores = studentExamScores[studentId] || {}
    const { total } = calculateWeightedGrade(scores, examConfigs)
    return total
  }

  return (
    <div className="content">
      <PageHeader 
        title={isSecondary ? 'Exam Management' : 'Exams & Grades'}
        subtitle={`${academicYear} Term ${currentTerm} • ${isSecondary ? 'BOT, Mid Term, EOT, Saturday Tests' : 'CA, Mid Term, EOT'}`}
        actions={
          <div className="flex items-center gap-3">
            {termLocked && (
              <span className="px-3 py-1 bg-error-container text-on-error-container rounded-full text-xs font-bold uppercase flex items-center gap-1">
                <MaterialIcon icon="lock" className="text-sm" /> Term Locked
              </span>
            )}
            <Button onClick={() => setShowAddExam(true)} disabled={termLocked} variant="primary">
              <MaterialIcon icon="add" className="text-lg" />
              Create Exam
            </Button>
          </div>
        }
      />

      <div className="mb-6">
        <Tabs
          tabs={[
            { id: 'secondary', label: 'Secondary', count: 4 },
            { id: 'primary', label: 'Primary', count: 3 },
          ]}
          activeTab={examTypeTab}
          onChange={setExamTypeTab}
        />
      </div>

      <Card className="mb-5 p-4">
        <div className="text-xs font-semibold text-[var(--t2)] mb-3">Grade Weighting</div>
        <div className="flex flex-wrap gap-3">
          {examConfigs.map((config: ExamConfig) => (
            <div key={config.id} className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-container)] rounded-lg">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: getExamColor(config.type) }} />
              <span className="text-xs font-semibold text-[var(--t1)]">{config.shortName}</span>
              <span className="text-xs text-[var(--t3)]">{config.name} ({config.weight}%)</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-5 overflow-hidden">
        <div className="p-3.5 border-b border-[var(--border)] flex gap-3 flex-wrap items-center">
          <div className="min-w-[150px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)] mb-1 block">Class</label>
            {classes.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">No classes</div>
            ) : (
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="input h-9 text-sm">
                <option value="">Select class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="min-w-[150px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)] mb-1 block">Subject</label>
            {subjects.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">No subjects</div>
            ) : (
              <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input h-9 text-sm">
                <option value="">Select subject</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="min-w-[150px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)] mb-1 block">Exam Type</label>
            <select value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)} className="input h-9 text-sm">
              {examConfigs.map((config: ExamConfig) => (
                <option key={config.id} value={config.type}>{config.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedClass && selectedSubject ? (
          scoresLoading ? (
            <div className="p-10 text-center">
              <TableSkeleton rows={8} />
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    {examConfigs.map(config => (
                      <th key={config.id} className="text-center">{config.shortName}</th>
                    ))}
                    <th className="text-center">Total</th>
                    <th className="text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => {
                    const scores = studentExamScores[student.id] || {}
                    const total = getStudentTotal(student.id)
                    const grade = total > 0 ? getUNEBGrade(total) : '-'
                    
                    return (
                      <tr key={student.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[var(--navy)] flex items-center justify-center text-xs font-bold text-white">
                              {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-[var(--t1)] text-sm">{student.first_name} {student.last_name}</div>
                              <div className="text-xs text-[var(--t3)]">{student.student_number || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-sm">{student.classes?.name || '-'}</td>
                        {examConfigs.map((config: ExamConfig) => {
                          const score = scores[config.type] ?? -1
                          return (
                            <td key={config.id} className="text-center">
                              <input
                                type="number"
                                min={0}
                                max={config.maxScore}
                                value={score >= 0 ? score : ''}
                                onChange={e => handleSaveScore(student.id, Number(e.target.value))}
                                disabled={termLocked}
                                placeholder="-"
                                className="w-12 text-center px-1.5 py-1 border border-[var(--border)] rounded-md text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ 
                                  background: score >= 0 ? (score >= 50 ? 'var(--green-soft)' : 'var(--red-soft)') : 'var(--surface-container)'
                                }}
                              />
                            </td>
                          )
                        })}
                        <td className="text-center font-mono font-bold text-sm">
                          {total > 0 ? total.toFixed(1) : '-'}
                        </td>
                        <td className="text-center">
                          <span className="px-2 py-1 rounded text-xs font-bold" style={{ 
                            background: total >= 80 ? 'var(--green-soft)' : total >= 50 ? 'var(--amber-soft)' : total > 0 ? 'var(--red-soft)' : 'var(--surface-container)',
                            color: total >= 80 ? 'var(--green)' : total >= 50 ? 'var(--amber)' : total > 0 ? 'var(--red)' : 'var(--t3)'
                          }}>
                            {grade}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="p-10 text-center text-[var(--t3)]">
            <MaterialIcon className="text-3xl mb-2">school</MaterialIcon>
            <div>Select class and subject to enter scores</div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between pb-4 border-none">
          <div>
            <div className="font-semibold text-[var(--on-surface)]">Exam Schedule</div>
            <div className="text-sm text-[var(--t3)]">Created exams</div>
          </div>
        </div>
        {examsLoading ? (
          <TableSkeleton rows={3} />
        ) : exams.length === 0 ? (
          <NoData title="No exams created yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {exams.map(exam => (
              <div key={exam.id} className="flex items-center gap-3 p-3 bg-[var(--surface-container)] rounded-lg">
                <div className="w-2 h-2 rounded-full" style={{ background: getExamColor(exam.exam_type) }} />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{exam.name}</div>
                  <div className="text-xs text-[var(--t3)]">{exam.classes?.name} • {exam.subjects?.name}</div>
                </div>
                <div className="text-xs text-[var(--t3)]">{exam.exam_date}</div>
                <button onClick={() => deleteExam(exam.id)} className="bg-transparent border-none p-1 cursor-pointer">
                  <MaterialIcon className="text-base text-[var(--t3)]">delete</MaterialIcon>
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAddExam && (
        <div className="modal-overlay" onClick={() => setShowAddExam(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="font-['Outfit'] text-base font-bold">Create Exam</div>
              <button onClick={() => setShowAddExam(false)} className="bg-transparent border-none p-1 cursor-pointer">
                <MaterialIcon className="text-lg text-[var(--t3)]">close</MaterialIcon>
              </button>
            </div>
            <div className="modal-body p-5">
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">Exam Name</label>
                <input type="text" value={newExam.name} onChange={e => setNewExam({...newExam, name: e.target.value})} placeholder="e.g., End of Term 1 2026" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">Exam Type</label>
                  <select value={newExam.exam_type} onChange={e => setNewExam({...newExam, exam_type: e.target.value})} className="input">
                    {examConfigs.map((config: ExamConfig) => (
                      <option key={config.id} value={config.type}>{config.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">Exam Date</label>
                  <input type="date" value={newExam.exam_date} onChange={e => setNewExam({...newExam, exam_date: e.target.value})} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">Class</label>
                  <select value={newExam.class_id} onChange={e => setNewExam({...newExam, class_id: e.target.value})} className="input">
                    <option value="">Select class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">Subject</label>
                  <select value={newExam.subject_id} onChange={e => setNewExam({...newExam, subject_id: e.target.value})} className="input">
                    <option value="">Select subject</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">Max Score</label>
                  <input type="number" value={newExam.max_score} onChange={e => setNewExam({...newExam, max_score: Number(e.target.value)})} className="input" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-1.5 block">Weight (%)</label>
                  <input type="number" value={newExam.weight} onChange={e => setNewExam({...newExam, weight: Number(e.target.value)})} className="input" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setShowAddExam(false)}>Cancel</Button>
              <Button onClick={handleAddExam}>Create Exam</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}