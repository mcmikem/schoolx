'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useClasses, useStudents } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

type ReportType = 'attendance' | 'fees' | 'grades' | 'weekly_summary'

interface AutoSMSConfig {
  enabled: boolean
  reportType: ReportType
  frequency: 'daily' | 'weekly' | 'monthly'
  dayOfWeek: number
  time: string
}

export default function AutoSMSPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { students } = useStudents(school?.id)
  
  const [config, setConfig] = useState<AutoSMSConfig>({
    enabled: false,
    reportType: 'weekly_summary',
    frequency: 'weekly',
    dayOfWeek: 1,
    time: '08:00',
  })
  const [selectedClass, setSelectedClass] = useState('all')
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<string[]>([])
  const [lastSent, setLastSent] = useState<string | null>(null)

  useEffect(() => {
    // Load saved config
    const saved = localStorage.getItem('auto_sms_config')
    if (saved) {
      setConfig(JSON.parse(saved))
    }
    
    const lastSentDate = localStorage.getItem('auto_sms_last_sent')
    if (lastSentDate) {
      setLastSent(lastSentDate)
    }
  }, [])

  const saveConfig = () => {
    localStorage.setItem('auto_sms_config', JSON.stringify(config))
    toast.success('Auto SMS settings saved')
  }

  const generatePreview = async () => {
    const targetStudents = selectedClass === 'all' 
      ? students 
      : students.filter(s => s.class_id === selectedClass)

    const messages: string[] = []

    if (config.reportType === 'attendance') {
      // Generate attendance summary
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('school_id', school?.id)
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

      targetStudents.slice(0, 3).forEach(student => {
        const studentAttendance = attendance?.filter(a => a.student_id === student.id) || []
        const present = studentAttendance.filter(a => a.status === 'present').length
        const total = studentAttendance.length || 5
        messages.push(
          `Dear Parent, ${student.first_name} was present ${present}/${total} days this week. ${school?.name}`
        )
      })
    } else if (config.reportType === 'fees') {
      // Generate fee reminder
      const { data: payments } = await supabase
        .from('fee_payments')
        .select('*')
        .in('student_id', targetStudents.slice(0, 3).map(s => s.id))

      targetStudents.slice(0, 3).forEach(student => {
        const studentPayments = payments?.filter(p => p.student_id === student.id) || []
        const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0)
        messages.push(
          `Dear Parent, ${student.first_name}'s fee status: Paid UGX ${totalPaid.toLocaleString()}. Please check balance. ${school?.name}`
        )
      })
    } else if (config.reportType === 'grades') {
      // Generate grade report
      targetStudents.slice(0, 3).forEach(student => {
        messages.push(
          `Dear Parent, ${student.first_name}'s Term ${currentTerm} results are now available. Please visit the school or check online. ${school?.name}`
        )
      })
    } else {
      // Weekly summary
      targetStudents.slice(0, 3).forEach(student => {
        messages.push(
          `Dear Parent, Weekly update for ${student.first_name}: Attendance good, Fees up to date. Keep supporting your child. ${school?.name}`
        )
      })
    }

    setPreview(messages)
  }

  const sendAutoSMS = async () => {
    if (!school?.id) return
    
    setSending(true)
    try {
      const targetStudents = selectedClass === 'all' 
        ? students 
        : students.filter(s => s.class_id === selectedClass)

      let successCount = 0
      let failCount = 0

      for (const student of targetStudents) {
        if (!student.parent_phone) {
          failCount++
          continue
        }

        let message = ''
        if (config.reportType === 'attendance') {
          const { data: attendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('student_id', student.id)
            .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          
          const present = attendance?.filter(a => a.status === 'present').length || 0
          const total = attendance?.length || 5
          message = `Dear Parent, ${student.first_name} was present ${present}/${total} days this week. ${school?.name}`
        } else if (config.reportType === 'fees') {
          const { data: payments } = await supabase
            .from('fee_payments')
            .select('*')
            .eq('student_id', student.id)
          
          const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0
          message = `Dear Parent, ${student.first_name}'s fee status: Paid UGX ${totalPaid.toLocaleString()}. Please check balance. ${school?.name}`
        } else {
          message = `Dear Parent, Weekly update for ${student.first_name}: Keep supporting your child's education. ${school?.name}`
        }

        try {
          await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: student.parent_phone,
              message,
              schoolId: school.id,
            })
          })
          successCount++
        } catch {
          failCount++
        }
      }

      localStorage.setItem('auto_sms_last_sent', new Date().toISOString())
      setLastSent(new Date().toISOString())
      toast.success(`Sent to ${successCount} parents. ${failCount} failed.`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Auto SMS Reports</h1>
        <p className="text-[#5c6670] mt-1">Automatically send reports to parents via SMS</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <h2 className="font-semibold text-[#002045] mb-4">Settings</h2>
          
          <div className="space-y-4">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Enable Auto SMS</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Send reports automatically</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.enabled}
                  onChange={(e) => setConfig({...config, enabled: e.target.checked})}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Report Type */}
            <div>
              <label className="label">Report Type</label>
              <select 
                value={config.reportType}
                onChange={(e) => setConfig({...config, reportType: e.target.value as ReportType})}
                className="input"
              >
                <option value="weekly_summary">Weekly Summary</option>
                <option value="attendance">Attendance Report</option>
                <option value="fees">Fee Balance Reminder</option>
                <option value="grades">Grade Report</option>
              </select>
            </div>

            {/* Class Filter */}
            <div>
              <label className="label">Send To</label>
              <select 
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="input"
              >
                <option value="all">All Classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Frequency */}
            <div>
              <label className="label">Frequency</label>
              <select 
                value={config.frequency}
                onChange={(e) => setConfig({...config, frequency: e.target.value as any})}
                className="input"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button onClick={saveConfig} className="btn btn-secondary flex-1">
                Save Settings
              </button>
              <button onClick={generatePreview} className="btn btn-secondary flex-1">
                Preview
              </button>
            </div>
          </div>
        </div>

        {/* Preview & Send */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
            <h2 className="font-semibold text-[#002045] mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[#5c6670]">Recipients</span>
                <span className="font-medium text-[#002045]">
                  {selectedClass === 'all' ? students.length : students.filter(s => s.class_id === selectedClass).length} parents
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5c6670]">Report Type</span>
                <span className="font-medium text-[#002045] capitalize">
                  {config.reportType.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5c6670]">Last Sent</span>
                <span className="font-medium text-[#002045]">
                  {lastSent ? new Date(lastSent).toLocaleDateString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {/* Preview Messages */}
          {preview.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
              <h2 className="font-semibold text-[#002045] mb-4">Preview</h2>
              <div className="space-y-3">
                {preview.map((msg, i) => (
                  <div key={i} className="p-3 bg-[#f8fafb] rounded-lg">
                    <p className="text-sm text-[#002045]">{msg}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Send Button */}
          <button 
            onClick={sendAutoSMS}
            disabled={sending || !config.enabled}
            className="btn btn-primary w-full"
          >
            {sending ? 'Sending...' : 'Send Now'}
          </button>

          {/* Info */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> Auto SMS will send reports to all parents with phone numbers on record. 
              Make sure parent phone numbers are up to date.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
