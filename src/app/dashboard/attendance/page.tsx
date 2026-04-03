'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { offlineDB, useOnlineStatus } from '@/lib/offline'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'

const STATUS_CYCLE = ['absent', 'present', 'late'] as const
type AttendanceStatus = typeof STATUS_CYCLE[number]

const STATUS_CONFIG: Record<AttendanceStatus, { color: string; bg: string; label: string; icon: string }> = {
  absent: { color: 'bg-error', bg: 'bg-error-container', label: 'Absent', icon: 'cancel' },
  present: { color: 'bg-secondary', bg: 'bg-secondary-container', label: 'Present', icon: 'check_circle' },
  late: { color: 'bg-tertiary', bg: 'bg-tertiary-container', label: 'Late', icon: 'schedule' },
}

function cycleStatus(current: string | undefined): AttendanceStatus {
  if (!current) return 'present'
  const idx = STATUS_CYCLE.indexOf(current as AttendanceStatus)
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

export default function AttendancePage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const isOnline = useOnlineStatus()
  const { classes, loading: classesLoading } = useClasses(school?.id)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [date, setDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [students, setStudents] = useState<Array<{id: string, first_name: string, last_name: string, student_number: string}>>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [offlineCount, setOfflineCount] = useState(0)
  const [allMarked, setAllMarked] = useState(false)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')

  const isClassTeacher = user?.role === 'teacher'
  const isAdmin = user?.role === 'headmaster' || user?.role === 'dean_of_studies' || user?.role === 'school_admin' || user?.role === 'super_admin' || user?.role === 'bursar'

  const filteredClasses = isClassTeacher && !isAdmin
    ? classes.filter(c => c.class_teacher_id === user?.id)
    : classes

  const loadOfflineCount = useCallback(async () => {
    try {
      const pending = await offlineDB.getPendingSync()
      const attendancePending = pending.filter(p => p.table === 'attendance')
      setOfflineCount(attendancePending.length)
    } catch {
      setOfflineCount(0)
    }
  }, [])

  useEffect(() => {
    loadOfflineCount()
  }, [loadOfflineCount])

  useEffect(() => {
    async function fetchStudents() {
      if (!selectedClass || !school?.id) return

      try {
        setLoading(true)

        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('school_id', school.id)
          .eq('class_id', selectedClass)
          .eq('status', 'active')
          .order('first_name')

        if (studentsError) throw studentsError
        setStudents(studentsData || [])

        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .eq('class_id', selectedClass)
          .eq('date', date)

        const attendanceMap: Record<string, string> = {}
        attendanceData?.forEach((record: {student_id: string, status: string}) => {
          attendanceMap[record.student_id] = record.status
        })
        setAttendance(attendanceMap)
      } catch (err) {
        console.error('Error fetching students:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [selectedClass, date, school?.id])

  const markAttendance = (studentId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }))
  }

  const handleTapStatus = (studentId: string) => {
    const current = attendance[studentId]
    const next = cycleStatus(current)
    markAttendance(studentId, next)
  }

  const markAll = (status: string) => {
    const newAttendance: Record<string, string> = {}
    students.forEach(s => {
      newAttendance[s.id] = status
    })
    setAttendance(newAttendance)
    setAllMarked(true)
  }

  const handleMarkAllPresent = () => {
    if (allMarked) {
      markAll('absent')
      toast.info('Reset all to absent')
    } else {
      const confirmed = window.confirm(
        `Mark all ${students.length} students as present?`
      )
      if (confirmed) {
        markAll('present')
        toast.success('All marked present')
      }
    }
  }

  const saveAttendance = async () => {
    if (!selectedClass || !user?.id) return

    const records = Object.entries(attendance).map(([studentId, status]) => ({
      student_id: studentId,
      class_id: selectedClass,
      date,
      status,
      recorded_by: user.id,
    }))

    if (records.length === 0) {
      toast.warning('No attendance records to save')
      return
    }

    setSaving(true)

    if (isOnline) {
      try {
        const { error } = await supabase
          .from('attendance')
          .upsert(records, { onConflict: 'student_id,date' })

        if (error) throw error
        toast.success('Attendance saved')
        await loadOfflineCount()
      } catch {
        await saveOffline(records)
      } finally {
        setSaving(false)
      }
    } else {
      await saveOffline(records)
      setSaving(false)
    }
  }

  const saveOffline = async (records: Array<{student_id: string, class_id: string, date: string, status: string, recorded_by: string}>) => {
    try {
      for (const record of records) {
        await offlineDB.save('attendance', record as unknown as Record<string, unknown>)
      }
      toast.success(`Saved locally (${records.length} records)`)
      await loadOfflineCount()
    } catch (err) {
      console.error('Offline save failed:', err)
      toast.error('Failed to save locally')
    }
  }

  const presentCount = Object.values(attendance).filter(s => s === 'present').length
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length
  const lateCount = Object.values(attendance).filter(s => s === 'late').length

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <PageHeader 
        title="Attendance" 
        subtitle={`Mark daily student attendance`}
        actions={
          <div className="flex items-center gap-3">
            {offlineCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-tertiary-container text-on-tertiary-container text-xs font-semibold">
                <MaterialIcon icon="cloud_off" className="text-sm" />
                {offlineCount} record{offlineCount !== 1 ? 's' : ''} saved offline
              </div>
            )}
            {!isOnline && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-error-container text-on-error-container text-xs font-semibold">
                <MaterialIcon icon="wifi_off" className="text-sm" />
                Offline
              </div>
            )}
          </div>
        }
      />

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">
              Select Class
              {isClassTeacher && !isAdmin && (
                <span className="ml-2 normal-case font-medium text-primary">(your classes)</span>
              )}
            </label>
            {classes.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-amber-800 text-sm font-medium">No classes found</p>
                <p className="text-amber-600 text-xs mt-1">Classes are created automatically when you register a school. If you are seeing this, please contact support or re-register.</p>
              </div>
            ) : (
              <select
                value={selectedClass || ''}
                onChange={(e) => setSelectedClass(e.target.value || null)}
                className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select a class</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.level})</option>
                ))}
              </select>
            )}
          </div>
          <div className="sm:w-48">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {!selectedClass ? (
        <EmptyState
          icon="fact_check"
          title="Select a class"
          description={isClassTeacher && !isAdmin && filteredClasses.length === 0 ? "You are not assigned as class teacher for any class" : "Choose a class to mark attendance"}
        />
      ) : loading ? (
        <TableSkeleton rows={5} />
      ) : students.length === 0 ? (
        <EmptyState
          icon="group"
          title="No students in this class"
          description="Add students to this class first"
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-3 text-center">
              <div className="text-2xl md:text-3xl font-bold text-secondary">{presentCount}</div>
              <div className="text-xs md:text-sm text-on-surface-variant mt-1">Present</div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-3 text-center">
              <div className="text-2xl md:text-3xl font-bold text-error">{absentCount}</div>
              <div className="text-xs md:text-sm text-on-surface-variant mt-1">Absent</div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-3 text-center">
              <div className="text-2xl md:text-3xl font-bold text-tertiary">{lateCount}</div>
              <div className="text-xs md:text-sm text-on-surface-variant mt-1">Late</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleMarkAllPresent}
              icon={<MaterialIcon icon={allMarked ? 'undo' : 'check_circle'} />}
            >
              {allMarked ? 'Reset All' : 'Mark All Present'}
            </Button>
            <Tabs
              tabs={[
                { id: 'desktop', label: 'List' },
                { id: 'mobile', label: 'Cards' }
              ]}
              activeTab={viewMode}
              onChange={(id) => setViewMode(id as 'desktop' | 'mobile')}
            />
          </div>

          <TabPanel activeTab={viewMode} tabId="desktop">
            <div className="space-y-3">
              {students.map((student) => {
                const status = attendance[student.id] as AttendanceStatus | undefined
                const config = status ? STATUS_CONFIG[status] : null
                return (
                  <div key={student.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center">
                          <span className="text-on-primary-container font-bold text-sm">
                            {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="font-bold text-primary">{student.first_name} {student.last_name}</div>
                          <div className="text-xs text-on-surface-variant">{student.student_number}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {STATUS_CYCLE.map((s) => {
                          const sConfig = STATUS_CONFIG[s]
                          const isActive = status === s
                          return (
                            <button
                              key={s}
                              onClick={() => markAttendance(student.id, s)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                isActive
                                  ? `${sConfig.bg} border-${s === 'absent' ? 'error' : s === 'present' ? 'secondary' : 'tertiary'}`
                                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-outline-variant'
                              }`}
                            >
                              {sConfig.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabPanel>

          <TabPanel activeTab={viewMode} tabId="mobile">
            <div className="space-y-2">
              {students.map((student) => {
                const status = attendance[student.id] as AttendanceStatus | undefined
                const config = status ? STATUS_CONFIG[status] : null
                return (
                  <div
                    key={student.id}
                    onClick={() => handleTapStatus(student.id)}
                    className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center">
                        <span className="text-on-primary-container font-bold text-sm">
                          {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-primary text-sm">{student.first_name} {student.last_name}</div>
                        <div className="text-xs text-on-surface-variant">{student.student_number}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {config && (
                        <span className="text-xs font-medium text-on-surface-variant">{config.label}</span>
                      )}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          status === 'present'
                            ? 'bg-secondary'
                            : status === 'late'
                            ? 'bg-tertiary'
                            : status === 'absent'
                            ? 'bg-error'
                            : 'bg-surface-container border-2 border-dashed border-outline-variant'
                        }`}
                      >
                        {status && (
                          <MaterialIcon icon={STATUS_CONFIG[status as AttendanceStatus].icon} className="text-white text-lg" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <p className="text-center text-xs text-on-surface-variant pt-2">Tap a student to cycle status</p>
            </div>
          </TabPanel>

          {/* Sticky save button for mobile */}
          <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto p-4 md:p-0 bg-surface/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none border-t border-outline-variant/10 md:border-0 z-10">
            <Button
              onClick={saveAttendance}
              disabled={saving || Object.keys(attendance).length === 0}
              loading={saving}
              icon={<MaterialIcon icon="save" />}
              className="w-full"
            >
              {isOnline ? 'Save Attendance' : 'Save Offline'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
