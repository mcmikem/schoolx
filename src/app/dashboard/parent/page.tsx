'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { supabase } from '@/lib/supabase'

export default function ParentPortal() {
  const { user, school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const [loading, setLoading] = useState(true)
  const [linkedStudent, setLinkedStudent] = useState<any>(null)
  const [attendance, setAttendance] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [feeStructure, setFeeStructure] = useState<any[]>([])

  useEffect(() => {
    async function fetchData() {
      if (!user?.id || !school?.id) return

      setLoading(true)
      try {
        const { data: parentStudent } = await supabase
          .from('parent_students')
          .select('*, students(*, classes(*))')
          .eq('parent_id', user.id)
          .single()

        if (parentStudent?.students) {
          setLinkedStudent(parentStudent.students)

          const [attRes, gradesRes, payRes, fsRes] = await Promise.all([
            supabase.from('attendance').select('*').eq('student_id', parentStudent.students.id).order('date', { ascending: false }).limit(10),
            supabase.from('grades').select('*, subjects(name)').eq('student_id', parentStudent.students.id).eq('term', currentTerm).eq('academic_year', academicYear),
            supabase.from('fee_payments').select('*').eq('student_id', parentStudent.students.id).order('payment_date', { ascending: false }),
            supabase.from('fee_structure').select('*').eq('school_id', school.id).eq('academic_year', academicYear)
          ])

          setAttendance(attRes.data || [])
          setGrades(gradesRes.data || [])
          setPayments(payRes.data || [])
          setFeeStructure(fsRes.data || [])
        }
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user?.id, school?.id, currentTerm, academicYear])

  const feeStats = useMemo(() => {
    const totalExpected = feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0)
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
    return {
      totalFee: totalExpected,
      totalPaid,
      balance: Math.max(0, totalExpected - totalPaid)
    }
  }, [feeStructure, payments])

  const attendanceRate = useMemo(() => {
    if (attendance.length === 0) return 0
    const present = attendance.filter(a => a.status === 'present').length
    return Math.round((present / attendance.length) * 100)
  }, [attendance])

  const avgGrade = useMemo(() => {
    if (grades.length === 0) return 0
    const total = grades.reduce((sum, g) => sum + Number(g.score), 0)
    return Math.round(total / grades.length)
  }, [grades])

  const getGradeColor = (grade: string) => {
    if (grade?.startsWith('D')) return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
    if (grade?.startsWith('C')) return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
    if (grade?.startsWith('P')) return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
    return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
  }

  const getGradeLetter = (score: number) => {
    if (score >= 80) return 'D1'
    if (score >= 70) return 'D2'
    if (score >= 65) return 'C3'
    if (score >= 60) return 'C4'
    if (score >= 55) return 'C5'
    if (score >= 50) return 'C6'
    if (score >= 45) return 'P7'
    if (score >= 40) return 'P8'
    return 'F9'
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!linkedStudent) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parent Portal</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">View your child's progress</p>
        </div>
        <div className="card text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            No student linked to your account. Please contact the school.
          </div>
        </div>
      </div>
    )
  }

  const studentName = `${linkedStudent.first_name} ${linkedStudent.last_name}`
  const initials = `${linkedStudent.first_name?.[0] || ''}${linkedStudent.last_name?.[0] || ''}`.toUpperCase()

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parent Portal</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">View your child's progress</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <span className="text-xl font-bold text-blue-600 dark:text-blue-300">{initials}</span>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{studentName}</div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Class: {linkedStudent.classes?.name || 'N/A'}</span>
              <span>•</span>
              <span>{linkedStudent.student_number || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{attendanceRate}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Attendance</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{avgGrade}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Average</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{(feeStats.balance / 1000).toFixed(0)}K</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Balance</div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Fee Status</h2>
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Paid: UGX {feeStats.totalPaid.toLocaleString()}</span>
              <span>Total: UGX {feeStats.totalFee.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all" 
                style={{ width: `${feeStats.totalFee > 0 ? (feeStats.totalPaid / feeStats.totalFee) * 100 : 0}%` }} 
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Balance</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">UGX {feeStats.balance.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Attendance</h2>
          {attendance.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No attendance records</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {attendance.slice(0, 10).map((day: any, i: number) => (
                <div key={i} className="flex-shrink-0 text-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    day.status === 'present' ? 'bg-green-100 dark:bg-green-900/30' : 
                    day.status === 'absent' ? 'bg-red-100 dark:bg-red-900/30' : 
                    'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    {day.status === 'present' ? (
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : day.status === 'absent' ? (
                      <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(day.date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Grades</h2>
          {grades.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No grades published yet</div>
          ) : (
            <div className="space-y-3">
              {grades.map((grade: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="font-medium text-gray-900 dark:text-white">{grade.subjects?.name || 'Unknown'}</div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Score: {Math.round(grade.score)}</span>
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${getGradeColor(getGradeLetter(grade.score))}`}>
                      {getGradeLetter(grade.score)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">School Info</h2>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div><strong>School:</strong> {school?.name || 'N/A'}</div>
            <div><strong>Term:</strong> Term {currentTerm} {academicYear}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
