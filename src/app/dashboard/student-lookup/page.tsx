'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useFeePayments, useFeeStructure } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { SendSMSModal } from '@/components/SendSMSModal'
import MaterialIcon from '@/components/MaterialIcon'

interface AttendanceRecord {
  student_id: string
  status: string
  date: string
}

export default function StudentLookupPage() {
  const { school } = useAuth()
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
  }, [school?.id, today])

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Student Lookup</h1>
        <p className="text-[#5c6670] mt-1">Quick access to student information</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-6">
        <div className="relative">
          <MaterialIcon icon="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5c6670]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#f8fafb] border border-[#e8eaed] rounded-xl py-4 pl-12 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045]"
            placeholder="Search by name, student number, or parent name..."
            autoFocus
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-[#e8eaed] p-6">
              <div className="w-1/2 h-5 bg-[#e8eaed] rounded mb-3" />
              <div className="w-1/3 h-4 bg-[#e8eaed] rounded" />
            </div>
          ))}
        </div>
      ) : searchTerm.trim() && results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <MaterialIcon icon="search_off" className="text-4xl text-[#5c6670] mb-3" />
          <h3 className="text-lg font-semibold text-[#191c1d] mb-1">No students found</h3>
          <p className="text-[#5c6670]">Try a different search term</p>
        </div>
      ) : !searchTerm.trim() ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <MaterialIcon icon="person_search" className="text-4xl text-[#5c6670] mb-3" />
          <h3 className="text-lg font-semibold text-[#191c1d] mb-1">Look Up a Student</h3>
          <p className="text-[#5c6670]">Search to see student details, parent info, fees, and attendance</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((student) => {
            const { total, paid, balance } = getStudentBalance(student.id)
            const attendance = getAttendanceStatus(student.id)

            return (
              <div key={student.id} className="bg-white rounded-2xl border border-[#e8eaed] p-6">
                {/* Student header */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#002045] rounded-full flex items-center justify-center text-white font-bold">
                      {`${student.first_name[0] || ''}${student.last_name[0] || ''}`.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#191c1d] text-lg">{student.first_name} {student.last_name}</h3>
                      <p className="text-sm text-[#5c6670]">
                        {student.student_number} &middot; {student.classes?.name || 'No class'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    student.status === 'active'
                      ? 'bg-[#e8f5e9] text-[#006e1c]'
                      : 'bg-[#f0f0f0] text-[#5c6670]'
                  }`}>
                    {student.status}
                  </span>
                </div>

                {/* SMS Button */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSmsTarget(student)}
                    className="btn btn-sm btn-secondary flex items-center gap-1"
                  >
                    <MaterialIcon icon="sms" className="text-sm" />
                    SMS Parent
                  </button>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Parent info */}
                  <div className="bg-[#f8fafb] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon icon="person" className="text-lg text-[#5c6670]" />
                      <span className="text-xs text-[#5c6670] uppercase tracking-wider font-medium">Parent</span>
                    </div>
                    <div className="font-medium text-[#191c1d]">{student.parent_name || 'Not provided'}</div>
                  </div>

                  {/* Phone */}
                  <div className="bg-[#f8fafb] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon icon="phone" className="text-lg text-[#5c6670]" />
                      <span className="text-xs text-[#5c6670] uppercase tracking-wider font-medium">Phone</span>
                    </div>
                    <div className="font-medium text-[#191c1d]">{student.parent_phone || 'Not provided'}</div>
                    {student.parent_phone2 && (
                      <div className="text-sm text-[#5c6670] mt-1">{student.parent_phone2}</div>
                    )}
                  </div>

                  {/* Fee balance */}
                  <div className="bg-[#f8fafb] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon icon="account_balance_wallet" className="text-lg text-[#5c6670]" />
                      <span className="text-xs text-[#5c6670] uppercase tracking-wider font-medium">Fee Balance</span>
                    </div>
                    <div className={`font-bold text-lg ${balance > 0 ? 'text-[#c62828]' : 'text-[#006e1c]'}`}>
                      {formatCurrency(balance)}
                    </div>
                    <div className="text-xs text-[#5c6670] mt-1">
                      Paid {formatCurrency(paid)} of {formatCurrency(total)}
                    </div>
                  </div>

                  {/* Attendance */}
                  <div className="bg-[#f8fafb] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon icon="event_available" className="text-lg text-[#5c6670]" />
                      <span className="text-xs text-[#5c6670] uppercase tracking-wider font-medium">Today</span>
                    </div>
                    {attendance ? (
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          attendance === 'present' ? 'bg-[#e8f5e9] text-[#006e1c]' :
                          attendance === 'absent' ? 'bg-[#ffebee] text-[#c62828]' :
                          attendance === 'late' ? 'bg-[#fff3e0] text-[#b86e00]' :
                          'bg-[#f0f0f0] text-[#5c6670]'
                        }`}>
                          {attendance.charAt(0).toUpperCase() + attendance.slice(1)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-[#5c6670]">Not marked yet</div>
                    )}
                  </div>
                </div>
              </div>
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
