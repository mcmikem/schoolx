'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { useTransportManager } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

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

  if (loading) return <div className="p-8 text-[var(--on-surface)]">Loading transport data...</div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader 
        title="Transport & Logistics"
        subtitle="Manage school buses, routes, and vehicle maintenance"
        actions={
          <Button variant="primary" onClick={() => setShowLogModal(true)}>
            <MaterialIcon icon="local_gas_station" />
            Add Vehicle Log
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex items-center gap-2">
              <MaterialIcon icon="directions_bus" className="text-[var(--primary)]" />
              <span className="font-semibold text-[var(--on-surface)]">Active Routes</span>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {routes.map(route => (
                  <div key={route.id} className="p-5 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--border)] hover:border-[var(--primary)]/30 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--on-surface)]">{route.route_name}</h3>
                        <p className="text-xs text-[var(--t3)]">{route.vehicle_number || 'No Vehicle Assigned'}</p>
                      </div>
                      <div className="p-2 bg-[var(--primary)]/10 rounded-lg text-[var(--primary)]">
                        <MaterialIcon icon="route" />
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-sm text-[var(--t3)]">
                        <MaterialIcon icon="person" className="text-xs" />
                        {route.driver_name || 'No Driver'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--t3)]">
                        <MaterialIcon icon="sell" className="text-xs" />
                        UGX {route.monthly_fee?.toLocaleString() || 0} / month
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-widest">
                        {route.transport_stops?.length || 0} Stops
                      </span>
                      <button className="text-xs text-[var(--t3)] hover:text-[var(--on-surface)] transition-colors">View Schedule</button>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex items-center gap-2">
              <MaterialIcon icon="receipt_long" className="text-amber-500" />
              <span className="font-semibold text-[var(--on-surface)]">Recent Logs</span>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {logs.slice(0, 6).map(log => (
                  <div key={log.id} className="p-4 rounded-xl bg-[var(--surface-container-low)] border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        log.log_type === 'fuel' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {log.log_type}
                      </span>
                      <p className="text-[10px] text-[var(--t3)]">{log.log_date}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xs text-[var(--t3)] italic">{log.description || 'No description'}</p>
                        {log.odometer_reading && (
                          <p className="text-[10px] text-[var(--t4)] mt-1">Odometer: {log.odometer_reading} km</p>
                        )}
                      </div>
                      {log.amount && (
                        <p className="text-sm font-bold text-[var(--on-surface)]">UGX {log.amount.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowLogModal(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 p-6 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-[var(--on-surface)]">New Vehicle Log</h2>
              <button onClick={() => setShowLogModal(false)} className="text-[var(--t3)] hover:text-[var(--on-surface)]">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <form onSubmit={handleAddLog} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--on-surface)]">Select Route/Vehicle</label>
                {routes.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm">No routes available</div>
                ) : (
                  <select 
                    required
                    value={selectedRouteId}
                    onChange={(e) => setSelectedRouteId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] outline-none"
                  >
                    <option value="">Choose route...</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.route_name} ({r.vehicle_number})</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Log Type</label>
                  <select name="log_type" className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] outline-none">
                    <option value="fuel">Fuel</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="mileage">Mileage</option>
                    <option value="incident">Incident</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Amount (UGX)</label>
                  <input name="amount" type="number" className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:ring-2 focus:ring-[var(--primary)]/50 outline-none" placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--on-surface)]">Odometer Reading (km)</label>
                <input name="odometer_reading" type="number" className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:ring-2 focus:ring-[var(--primary)]/50 outline-none" placeholder="Current km..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--on-surface)]">Description</label>
                <textarea name="description" rows={2} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] outline-none" placeholder="Details..."></textarea>
              </div>
              <Button type="submit" variant="primary" className="w-full mt-4">
                Save Vehicle Log
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}