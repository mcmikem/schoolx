'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader, CardBody, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'

interface Student {
  id: string
  first_name: string
  last_name: string
  gender: string
  status: string
  class_id: string
  repeating?: boolean
  classes?: { id: string; name: string; level: string }
}

interface ClassData {
  id: string
  name: string
  level: string
}

type StudentAction = 'promote' | 'repeat' | 'demote' | 'skip'
interface StudentActionMap {
  [studentId: string]: { action: StudentAction; targetClassId?: string; reason?: string }
}

export default function StudentPromotionPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  
  const [classes, setClasses] = useState<ClassData[]>([])
  const [fromClass, setFromClass] = useState('')
  const [toClass, setToClass] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [studentActions, setStudentActions] = useState<StudentActionMap>({})
  const [loading, setLoading] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [promotionHistory, setPromotionHistory] = useState<any[]>([])
  const [showDemoteModal, setShowDemoteModal] = useState<string | null>(null)
  const [demoteReason, setDemoteReason] = useState('')
  const [demoteClass, setDemoteClass] = useState('')

  const fetchClasses = useCallback(async () => {
    if (!school?.id) return
    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', school?.id)
      .order('level', { ascending: true })
    setClasses(data || [])
  }, [school?.id])

  const fetchStudents = useCallback(async () => {
    if (!school?.id || !fromClass) return
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('*, classes(*)')
      .eq('school_id', school?.id)
      .eq('class_id', fromClass)
      .eq('status', 'active')
      .order('first_name')
    setStudents(data || [])
    setSelectedStudents(new Set(data?.map(s => s.id) || []))
    const defaultActions: StudentActionMap = {}
    data?.forEach(s => {
      defaultActions[s.id] = { action: 'promote' }
    })
    setStudentActions(defaultActions)
    setLoading(false)
  }, [school?.id, fromClass])

  const fetchPromotionHistory = useCallback(async () => {
    if (!school?.id) return
    const { data } = await supabase
      .from('student_promotions')
      .select('*, from_classes(name), to_classes(name), users(full_name)')
      .eq('school_id', school?.id)
      .order('promoted_at', { ascending: false })
      .limit(20)
    setPromotionHistory(data || [])
  }, [school?.id])

  useEffect(() => {
    if (school?.id) fetchClasses()
  }, [school?.id, fetchClasses])

  useEffect(() => {
    if (fromClass) fetchStudents()
  }, [fromClass, fetchStudents])

  useEffect(() => {
    if (school?.id) fetchPromotionHistory()
  }, [school?.id, fetchPromotionHistory])

  const toggleStudent = (id: string) => {
    const newSelected = new Set(selectedStudents)
    if (newSelected.has(id)) {
      newSelected.delete(id)
      setStudentActions(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } else {
      newSelected.add(id)
      setStudentActions(prev => ({ ...prev, [id]: { action: 'promote' } }))
    }
    setSelectedStudents(newSelected)
  }

  const toggleAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set())
      setStudentActions({})
    } else {
      const newSet = new Set(students.map(s => s.id))
      const newActions: StudentActionMap = {}
      students.forEach(s => {
        newActions[s.id] = { action: 'promote' }
      })
      setSelectedStudents(newSet)
      setStudentActions(newActions)
    }
  }

  const setAction = (studentId: string, action: StudentAction) => {
    if (action === 'demote') {
      setShowDemoteModal(studentId)
      return
    }
    setStudentActions(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], action, targetClassId: undefined, reason: undefined }
    }))
  }

  const confirmDemote = () => {
    if (!showDemoteModal || !demoteClass) {
      toast.error('Please select a class to demote to')
      return
    }
    setStudentActions(prev => ({
      ...prev,
      [showDemoteModal]: { action: 'demote', targetClassId: demoteClass, reason: demoteReason }
    }))
    setShowDemoteModal(null)
    setDemoteReason('')
    setDemoteClass('')
  }

  const processPromotions = async () => {
    const selectedArray = Array.from(selectedStudents)
    if (selectedArray.length === 0) {
      toast.error('No students selected')
      return
    }

    const promoteStudents = selectedArray.filter(id => studentActions[id]?.action === 'promote')
    if (promoteStudents.length > 0 && !toClass) {
      toast.error('Please select a target class for promoted students')
      return
    }

    setPromoting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let promoted = 0, repeating = 0, transferred = 0, demoted = 0

      for (const studentId of selectedArray) {
        const actionData = studentActions[studentId]
        if (!actionData) continue

        const action = actionData.action

        if (action === 'promote') {
          await supabase.from('students').update({ class_id: toClass, repeating: false }).eq('id', studentId)
          await supabase.from('student_promotions').insert({
            school_id: school?.id,
            student_id: studentId,
            from_class_id: fromClass,
            to_class_id: toClass,
            academic_year: academicYear,
            promotion_type: 'promoted',
            promoted_by: user?.id,
            promoted_at: new Date().toISOString()
          })
          promoted++
        } else if (action === 'repeat') {
          await supabase.from('students').update({ repeating: true }).eq('id', studentId)
          await supabase.from('student_promotions').insert({
            school_id: school?.id,
            student_id: studentId,
            from_class_id: fromClass,
            to_class_id: fromClass,
            academic_year: academicYear,
            promotion_type: 'repeating',
            notes: 'Repeating class',
            promoted_by: user?.id,
            promoted_at: new Date().toISOString()
          })
          repeating++
        } else if (action === 'demote') {
          const targetClass = actionData.targetClassId || fromClass
          await supabase.from('students').update({ class_id: targetClass, repeating: false }).eq('id', studentId)
          await supabase.from('student_promotions').insert({
            school_id: school?.id,
            student_id: studentId,
            from_class_id: fromClass,
            to_class_id: targetClass,
            academic_year: academicYear,
            promotion_type: 'demoted',
            notes: actionData.reason || 'Demoted',
            promoted_by: user?.id,
            promoted_at: new Date().toISOString()
          })
          demoted++
        }
      }

      const summaryParts = []
      if (promoted > 0) summaryParts.push(`${promoted} promoted`)
      if (repeating > 0) summaryParts.push(`${repeating} repeating`)
      if (demoted > 0) summaryParts.push(`${demoted} demoted`)
      
      toast.success(summaryParts.join(', ') + ' successfully')
      fetchStudents()
      fetchPromotionHistory()
      setSelectedStudents(new Set())
      setStudentActions({})
    } catch (err: any) {
      toast.error(err.message || 'Processing failed')
    } finally {
      setPromoting(false)
    }
  }

  const getNextClassOptions = () => {
    if (!fromClass) return []
    const currentClass = classes.find(c => c.id === fromClass)
    if (!currentClass) return []

    const levelNum = parseInt(currentClass.level.replace(/\D/g, ''))
    const nextLevel = levelNum + 1

    if (currentClass.level === 'P.7' || currentClass.level.includes('P7')) {
      return classes.filter(c => c.level.includes('S.1') || c.level.includes('S1'))
    }
    if (currentClass.level === 'S.4' || currentClass.level.includes('S4')) {
      return classes.filter(c => c.level.includes('S.5') || c.level.includes('S5'))
    }

    return classes.filter(c => {
      const cLevel = parseInt(c.level.replace(/\D/g, ''))
      return cLevel === nextLevel
    })
  }

  const getPrevClassOptions = () => {
    if (!fromClass) return []
    const currentClass = classes.find(c => c.id === fromClass)
    if (!currentClass) return []
    const levelNum = parseInt(currentClass.level.replace(/\D/g, ''))
    if (levelNum <= 1) return []
    const prevLevel = levelNum - 1
    return classes.filter(c => {
      const cLevel = parseInt(c.level.replace(/\D/g, ''))
      return cLevel === prevLevel
    })
  }

  const actionCounts = {
    promote: Object.values(studentActions).filter(a => a.action === 'promote').length,
    repeat: Object.values(studentActions).filter(a => a.action === 'repeat').length,
    demote: Object.values(studentActions).filter(a => a.action === 'demote').length,
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader 
        title="Student Promotion" 
        subtitle="Promote, repeat, or demote students per class"
      />

      {selectedStudents.size > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {actionCounts.promote > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              {actionCounts.promote} to promote
            </span>
          )}
          {actionCounts.repeat > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
              {actionCounts.repeat} repeating
            </span>
          )}
          {actionCounts.demote > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
              {actionCounts.demote} to demote
            </span>
          )}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Students</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--on-surface)]">From Class</label>
              {classes.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No classes available</div>
              ) : (
                <select 
                  value={fromClass} 
                  onChange={(e) => setFromClass(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                >
                  <option value="">Select class...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--on-surface)]">Promote To Class</label>
              {classes.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No classes available</div>
              ) : (
                <select 
                  value={toClass} 
                  onChange={(e) => setToClass(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                >
                  <option value="">Select target class...</option>
                  {getNextClassOptions().map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--on-surface)]">&nbsp;</label>
              <Button 
                onClick={processPromotions}
                disabled={promoting || selectedStudents.size === 0}
                loading={promoting}
                className="w-full"
              >
                <MaterialIcon icon="upgrade" style={{ fontSize: 18 }} />
                {promoting ? 'Processing...' : `Process ${selectedStudents.size} Students`}
              </Button>
            </div>
          </div>

          {fromClass && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedStudents.size === students.length && students.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Select All ({students.length} students)</span>
                </label>
                <span className="text-sm text-[var(--t3)]">{selectedStudents.size} selected</span>
              </div>

              {loading ? (
                <TableSkeleton rows={5} />
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Name</th>
                        <th>Gender</th>
                        <th>Current Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => {
                        const action = studentActions[student.id]?.action || 'promote'
                        return (
                          <tr key={student.id}>
                            <td>
                              <input 
                                type="checkbox" 
                                checked={selectedStudents.has(student.id)}
                                onChange={() => toggleStudent(student.id)}
                                className="w-4 h-4"
                              />
                            </td>
                            <td className="font-medium text-sm">{student.first_name} {student.last_name}</td>
                            <td className="text-sm">{student.gender}</td>
                            <td>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${student.repeating ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                {student.repeating ? 'Repeating' : 'Active'}
                              </span>
                            </td>
                            <td>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setAction(student.id, 'promote')}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                    action === 'promote'
                                      ? 'bg-green-100 border-green-300 text-green-800'
                                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                  }`}
                                >
                                  Promote
                                </button>
                                <button
                                  onClick={() => setAction(student.id, 'repeat')}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                    action === 'repeat'
                                      ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                  }`}
                                >
                                  Repeat
                                </button>
                                <button
                                  onClick={() => setAction(student.id, 'demote')}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                    action === 'demote'
                                      ? 'bg-red-100 border-red-300 text-red-800'
                                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                  }`}
                                >
                                  Demote
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {students.length === 0 && (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState 
                              icon="group" 
                              title="No active students in this class"
                              description="Select a class with active students to proceed"
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promotion History</CardTitle>
        </CardHeader>
        <CardBody>
          {promotionHistory.length === 0 ? (
            <EmptyState 
              icon="history" 
              title="No promotion history"
              description="Promotions will appear here once processed"
            />
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Type</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {promotionHistory.map((p, idx) => (
                    <tr key={idx}>
                      <td className="text-sm">{new Date(p.promoted_at).toLocaleDateString()}</td>
                      <td className="text-sm">{p.student_id?.substring(0, 8)}...</td>
                      <td className="text-sm">{p.from_classes?.name}</td>
                      <td className="text-sm">{p.to_classes?.name}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          p.promotion_type === 'repeating' ? 'bg-yellow-100 text-yellow-800'
                          : p.promotion_type === 'demoted' ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                        }`}>
                          {p.promotion_type || 'promoted'}
                        </span>
                      </td>
                      <td className="text-sm">{p.users?.full_name || 'System'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {showDemoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDemoteModal(null)}>
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="font-semibold text-[var(--t1)]">Demote Student</div>
              <button onClick={() => setShowDemoteModal(null)} className="p-1 hover:bg-[var(--surface-container)] rounded-lg">
                <MaterialIcon className="text-xl text-[var(--t3)]">close</MaterialIcon>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">Demote to Class</label>
                <select 
                  value={demoteClass} 
                  onChange={(e) => setDemoteClass(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                >
                  <option value="">Select class...</option>
                  {getPrevClassOptions().map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2 text-[var(--on-surface)]">Reason</label>
                <textarea 
                  value={demoteReason} 
                  onChange={(e) => setDemoteReason(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] resize-none"
                  rows={3} 
                  placeholder="Reason for demotion..."
                />
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setShowDemoteModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={confirmDemote} disabled={!demoteClass} className="flex-1">Confirm Demote</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}