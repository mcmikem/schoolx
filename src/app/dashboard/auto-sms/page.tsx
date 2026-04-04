'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useSMSTriggers } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button, Input } from '@/components/ui/index'
import { supabase } from '@/lib/supabase'
import { detectConsecutiveAbsenceAlerts } from '@/lib/operations'

export default function AutoSMSPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { triggers, loading, toggleTrigger, runTrigger, createTrigger, updateTrigger } = useSMSTriggers(school?.id)
  const [absencePreview, setAbsencePreview] = useState<{ count: number; threshold: number }>({ count: 0, threshold: 3 })
  const [runningTriggerId, setRunningTriggerId] = useState<string | null>(null)
  const [automationLogs, setAutomationLogs] = useState<any[]>([])
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingTrigger, setEditingTrigger] = useState<any | null>(null)
  const [savingRule, setSavingRule] = useState(false)
  const [ruleForm, setRuleForm] = useState({
    name: '',
    event_type: 'student_absent',
    threshold_days: 3,
    is_active: true,
  })

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

  const openCreateRule = () => {
    setEditingTrigger(null)
    setRuleForm({
      name: '',
      event_type: 'student_absent',
      threshold_days: 3,
      is_active: true,
    })
    setShowRuleModal(true)
  }

  const openEditRule = (trigger: any) => {
    setEditingTrigger(trigger)
    setRuleForm({
      name: trigger.name,
      event_type: trigger.event_type,
      threshold_days: Number(trigger.threshold_days || 0),
      is_active: Boolean(trigger.is_active),
    })
    setShowRuleModal(true)
  }

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleForm.name.trim()) {
      toast.error('Rule name is required')
      return
    }

    setSavingRule(true)
    const result = editingTrigger
      ? await updateTrigger(editingTrigger.id, {
          name: ruleForm.name.trim(),
          threshold_days: Number(ruleForm.threshold_days),
          is_active: ruleForm.is_active,
        })
      : await createTrigger({
          name: ruleForm.name.trim(),
          event_type: ruleForm.event_type,
          threshold_days: Number(ruleForm.threshold_days),
          is_active: ruleForm.is_active,
        })

    if (result.success) {
      toast.success(editingTrigger ? 'Rule updated' : 'Rule created')
      setShowRuleModal(false)
      setEditingTrigger(null)
    } else {
      toast.error(result.error || 'Failed to save rule')
    }
    setSavingRule(false)
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

  useEffect(() => {
    async function loadLogs() {
      if (!school?.id) return

      const { data, error } = await supabase
        .from('automated_message_logs')
        .select('id, trigger_id, record_id, recipient_id, status, sent_at, created_at, sms_triggers(name)')
        .eq('school_id', school.id)
        .order('sent_at', { ascending: false })
        .limit(10)

      if (!error) {
        setAutomationLogs(data || [])
      }
    }

    if (!loading) {
      loadLogs()
    }
  }, [school?.id, loading, triggers])

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
                  <Button variant="ghost" size="sm" onClick={() => openEditRule(trigger)}>Edit Rule</Button>
                </div>
              </div>
            </div>
          </Card>
        ))}

        <button onClick={openCreateRule} className="border-2 border-dashed border-[var(--border)] hover:border-blue-300 hover:bg-blue-50/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all group">
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
          {automationLogs.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container)] p-4 text-sm text-[var(--t3)]">
              No automation runs recorded yet.
            </div>
          ) : automationLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${log.status === 'sent' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div>
                  <p className="text-sm font-medium text-[var(--t1)]">
                    {log.sms_triggers?.name || 'Automation Rule'} {log.status === 'sent' ? 'processed successfully' : 'failed'}
                  </p>
                  <p className="text-[10px] text-[var(--t3)]">
                    {new Date(log.sent_at || log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <MaterialIcon className="text-[var(--t3)]">{log.status === 'sent' ? 'check_circle' : 'error'}</MaterialIcon>
            </div>
          ))}
        </div>
      </Card>

      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowRuleModal(false)}>
          <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
              {editingTrigger ? 'Edit Automation Rule' : 'Create Automation Rule'}
            </h2>
            <form className="space-y-4" onSubmit={handleSaveRule}>
              <Input
                label="Rule Name"
                value={ruleForm.name}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <div>
                <label className="block text-sm font-medium text-[var(--on-surface)] mb-2">Trigger Event</label>
                <select
                  value={ruleForm.event_type}
                  disabled={Boolean(editingTrigger)}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, event_type: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <option value="student_absent">Student Absent</option>
                  <option value="fee_overdue">Fee Overdue</option>
                </select>
              </div>
              <Input
                label="Threshold Days"
                type="number"
                min={0}
                value={String(ruleForm.threshold_days)}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, threshold_days: Number(e.target.value) || 0 }))}
                required
              />
              <label className="flex items-center gap-3 text-sm text-[var(--t1)]">
                <input
                  type="checkbox"
                  checked={ruleForm.is_active}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Active
              </label>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowRuleModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={savingRule}>
                  Save Rule
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
