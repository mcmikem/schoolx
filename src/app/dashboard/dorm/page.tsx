'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { useDormManager } from '@/lib/hooks'
import GlassCard from '@/components/GlassCard'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'

export default function DormitoryPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [dorms, setDorms] = useState<any[]>([])
  const [selectedDormId, setSelectedDormId] = useState('')
  const { rooms, incidents, loading } = useDormManager(school?.id, selectedDormId)
  
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)

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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Dormitory Management</h1>
          <p className="text-white/60">Monitor student welfare and hostel occupancy</p>
        </div>

          <div className="flex items-center gap-3">
            {dorms.length === 0 ? (
              <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-2 text-amber-200 text-sm">No dorms available</div>
            ) : (
              <select 
                value={selectedDormId}
                onChange={(e) => setSelectedDormId(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                {dorms.map(d => (
                  <option key={d.id} value={d.id} className="bg-slate-900">{d.name} ({d.type})</option>
                ))}
              </select>
            )}
            <button
            onClick={() => setShowIncidentModal(true)}
            className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all flex items-center gap-2"
          >
            <MaterialIcon icon="report_problem" />
            Report Incident
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <GlassCard>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MaterialIcon icon="bed" className="text-blue-400" />
                Visual Room Map
              </h2>
              <button 
                onClick={() => setShowRoomModal(true)}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 uppercase tracking-widest"
              >
                + Add Room
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {rooms.map(room => (
                <div key={room.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all group cursor-pointer relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold text-white">{room.room_number}</p>
                      <MaterialIcon icon="meeting_room" className="text-white/20 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-white/40 font-bold uppercase tracking-wider">
                        <span>Occupancy</span>
                        <span>{room.current_occupancy}/{room.capacity}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            (room.current_occupancy / room.capacity) > 0.9 ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${(room.current_occupancy / room.capacity) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <MaterialIcon icon="history" className="text-amber-400" />
              Recent Incidents
            </h2>
            <div className="space-y-4">
              {incidents.slice(0, 5).map(incident => (
                <div key={incident.id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      incident.incident_type === 'health' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {incident.incident_type}
                    </span>
                    <p className="text-[10px] text-white/40">{incident.incident_date}</p>
                  </div>
                  <p className="text-sm font-semibold text-white">Student: {incident.students?.first_name || 'Loading...'}</p>
                  <p className="text-xs text-white/60 line-clamp-2">{incident.description}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Report Dorm Incident</h2>
              <button onClick={() => setShowIncidentModal(false)} className="text-white/40 hover:text-white">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <form onSubmit={handleAddIncident} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Student ID</label>
                <input name="student_id" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none" placeholder="Enter student ID..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Type</label>
                <select name="incident_type" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                  <option value="misbehavior" className="bg-slate-900">Misbehavior</option>
                  <option value="health" className="bg-slate-900">Health Issue</option>
                  <option value="maintenance" className="bg-slate-900">Maintenance</option>
                  <option value="other" className="bg-slate-900">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Description</label>
                <textarea name="description" required rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" placeholder="Details of the incident..."></textarea>
              </div>
              <button type="submit" className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 mt-4 transition-all">
                Submit Report
              </button>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
