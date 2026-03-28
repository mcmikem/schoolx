'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface Student {
  id: string
  first_name: string
  last_name: string
  gender: string
  status: string
  class_id: string
  classes?: { id: string; name: string; level: string }
}

interface ClassData {
  id: string
  name: string
  level: string
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
  const [loading, setLoading] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [promotionHistory, setPromotionHistory] = useState<any[]>([])

  useEffect(() => {
    if (school?.id) fetchClasses()
  }, [school?.id])

  useEffect(() => {
    if (fromClass) fetchStudents()
  }, [fromClass])

  useEffect(() => {
    fetchPromotionHistory()
  }, [school?.id])

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', school?.id)
      .order('level', { ascending: true })
    setClasses(data || [])
  }

  const fetchStudents = async () => {
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
    setLoading(false)
  }

  const fetchPromotionHistory = async () => {
    const { data } = await supabase
      .from('student_promotions')
      .select('*, from_classes(name), to_classes(name), users(full_name)')
      .eq('school_id', school?.id)
      .order('promoted_at', { ascending: false })
      .limit(20)
    setPromotionHistory(data || [])
  }

  const toggleStudent = (id: string) => {
    const newSelected = new Set(selectedStudents)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedStudents(newSelected)
  }

  const toggleAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(students.map(s => s.id)))
    }
  }

  const promoteStudents = async () => {
    if (selectedStudents.size === 0) {
      toast.error('No students selected')
      return
    }

    if (!toClass) {
      toast.error('Please select promotion class')
      return
    }

    setPromoting(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      const selectedArray = Array.from(selectedStudents)

      const promotions = selectedArray.map(studentId => ({
        school_id: school?.id,
        student_id: studentId,
        from_class_id: fromClass,
        to_class_id: toClass,
        academic_year: academicYear,
        promoted_by: user?.id,
        promoted_at: new Date().toISOString()
      }))

      // Update student class_ids
      for (const studentId of selectedArray) {
        await supabase
          .from('students')
          .update({ class_id: toClass })
          .eq('id', studentId)
      }

      // Record promotions
      await supabase.from('student_promotions').insert(promotions)

      toast.success(`${selectedStudents.size} students promoted successfully`)
      fetchStudents()
      fetchPromotionHistory()
      setSelectedStudents(new Set())
    } catch (err: any) {
      toast.error(err.message || 'Promotion failed')
    } finally {
      setPromoting(false)
    }
  }

  const getNextClassOptions = () => {
    if (!fromClass) return []
    const currentClass = classes.find(c => c.id === fromClass)
    if (!currentClass) return []

    const levelNum = parseInt(currentClass.level.replace(/\D/g, ''))
    const stream = currentClass.name.includes('A') ? 'A' : currentClass.name.includes('B') ? 'B' : ''

    // Suggest next class
    const nextLevel = levelNum + 1
    
    // For P7 -> S1 transition
    if (currentClass.level === 'P.7' || currentClass.level.includes('P7')) {
      return classes.filter(c => c.level.includes('S.1') || c.level.includes('S1'))
    }
    
    // For S4 -> S5 transition
    if (currentClass.level === 'S.4' || currentClass.level.includes('S4')) {
      return classes.filter(c => c.level.includes('S.5') || c.level.includes('S5'))
    }

    // Normal promotion (P1->P2, S1->S2, etc.)
    return classes.filter(c => {
      const cLevel = parseInt(c.level.replace(/\D/g, ''))
      return cLevel === nextLevel
    })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Student Promotion</h1>
        <p className="text-[#5c6670] mt-1">Promote students to next class (P7→S1, S4→S5, etc.)</p>
      </div>

      {/* Promotion Controls */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="card-title">Select Students to Promote</div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">From Class</label>
              <select value={fromClass} onChange={(e) => setFromClass(e.target.value)} className="input">
                <option value="">Select class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To Class</label>
              <select value={toClass} onChange={(e) => setToClass(e.target.value)} className="input">
                <option value="">Select target class...</option>
                {getNextClassOptions().map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">&nbsp;</label>
              <button 
                onClick={promoteStudents}
                disabled={promoting || selectedStudents.size === 0 || !toClass}
                className="btn btn-primary w-full"
              >
                <MaterialIcon icon="upgrade" style={{ fontSize: 18 }} />
                {promoting ? 'Promoting...' : `Promote ${selectedStudents.size} Students`}
              </button>
            </div>
          </div>

          {/* Student List */}
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
                <span className="text-sm text-[#5c6670]">{selectedStudents.size} selected</span>
              </div>

              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Name</th>
                      <th>Gender</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, idx) => (
                      <tr key={student.id}>
                        <td>
                          <input 
                            type="checkbox" 
                            checked={selectedStudents.has(student.id)}
                            onChange={() => toggleStudent(student.id)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td>{student.first_name} {student.last_name}</td>
                        <td>{student.gender}</td>
                        <td>
                          <span className={`badge ${student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {student.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && !loading && (
                      <tr><td colSpan={4} className="text-center py-8 text-[#5c6670]">No active students in this class</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Promotion History */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Promotion History</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>From</th>
                <th>To</th>
                <th>Promoted By</th>
              </tr>
            </thead>
            <tbody>
              {promotionHistory.map((p, idx) => (
                <tr key={idx}>
                  <td>{new Date(p.promoted_at).toLocaleDateString()}</td>
                  <td>{p.student_id?.substring(0, 8)}...</td>
                  <td>{p.from_classes?.name}</td>
                  <td>{p.to_classes?.name}</td>
                  <td>{p.users?.full_name || 'System'}</td>
                </tr>
              ))}
              {promotionHistory.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-[#5c6670]">No promotion history</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
