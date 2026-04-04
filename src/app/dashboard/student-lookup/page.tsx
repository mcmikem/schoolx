'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useFeePayments, useFeeStructure } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { DEMO_ATTENDANCE } from '@/lib/demo-data'
import { SendSMSModal } from '@/components/SendSMSModal'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

interface AttendanceRecord {
  student_id: string
  status: string
  date: string
}

export default function StudentLookupPage() {
  const { school, isDemo } = useAuth()
  const { students, loading: studentsLoading } = useStudents(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)
  const [searchTerm, setSearchTerm] = useState('')
  const [todayAttendance, setTodayAttendance] = useState<Record<string, string>>({})
  const [smsTarget, setSmsTarget] = useState<{ id: string; first_name: string; last_name: string; parent_phone?: string } | null>(null)

  const today = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    async function fetchAttendance() {
      if (!school?.id) return
      if (isDemo) {
        const map: Record<string, string> = {}
        DEMO_ATTENDANCE.forEach((record) => {
          map[record.student_id] = record.status
        })
        setTodayAttendance(map)
        return
      }
      const { data } = await supabase
        .from('attendance')
        .select('student_id, status, date')
        .eq('school_id', school.id)
        .eq('date', today)

      const map: Record<string, string> = {}
      data?.forEach((r: AttendanceRecord) => {
        map[r.student_id] = r.status
      })
      setTodayAttendance(map)
    }
    fetchAttendance()
  }, [school?.id, today, isDemo])

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

  const totalFees = useMemo(() => {
    return feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0)
  }, [feeStructure])

  const results = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase()
    return students
      .filter(s => {
        const name = `${s.first_name} ${s.last_name}`.toLowerCase()
        const number = (s.student_number || '').toLowerCase()
        const parent = (s.parent_name || '').toLowerCase()
        return name.includes(term) || number.includes(term) || parent.includes(term)
      })
      .slice(0, 20)
  }, [students, searchTerm])

  const getStudentBalance = (studentId: string) => {
    const paid = payments
      .filter(p => p.student_id === studentId)
      .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
    return { total: totalFees, paid, balance: Math.max(0, totalFees - paid) }
  }

  const getAttendanceStatus = (studentId: string) => {
    return todayAttendance[studentId] || null
  }

  const loading = studentsLoading

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Student Lookup"
        subtitle="Quick access to student information"
      />

      <Card className="p-6 mb-6">
        <div className="relative">
          <MaterialIcon icon="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--t3)]" />
          <input
            aria-label="Student search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--surface-container)] border border-[var(--border)] rounded-xl py-4 pl-12 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
            placeholder="Search by name, student number, or parent name..."
            autoFocus
          />
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6">
              <div className="w-1/2 h-5 bg-[var(--surface-container)] rounded mb-3" />
              <div className="w-1/3 h-4 bg-[var(--surface-container)] rounded" />
            </Card>
          ))}
        </div>
      ) : searchTerm.trim() && results.length === 0 ? (
        <Card className="p-12 text-center">
          <MaterialIcon icon="search_off" className="text-4xl text-[var(--t3)] mb-3" />
          <h3 className="text-lg font-semibold text-[var(--t1)] mb-1">No students found</h3>
          <p className="text-[var(--t3)]">Try a different search term</p>
        </Card>
      ) : !searchTerm.trim() ? (
        <Card className="p-12 text-center">
          <MaterialIcon icon="person_search" className="text-4xl text-[var(--t3)] mb-3" />
          <h3 className="text-lg font-semibold text-[var(--t1)] mb-1">Look Up a Student</h3>
          <p className="text-[var(--t3)]">Search to see student details, parent info, fees, and attendance</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {results.map((student) => {
            const { total, paid, balance } = getStudentBalance(student.id)
            const attendance = getAttendanceStatus(student.id)

            return (
              <Card key={student.id} className="p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[var(--primary)] rounded-full flex items-center justify-center text-white font-bold">
                      {`${student.first_name[0] || ''}${student.last_name[0] || ''}`.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--t1)] text-lg">{student.first_name} {student.last_name}</h3>
                      <p className="text-sm text-[var(--t3)]">
                        {student.student_number} &middot; {student.classes?.name || 'No class'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    student.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {student.status}
                  </span>
                </div>

                <div className="flex gap-2 mb-4">
                  <Button variant="secondary" size="sm" onClick={() => setSmsTarget(student)}>
                    <MaterialIcon icon="sms" className="text-sm" />
                    SMS Parent
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[var(--surface-container)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon className="text-lg text-[var(--t3)]">person</MaterialIcon>
                      <span className="text-xs text-[var(--t3)] uppercase tracking-wider font-medium">Parent</span>
                    </div>
                    <div className="font-medium text-[var(--t1)]">{student.parent_name || 'Not provided'}</div>
                  </div>

                  <div className="bg-[var(--surface-container)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon className="text-lg text-[var(--t3)]">phone</MaterialIcon>
                      <span className="text-xs text-[var(--t3)] uppercase tracking-wider font-medium">Phone</span>
                    </div>
                    <div className="font-medium text-[var(--t1)]">{student.parent_phone || 'Not provided'}</div>
                    {student.parent_phone2 && (
                      <div className="text-sm text-[var(--t3)] mt-1">{student.parent_phone2}</div>
                    )}
                  </div>

                  <div className="bg-[var(--surface-container)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon className="text-lg text-[var(--t3)]">account_balance_wallet</MaterialIcon>
                      <span className="text-xs text-[var(--t3)] uppercase tracking-wider font-medium">Fee Balance</span>
                    </div>
                    <div className={`font-bold text-lg ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(balance)}
                    </div>
                    <div className="text-xs text-[var(--t3)] mt-1">
                      Paid {formatCurrency(paid)} of {formatCurrency(total)}
                    </div>
                  </div>

                  <div className="bg-[var(--surface-container)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon className="text-lg text-[var(--t3)]">event_available</MaterialIcon>
                      <span className="text-xs text-[var(--t3)] uppercase tracking-wider font-medium">Today</span>
                    </div>
                    {attendance ? (
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          attendance === 'present' ? 'bg-green-100 text-green-800' :
                          attendance === 'absent' ? 'bg-red-100 text-red-800' :
                          attendance === 'late' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {attendance.charAt(0).toUpperCase() + attendance.slice(1)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--t3)]">Not marked yet</div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {smsTarget && (
        <SendSMSModal
          student={smsTarget}
          isOpen={!!smsTarget}
          onClose={() => setSmsTarget(null)}
        />
      )}
    </div>
  )
}
