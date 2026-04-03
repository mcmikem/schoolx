'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { useDormManager } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/EmptyState'

export default function DormitoryPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [dorms, setDorms] = useState<any[]>([])
  const [selectedDormId, setSelectedDormId] = useState('')
  const { rooms, incidents, loading } = useDormManager(school?.id, selectedDormId)
  
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [activeTab, setActiveTab] = useState('rooms')

  const fetchDorms = useCallback(async () => {
    if (!school?.id) return
    const { data } = await supabase.from('dorms').select('*').eq('school_id', school.id)
    setDorms(data || [])
    if (data && data.length > 0 && !selectedDormId) setSelectedDormId(data[0].id)
  }, [school?.id, selectedDormId])

  useEffect(() => {
    fetchDorms()
  }, [fetchDorms])

  const handleAddIncident = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const incident = {
      school_id: school!.id,
      dorm_id: selectedDormId,
      student_id: formData.get('student_id'),
      incident_type: formData.get('incident_type'),
      description: formData.get('description'),
      incident_date: new Date().toISOString().split('T')[0],
      reported_by: user!.id
    }

    const { error } = await supabase.from('dorm_incidents').insert([incident])
    if (error) {
      toast.error('Failed to record incident')
    } else {
      toast.success('Incident recorded')
      setShowIncidentModal(false)
    }
  }

  const tabs = [
    { id: 'rooms', label: 'Rooms', count: rooms.length },
    { id: 'incidents', label: 'Incidents', count: incidents.length }
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Dormitory Management"
        subtitle="Monitor student welfare and hostel occupancy"
        actions={
          <div className="flex items-center gap-3">
            {dorms.length === 0 ? (
              <div className="bg-[var(--amber-soft)] text-[var(--amber)] px-4 py-2 rounded-xl text-sm font-medium">No dorms available</div>
            ) : (
              <select 
                value={selectedDormId}
                onChange={(e) => setSelectedDormId(e.target.value)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
              >
                {dorms.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
                ))}
              </select>
            )}
            <Button variant="danger" size="sm" onClick={() => setShowIncidentModal(true)}>
              <MaterialIcon icon="report_problem" />
              Report Incident
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--on-surface)] flex items-center gap-2">
                <MaterialIcon icon="bed" className="text-[var(--primary)]" />
                Visual Room Map
              </h2>
              <button 
                onClick={() => setShowRoomModal(true)}
                className="text-sm font-semibold text-[var(--primary)] hover:opacity-80"
              >
                + Add Room
              </button>
            </div>
            <CardBody>
              <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-4" />
              <TabPanel activeTab={activeTab} tabId="rooms">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {rooms.map(room => (
                    <div key={room.id} className="p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)] hover:border-[var(--primary)]/30 transition-all cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-[var(--on-surface)]">{room.room_number}</p>
                        <MaterialIcon icon="meeting_room" className="text-[var(--t4)]" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-[var(--t3)] font-medium">
                          <span>Occupancy</span>
                          <span>{room.current_occupancy}/{room.capacity}</span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--surface-container)] rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              (room.current_occupancy / room.capacity) > 0.9 ? 'bg-[var(--error)]' : 'bg-[var(--primary)]'
                            }`}
                            style={{ width: `${(room.current_occupancy / room.capacity) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabPanel>
              <TabPanel activeTab={activeTab} tabId="incidents">
                {incidents.length === 0 ? (
                  <EmptyState icon="check_circle" title="No incidents" description="No incidents recorded for this dorm" />
                ) : (
                  <div className="space-y-3">
                    {incidents.map(incident => (
                      <div key={incident.id} className="p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            incident.incident_type === 'health' ? 'bg-[var(--red-soft)] text-[var(--red)]' : 'bg-[var(--amber-soft)] text-[var(--amber)]'
                          }`}>
                            {incident.incident_type}
                          </span>
                          <p className="text-xs text-[var(--t4)]">{incident.incident_date}</p>
                        </div>
                        <p className="text-sm font-medium text-[var(--on-surface)]">Student: {incident.students?.first_name || 'Loading...'}</p>
                        <p className="text-xs text-[var(--t3)] line-clamp-2 mt-1">{incident.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabPanel>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--on-surface)] flex items-center gap-2">
                <MaterialIcon icon="history" className="text-[var(--amber)]" />
                Recent Incidents
              </h2>
            </div>
            <CardBody>
              <div className="space-y-3">
                {incidents.slice(0, 5).map(incident => (
                  <div key={incident.id} className="p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        incident.incident_type === 'health' ? 'bg-[var(--red-soft)] text-[var(--red)]' : 'bg-[var(--amber-soft)] text-[var(--amber)]'
                      }`}>
                        {incident.incident_type}
                      </span>
                      <p className="text-xs text-[var(--t4)]">{incident.incident_date}</p>
                    </div>
                    <p className="text-sm font-medium text-[var(--on-surface)] mt-2">Student: {incident.students?.first_name || 'Loading...'}</p>
                    <p className="text-xs text-[var(--t3)] line-clamp-2 mt-1">{incident.description}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--on-surface)]">Report Dorm Incident</h2>
              <button onClick={() => setShowIncidentModal(false)} className="text-[var(--t4)] hover:text-[var(--on-surface)]">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <form onSubmit={handleAddIncident} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--on-surface)]">Student ID</label>
                <input name="student_id" required className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)]" placeholder="Enter student ID..." />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--on-surface)]">Type</label>
                <select name="incident_type" className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]">
                  <option value="misbehavior">Misbehavior</option>
                  <option value="health">Health Issue</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--on-surface)]">Description</label>
                <textarea name="description" required rows={3} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)]" placeholder="Details of the incident..."></textarea>
              </div>
              <Button type="submit" variant="danger" className="w-full mt-4">
                Submit Report
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}