'use client'
import { useAuth } from '@/lib/auth-context'
import { useSMSTriggers } from '@/lib/hooks'
import GlassCard from '@/components/GlassCard'
import { useToast } from '@/components/Toast'

import MaterialIcon from '@/components/MaterialIcon'

export default function AutoSMSPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { triggers, loading, toggleTrigger } = useSMSTriggers(school?.id)

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const result = await toggleTrigger(id, !currentStatus)
    if (result.success) {
      toast.success(`Trigger ${!currentStatus ? 'activated' : 'deactivated'}`)
    } else {
      toast.error('Failed to update trigger')
    }
  }

  if (loading) return <div className="p-8 text-white">Loading automation rules...</div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Smart SMS Triggers</h1>
        <p className="text-white/60">Automate communication based on school events</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {triggers.map(trigger => (
          <GlassCard key={trigger.id} className="relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-20 transition-all ${
              trigger.is_active ? 'bg-green-500' : 'bg-white/10'
            }`} />
            
            <div className="flex items-center justify-between mb-6">
              <div className={`p-3 rounded-2xl ${
                trigger.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/20'
              }`}>
                <MaterialIcon icon={trigger.event_type === 'fee_overdue' ? 'payments' : 'person_off'} />
              </div>
              
              <button 
                onClick={() => handleToggle(trigger.id, trigger.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  trigger.is_active ? 'bg-green-600' : 'bg-white/10'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  trigger.is_active ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white">{trigger.name}</h3>
                <p className="text-xs text-white/40 uppercase tracking-widest">{trigger.event_type.replace('_', ' ')}</p>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <MaterialIcon icon="bolt" className="text-xs" />
                  <span>Threshold: {trigger.threshold_days} days</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <p className="text-[10px] text-white/30 italic">
                  Last run: {trigger.last_run_at ? new Date(trigger.last_run_at).toLocaleDateString() : 'Never'}
                </p>
                <button className="text-xs text-blue-400 font-bold hover:text-blue-300">Edit Rule</button>
              </div>
            </div>
          </GlassCard>
        ))}

        <button className="border-2 border-dashed border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all group">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-all">
            <MaterialIcon icon="add" />
          </div>
          <p className="text-sm font-bold text-white/20 group-hover:text-white/60">New Automation Rule</p>
        </button>
      </div>

      <GlassCard>
        <h2 className="text-xl font-bold text-white mb-6">Automation Logs</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div>
                <p className="text-sm font-bold text-white">Sent &quot;Fee Reminder&quot; to 12 parents</p>
                <p className="text-[10px] text-white/40">Today at 09:15 AM</p>
              </div>
            </div>
            <MaterialIcon icon="chevron_right" className="text-white/20" />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 opacity-60">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div>
                <p className="text-sm font-bold text-white">Sent &quot;Absentee Alert&quot; to 3 parents</p>
                <p className="text-[10px] text-white/40">Yesterday at 10:30 AM</p>
              </div>
            </div>
            <MaterialIcon icon="chevron_right" className="text-white/20" />
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
