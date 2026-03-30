'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses, useSubjects, useExamScores, useExams } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { EXAM_TYPES, SECONDARY_EXAM_TYPES, PRIMARY_EXAM_TYPES, calculateWeightedGrade, getExamTypeLabel, getExamColor, ExamConfig } from '@/lib/exams'
import { getUNEBGrade, getUNEBDivision } from '@/lib/grading'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

export default function ExamsPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  
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

  const isSecondary = true // Default to secondary exam types, can be configured per school

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
      <div className="page-header">
        <div>
          <div className="ph-title">{isSecondary ? 'Exam Management' : 'Exams & Grades'}</div>
          <div className="ph-sub">
            {academicYear} Term {currentTerm} • {isSecondary ? 'BOT, Mid Term, EOT, Saturday Tests' : 'CA, Mid Term, EOT'}
          </div>
        </div>
        <div className="ph-actions">
          <button onClick={() => setShowAddExam(true)} className="btn btn-primary">
            <MaterialIcon icon="add" style={{ fontSize: '16px' }} />
            Create Exam
          </button>
        </div>
      </div>

      {/* Exam Type Legend */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 12 }}>Grade Weighting</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {examConfigs.map((config: ExamConfig) => (
            <div key={config.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg)', borderRadius: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: getExamColor(config.type) }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>{config.shortName}</span>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>{config.name} ({config.weight}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: 150 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Class</label>
            {classes.length === 0 ? (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>No classes</div>
            ) : (
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="input" style={{ height: 36 }}>
                <option value="">Select class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ minWidth: 150 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Subject</label>
            {subjects.length === 0 ? (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>No subjects</div>
            ) : (
              <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input" style={{ height: 36 }}>
                <option value="">Select subject</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ minWidth: 150 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Exam Type</label>
            <select value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)} className="input" style={{ height: 36 }}>
              {examConfigs.map((config: ExamConfig) => (
                <option key={config.id} value={config.type}>{config.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Scores Table */}
        {selectedClass && selectedSubject ? (
          scoresLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="skeleton" style={{ height: 200 }}></div>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    {examConfigs.map(config => (
                      <th key={config.id} style={{ textAlign: 'center' }}>{config.shortName}</th>
                    ))}
                    <th style={{ textAlign: 'center' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Grade</th>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                              {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 13 }}>{student.first_name} {student.last_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{student.student_number || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>{student.classes?.name || '-'}</td>
                        {examConfigs.map((config: ExamConfig) => {
                          const score = scores[config.type] ?? -1
                          return (
                            <td key={config.id} style={{ textAlign: 'center' }}>
                              <input
                                type="number"
                                min={0}
                                max={config.maxScore}
                                value={score >= 0 ? score : ''}
                                onChange={e => handleSaveScore(student.id, Number(e.target.value))}
                                placeholder="-"
                                style={{ 
                                  width: 50, 
                                  textAlign: 'center', 
                                  padding: '4px 6px',
                                  border: '1px solid var(--border)', 
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontFamily: 'DM Mono',
                                  background: score >= 0 ? (score >= 50 ? 'var(--green-soft)' : 'var(--red-soft)') : 'var(--bg)'
                                }}
                              />
                            </td>
                          )
                        })}
                        <td style={{ textAlign: 'center', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 14 }}>
                          {total > 0 ? total.toFixed(1) : '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ 
                            padding: '3px 8px', 
                            borderRadius: 4, 
                            fontSize: 12, 
                            fontWeight: 700,
                            background: total >= 80 ? 'var(--green-soft)' : total >= 50 ? 'var(--amber-soft)' : total > 0 ? 'var(--red-soft)' : 'var(--bg)',
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
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)' }}>
            <MaterialIcon style={{ fontSize: 32, marginBottom: 8 }}>school</MaterialIcon>
            <div>Select class and subject to enter scores</div>
          </div>
        )}
      </div>

      {/* Past Exams */}
      <div className="card" style={{ padding: 16 }}>
        <div className="card-header" style={{ padding: '0 0 16px 0', border: 'none' }}>
          <div>
            <div className="card-title">Exam Schedule</div>
            <div className="card-sub">Created exams</div>
          </div>
        </div>
        {examsLoading ? (
          <div className="skeleton" style={{ height: 100 }}></div>
        ) : exams.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            No exams created yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exams.map(exam => (
              <div key={exam.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: getExamColor(exam.exam_type) }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{exam.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{exam.classes?.name} • {exam.subjects?.name}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{exam.exam_date}</div>
                <button onClick={() => deleteExam(exam.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <MaterialIcon style={{ fontSize: 16, color: 'var(--t3)' }}>delete</MaterialIcon>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Exam Modal */}
      {showAddExam && (
        <div className="modal-overlay" onClick={() => setShowAddExam(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700 }}>Create Exam</div>
              <button onClick={() => setShowAddExam(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>close</MaterialIcon>
              </button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Exam Name</label>
                <input type="text" value={newExam.name} onChange={e => setNewExam({...newExam, name: e.target.value})} placeholder="e.g., End of Term 1 2026" className="input" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Exam Type</label>
                  <select value={newExam.exam_type} onChange={e => setNewExam({...newExam, exam_type: e.target.value})} className="input">
                    {examConfigs.map((config: ExamConfig) => (
                      <option key={config.id} value={config.type}>{config.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Exam Date</label>
                  <input type="date" value={newExam.exam_date} onChange={e => setNewExam({...newExam, exam_date: e.target.value})} className="input" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Class</label>
                  <select value={newExam.class_id} onChange={e => setNewExam({...newExam, class_id: e.target.value})} className="input">
                    <option value="">Select class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Subject</label>
                  <select value={newExam.subject_id} onChange={e => setNewExam({...newExam, subject_id: e.target.value})} className="input">
                    <option value="">Select subject</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Max Score</label>
                  <input type="number" value={newExam.max_score} onChange={e => setNewExam({...newExam, max_score: Number(e.target.value)})} className="input" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Weight (%)</label>
                  <input type="number" value={newExam.weight} onChange={e => setNewExam({...newExam, weight: Number(e.target.value)})} className="input" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddExam(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleAddExam} className="btn btn-primary">Create Exam</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
