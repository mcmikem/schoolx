'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { useTransportManager } from '@/lib/hooks'
import GlassCard from '@/components/GlassCard'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className }: { icon: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{icon}</span>
}

export default function TransportPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { routes, logs, loading } = useTransportManager(school?.id)
  
  const [showLogModal, setShowLogModal] = useState(false)
  const [selectedRouteId, setSelectedRouteId] = useState('')

  const handleAddLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const logEntry = {
      school_id: school!.id,
      route_id: selectedRouteId,
      log_type: formData.get('log_type'),
      amount: Number(formData.get('amount')),
      description: formData.get('description'),
      odometer_reading: Number(formData.get('odometer_reading')),
      log_date: new Date().toISOString().split('T')[0],
      recorded_by: user!.id
    }

    const { error } = await supabase.from('transport_vehicle_logs').insert([logEntry])
    if (error) {
      toast.error('Failed to add log')
    } else {
      toast.success('Vehicle log added')
      setShowLogModal(false)
    }
  }

  if (loading) return <div className="p-8 text-white">Loading transport data...</div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Transport & Logistics</h1>
          <p className="text-white/60">Manage school buses, routes, and vehicle maintenance</p>
        </div>

        <button 
          onClick={() => setShowLogModal(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all"
        >
          <MaterialIcon icon="local_gas_station" />
          Add Vehicle Log
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <GlassCard>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <MaterialIcon icon="directions_bus" className="text-blue-400" />
              Active Routes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routes.map(route => (
                <div key={route.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{route.route_name}</h3>
                      <p className="text-xs text-white/40">{route.vehicle_number || 'No Vehicle Assigned'}</p>
                    </div>
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                      <MaterialIcon icon="route" />
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <MaterialIcon icon="person" className="text-xs" />
                      {route.driver_name || 'No Driver'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <MaterialIcon icon="sell" className="text-xs" />
                      UGX {route.monthly_fee?.toLocaleString() || 0} / month
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                      {route.transport_stops?.length || 0} Stops
                    </span>
                    <button className="text-xs text-white/40 hover:text-white transition-colors">View Schedule</button>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <MaterialIcon icon="receipt_long" className="text-amber-400" />
              Recent Logs
            </h2>
            <div className="space-y-4">
              {logs.slice(0, 6).map(log => (
                <div key={log.id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      log.log_type === 'fuel' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {log.log_type}
                    </span>
                    <p className="text-[10px] text-white/40">{log.log_date}</p>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-white/60 italic">{log.description || 'No description'}</p>
                      {log.odometer_reading && (
                        <p className="text-[10px] text-white/30 mt-1">Odometer: {log.odometer_reading} km</p>
                      )}
                    </div>
                    {log.amount && (
                      <p className="text-sm font-bold text-white">UGX {log.amount.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Vehicle Log</h2>
              <button onClick={() => setShowLogModal(false)} className="text-white/40 hover:text-white">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <form onSubmit={handleAddLog} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Select Route/Vehicle</label>
                <select 
                  required
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                >
                  <option value="" className="bg-slate-900">Choose route...</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id} className="bg-slate-900">{r.route_name} ({r.vehicle_number})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Log Type</label>
                  <select name="log_type" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                    <option value="fuel" className="bg-slate-900">Fuel</option>
                    <option value="maintenance" className="bg-slate-900">Maintenance</option>
                    <option value="mileage" className="bg-slate-900">Mileage</option>
                    <option value="incident" className="bg-slate-900">Incident</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Amount (UGX)</label>
                  <input name="amount" type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none" placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Odometer Reading (km)</label>
                <input name="odometer_reading" type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none" placeholder="Current km..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Description</label>
                <textarea name="description" rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" placeholder="Details..."></textarea>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 mt-4 transition-all">
                Save Vehicle Log
              </button>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
