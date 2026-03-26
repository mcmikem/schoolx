'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

interface Warning {
  student_id: string
  student_name: string
  student_number: string
  class_name: string
  warning_type: string
  details: string
  severity: 'low' | 'medium' | 'high'
}

interface WarningThresholds {
  attendance: number
  grade: number
  fee: number
}

export default function EarlyWarningsPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [thresholds, setThresholds] = useState<WarningThresholds>({ attendance: 80, grade: 50, fee: 50000 })

  useEffect(() => {
    if (school?.id) fetchThresholds()
  }, [school?.id])

  const fetchThresholds = async () => {
    if (!school?.id) return
    try {
      const { data } = await supabase
        .from('school_settings')
        .select('key, value')
        .eq('school_id', school.id)
        .in('key', ['attendance_threshold', 'grade_threshold', 'fee_threshold'])
      
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((s: {key: string, value: string}) => { map[s.key] = s.value })
        setThresholds({
          attendance: parseInt(map.attendance_threshold) || 80,
          grade: parseInt(map.grade_threshold) || 50,
          fee: parseInt(map.fee_threshold) || 50000
        })
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const fetchWarnings = async () => {
    if (!school?.id) return
    
    setLoading(true)
    const allWarnings: Warning[] = []

    for (const student of students) {
      const { data: grades } = await supabase
        .from('grades')
        .select('*, subjects(name)')
        .eq('student_id', student.id)
        .eq('term', currentTerm)
        .eq('academic_year', academicYear)

      if (grades && grades.length > 0) {
        // Group by subject and calculate averages
        const subjectScores: Record<string, number[]> = {}
        grades.forEach(g => {
          const subject = g.subjects?.name || 'Unknown'
          if (!subjectScores[subject]) subjectScores[subject] = []
          subjectScores[subject].push(Number(g.score))
        })

        let weakSubjects = 0
        Object.entries(subjectScores).forEach(([subject, scores]) => {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length
          if (avg < thresholds.grade) {
            weakSubjects++
          }
        })

        if (weakSubjects >= 2) {
          allWarnings.push({
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`,
            student_number: student.student_number || '',
            class_name: student.classes?.name || '',
            warning_type: 'Academic Performance',
            details: `Below 50% in ${weakSubjects} subjects`,
            severity: weakSubjects >= 3 ? 'high' : 'medium'
          })
        }
      }

      // Check attendance - find students with < 80% attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', student.id)

      if (attendance && attendance.length > 0) {
        const present = attendance.filter(a => a.status === 'present').length
        const rate = (present / attendance.length) * 100

        if (rate < thresholds.attendance) {
          allWarnings.push({
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`,
            student_number: student.student_number || '',
            class_name: student.classes?.name || '',
            warning_type: 'Attendance',
            details: `Attendance rate: ${Math.round(rate)}%`,
            severity: rate < 60 ? 'high' : 'medium'
          })
        }
      }

      // Check fees - find students with high balances
      const { data: payments } = await supabase
        .from('fee_payments')
        .select('amount_paid')
        .eq('student_id', student.id)

      if (payments) {
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0)
        if (totalPaid < thresholds.fee) {
          allWarnings.push({
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`,
            student_number: student.student_number || '',
            class_name: student.classes?.name || '',
            warning_type: 'Fees',
            details: `Low fee payments: UGX ${totalPaid.toLocaleString()}`,
            severity: totalPaid === 0 ? 'high' : 'medium'
          })
        }
      }
    }

    setWarnings(allWarnings)
    setLoading(false)
  }

  const sendBulkSMS = async () => {
    if (filteredWarnings.length === 0) return
    
    toast.success(`Sending SMS to ${filteredWarnings.length} guardians...`)
    
    const message = `Dear Parent, Your child ${filteredWarnings[0].student_name} has been flagged for academic concerns. Please contact the school to discuss how we can support your child's progress. - OmutoSMS`
    
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select('id, parent_phone, first_name')
        .in('id', filteredWarnings.map(w => w.student_id))
      
      const phones = studentData?.map(s => s.parent_phone).filter(Boolean) || []
      
      if (phones.length === 0) {
        toast.error('No parent phone numbers found')
        return
      }

      const response = await fetch('/api/sms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones, message, schoolId: school?.id })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`SMS sent to ${result.data?.totalSent || phones.length} parents`)
      } else {
        toast.error('Failed to send SMS')
      }
    } catch (err) {
      toast.error('SMS error')
    }
  }

  const filteredWarnings = warnings.filter(w => {
    if (filterSeverity === 'all') return true
    return w.severity === filterSeverity
  })

  const stats = useMemo(() => ({
    total: warnings.length,
    high: warnings.filter(w => w.severity === 'high').length,
    medium: warnings.filter(w => w.severity === 'medium').length,
    low: warnings.filter(w => w.severity === 'low').length,
  }), [warnings])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Early Warnings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Students who need attention</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Warnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-red-600">{stats.high}</div>
          <div className="stat-label">High Priority</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-yellow-600">{stats.medium}</div>
          <div className="stat-label">Medium</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-blue-600">{stats.low}</div>
          <div className="stat-label">Low</div>
        </div>
      </div>

      {/* Filter and Refresh */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="input sm:w-48">
          <option value="all">All Severities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={fetchWarnings} className="btn btn-secondary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
        {filteredWarnings.length > 0 && (
          <button onClick={() => sendBulkSMS()} className="btn btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            SMS Guardians ({filteredWarnings.length})
          </button>
        )}
      </div>

      {/* Warnings List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton w-full h-4 mb-2" />
              <div className="skeleton w-3/4 h-3" />
            </div>
          ))}
        </div>
      ) : filteredWarnings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No warnings</h3>
          <p className="text-gray-500 dark:text-gray-400">All students are performing well</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Warning Type</th>
                <th>Details</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {filteredWarnings.map((warning, i) => (
                <tr key={i}>
                  <td>
                    <div className="font-medium text-gray-900 dark:text-white">{warning.student_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{warning.student_number}</div>
                  </td>
                  <td>{warning.class_name}</td>
                  <td>{warning.warning_type}</td>
                  <td className="text-gray-600 dark:text-gray-400">{warning.details}</td>
                  <td>
                    <span className={`badge ${
                      warning.severity === 'high' ? 'badge-danger' :
                      warning.severity === 'medium' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {warning.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
