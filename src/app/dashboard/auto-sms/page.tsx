'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useSMSTriggers } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { supabase } from '@/lib/supabase'
import { detectConsecutiveAbsenceAlerts } from '@/lib/operations'

export default function AutoSMSPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { triggers, loading, toggleTrigger, runTrigger } = useSMSTriggers(school?.id)
  const [absencePreview, setAbsencePreview] = useState<{ count: number; threshold: number }>({ count: 0, threshold: 3 })
  const [runningTriggerId, setRunningTriggerId] = useState<string | null>(null)

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const result = await toggleTrigger(id, !currentStatus)
    if (result.success) {
      toast.success(`Trigger ${!currentStatus ? 'activated' : 'deactivated'}`)
    } else {
      toast.error('Failed to update trigger')
    }
  }

  const handleRunTrigger = async (id: string) => {
    setRunningTriggerId(id)
    const result = await runTrigger(id)
    if (result.success) {
      toast.success(`Trigger run complete: ${result.data?.messagesCreated || 0} message(s) created`)
    } else {
      toast.error(result.error || 'Failed to run trigger')
    }
    setRunningTriggerId(null)
  }

  useEffect(() => {
    async function loadAbsencePreview() {
      if (!school?.id) return

      const absenceTrigger = triggers.find((trigger) => trigger.event_type === 'student_absent')
      const threshold = absenceTrigger?.threshold_days || 3
      setAbsencePreview((current) => ({ ...current, threshold }))

      try {
        const { data: students } = await supabase
          .from('students')
          .select('id, first_name, last_name, parent_phone')
          .eq('school_id', school.id)
          .eq('status', 'active')

        const studentIds = (students || []).map((student) => student.id)
        const { data: attendance } = studentIds.length === 0
          ? { data: [] }
          : await supabase
              .from('attendance')
              .select('student_id, date, status')
              .in('student_id', studentIds)
              .gte('date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
              .order('date', { ascending: false })

        const alerts = detectConsecutiveAbsenceAlerts({
          students: students || [],
          attendance: attendance || [],
          trigger: {
            threshold_days: threshold,
            is_active: absenceTrigger?.is_active ?? true,
          },
        })

        setAbsencePreview({ count: alerts.length, threshold })
      } catch (error) {
        console.error('Failed to load absence preview', error)
      }
    }

    if (!loading) {
      loadAbsencePreview()
    }
  }, [school?.id, triggers, loading])

  if (loading) return <div className="p-8 text-center">Loading automation rules...</div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Smart SMS Triggers"
        subtitle="Automate communication based on school events"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {triggers.map(trigger => (
          <Card key={trigger.id} className="relative overflow-hidden p-6">
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-20 transition-all ${
              trigger.is_active ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            
            <div className="flex items-center justify-between mb-6">
              <div className={`p-3 rounded-2xl ${
                trigger.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                <MaterialIcon>{trigger.event_type === 'fee_overdue' ? 'payments' : 'person_off'}</MaterialIcon>
              </div>
              
              <button 
                onClick={() => handleToggle(trigger.id, trigger.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  trigger.is_active ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  trigger.is_active ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-[var(--t1)]">{trigger.name}</h3>
                <p className="text-xs text-[var(--t3)] uppercase tracking-widest">{trigger.event_type.replace('_', ' ')}</p>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]">
                <div className="flex items-center gap-2 text-sm text-[var(--t3)]">
                  <MaterialIcon className="text-xs">bolt</MaterialIcon>
                  <span>Threshold: {trigger.threshold_days} days</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
                <p className="text-[10px] text-[var(--t3)] italic">
                  Last run: {trigger.last_run_at ? new Date(trigger.last_run_at).toLocaleDateString() : 'Never'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={runningTriggerId === trigger.id || !trigger.is_active}
                    onClick={() => handleRunTrigger(trigger.id)}
                  >
                    {runningTriggerId === trigger.id ? 'Running...' : 'Run Now'}
                  </Button>
                  <Button variant="ghost" size="sm">Edit Rule</Button>
                </div>
              </div>
            </div>
          </Card>
        ))}

        <button className="border-2 border-dashed border-[var(--border)] hover:border-blue-300 hover:bg-blue-50/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all group">
          <div className="w-12 h-12 rounded-full bg-[var(--surface-container)] flex items-center justify-center text-[var(--t3)] group-hover:text-blue-500 group-hover:bg-blue-100 transition-all">
            <MaterialIcon>add</MaterialIcon>
          </div>
          <p className="text-sm font-medium text-[var(--t3)] group-hover:text-[var(--t2)]">New Automation Rule</p>
        </button>
      </div>

      <Card className="p-6">
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">Attendance trigger preview</div>
          <div className="mt-1 text-sm text-amber-800">
            {absencePreview.count} student{absencePreview.count === 1 ? '' : 's'} currently meet the {absencePreview.threshold}-day consecutive absence threshold.
          </div>
        </div>
        <h2 className="text-xl font-bold text-[var(--t1)] mb-6">Automation Logs</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div>
                <p className="text-sm font-medium text-[var(--t1)]">Sent &quot;Fee Reminder&quot; to 12 parents</p>
                <p className="text-[10px] text-[var(--t3)]">Today at 09:15 AM</p>
              </div>
            </div>
            <MaterialIcon className="text-[var(--t3)]">chevron_right</MaterialIcon>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)] opacity-60">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div>
                <p className="text-sm font-medium text-[var(--t1)]">Sent &quot;Absentee Alert&quot; to 3 parents</p>
                <p className="text-[10px] text-[var(--t3)]">Yesterday at 10:30 AM</p>
              </div>
            </div>
            <MaterialIcon className="text-[var(--t3)]">chevron_right</MaterialIcon>
          </div>
        </div>
      </Card>
    </div>
  )
}
