'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

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

  useEffect(() => {
    if (students.length > 0) fetchWarnings()
  }, [students, currentTerm, academicYear])

  const sendBulkSMS = async () => {
    if (filteredWarnings.length === 0) return
    
    toast.success(`Sending SMS to ${filteredWarnings.length} guardians...`)
    
    const message = `Dear Parent, Your child ${filteredWarnings[0].student_name} has been flagged for academic concerns. Please contact the school to discuss how we can support your child's progress. - SchoolX`
    
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

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-[#fef2f2] text-[#ba1a1a]'
      case 'medium': return 'bg-[#fff3e0] text-[#b86e00]'
      default: return 'bg-[#e3f2fd] text-[#002045]'
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Early Warnings</h1>
        <p className="text-[#5c6670] mt-1">Students who need attention</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#002045]">{stats.total}</div>
          <div className="text-sm text-[#5c6670] mt-1">Total Warnings</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#ba1a1a]">{stats.high}</div>
          <div className="text-sm text-[#5c6670] mt-1">High Priority</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#b86e00]">{stats.medium}</div>
          <div className="text-sm text-[#5c6670] mt-1">Medium</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#002045]">{stats.low}</div>
          <div className="text-sm text-[#5c6670] mt-1">Low</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="input sm:w-48">
          <option value="all">All Severities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={fetchWarnings} className="btn btn-secondary">
          <MaterialIcon icon="refresh" className="text-lg" />
          Refresh
        </button>
        {filteredWarnings.length > 0 && (
          <button onClick={() => sendBulkSMS()} className="btn btn-primary">
            <MaterialIcon icon="sms" className="text-lg" />
            SMS Guardians ({filteredWarnings.length})
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
              <div className="w-full h-4 bg-[#e8eaed] rounded mb-2" />
              <div className="w-3/4 h-3 bg-[#e8eaed] rounded" />
            </div>
          ))}
        </div>
      ) : filteredWarnings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#e8f5e9] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="check_circle" className="text-3xl text-[#006e1c]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No warnings</h3>
          <p className="text-[#5c6670]">All students are performing well</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f8fafb]">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Student</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Class</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Warning Type</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Details</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Severity</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarnings.map((warning, i) => (
                  <tr key={i} className="border-t border-[#e8eaed]">
                    <td className="p-4">
                      <div className="font-medium text-[#191c1d]">{warning.student_name}</div>
                      <div className="text-xs text-[#5c6670]">{warning.student_number}</div>
                    </td>
                    <td className="p-4 text-[#191c1d]">{warning.class_name}</td>
                    <td className="p-4 text-[#191c1d]">{warning.warning_type}</td>
                    <td className="p-4 text-[#5c6670]">{warning.details}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${getSeverityBadge(warning.severity)}`}>
                        {warning.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}