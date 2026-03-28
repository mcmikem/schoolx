'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface Dorm {
  id: string
  name: string
  type: 'boys' | 'girls'
  capacity: number
  warden_id?: string
  location?: string
}

interface DormStudent {
  id: string
  dorm_id: string
  student_id: string
  bed_number?: string
  students?: {
    first_name: string
    last_name: string
    gender: string
    class_id?: string
    classes?: { name: string }
  }
}

export default function DormPage() {
  const { school } = useAuth()
  const toast = useToast()
  const [dorms, setDorms] = useState<Dorm[]>([])
  const [dormStudents, setDormStudents] = useState<DormStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDorm, setShowAddDorm] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [selectedDorm, setSelectedDorm] = useState<Dorm | null>(null)
  const [newDorm, setNewDorm] = useState({ name: '', type: 'boys' as 'boys' | 'girls', capacity: 30, location: '' })

  const fetchDorms = async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('dorms')
        .select('*')
        .eq('school_id', school.id)
        .order('name')
      setDorms(data || [])
      
      const { data: ds } = await supabase
        .from('dorm_students')
        .select('*, students(first_name, last_name, gender, class_id, classes(name))')
        .in('dorm_id', (data || []).map(d => d.id))
      setDormStudents(ds || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDorms()
  }, [school?.id])

  const handleAddDorm = async () => {
    if (!school?.id || !newDorm.name) return
    try {
      const { error } = await supabase.from('dorms').insert({
        school_id: school.id,
        name: newDorm.name,
        type: newDorm.type,
        capacity: newDorm.capacity,
        location: newDorm.location
      })
      if (error) throw error
      toast.success('Dorm added successfully')
      setShowAddDorm(false)
      setNewDorm({ name: '', type: 'boys', capacity: 30, location: '' })
      fetchDorms()
    } catch (err) {
      toast.error('Failed to add dorm')
    }
  }

  const handleDeleteDorm = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dorm?')) return
    try {
      const { error } = await supabase.from('dorms').delete().eq('id', id)
      if (error) throw error
      toast.success('Dorm deleted')
      fetchDorms()
    } catch (err) {
      toast.error('Failed to delete dorm')
    }
  }

  const getStudentsInDorm = (dormId: string) => {
    return dormStudents.filter(ds => ds.dorm_id === dormId)
  }

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <div className="ph-title">Dormitory Management</div>
          <div className="ph-sub">Manage boarding facilities and students</div>
        </div>
        <div className="ph-actions">
          <button onClick={() => setShowAddDorm(true)} className="btn btn-primary">
            <MaterialIcon icon="add" style={{ fontSize: '16px' }} />
            Add Dorm
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div className="skeleton h-6 w-32 mb-4"></div>
              <div className="skeleton h-4 w-24"></div>
            </div>
          ))}
        </div>
      ) : dorms.length === 0 ? (
        <div className="card" style={{ padding: 40 }}>
          <div className="empty-state">
            <div className="empty-state-icon">
              <MaterialIcon icon="home" style={{ fontSize: 24 }} />
            </div>
            <div className="empty-title">No Dorms Added</div>
            <div className="empty-sub">Add your first dormitory to get started</div>
            <button onClick={() => setShowAddDorm(true)} className="btn btn-primary" style={{ marginTop: 16 }}>
              <MaterialIcon icon="add" style={{ fontSize: '16px' }} />
              Add Dorm
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {dorms.map(dorm => {
            const students = getStudentsInDorm(dorm.id)
            const occupancy = Math.round((students.length / dorm.capacity) * 100)
            
            return (
              <div key={dorm.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>{dorm.name}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: dorm.type === 'boys' ? 'rgba(23,50,95,.1)' : 'rgba(192,57,43,.1)', color: dorm.type === 'boys' ? 'var(--navy)' : 'var(--red)' }}>
                      {dorm.type === 'boys' ? 'Boys' : 'Girls'}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteDorm(dorm.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>delete</MaterialIcon>
                  </button>
                </div>
                
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: 'var(--t3)' }}>Occupancy</span>
                    <span style={{ fontWeight: 600, color: 'var(--t1)' }}>{students.length} / {dorm.capacity}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${occupancy}%`, height: '100%', borderRadius: 99, background: occupancy >= 90 ? 'var(--red)' : occupancy >= 70 ? 'var(--amber)' : 'var(--green)' }}></div>
                  </div>
                  {dorm.location && (
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MaterialIcon style={{ fontSize: 12 }}>location_on</MaterialIcon>
                      {dorm.location}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                  <button onClick={() => { setSelectedDorm(dorm); setShowAssign(true) }} style={{ flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 500, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--t2)' }}>
                    Assign
                  </button>
                  <button style={{ flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 500, background: 'var(--navy-soft)', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'var(--navy)' }}>
                    View All
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAddDorm && (
        <div className="modal-overlay" onClick={() => setShowAddDorm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700 }}>Add New Dorm</div>
              <button onClick={() => setShowAddDorm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>close</MaterialIcon>
              </button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6, display: 'block' }}>Dorm Name</label>
                <input type="text" value={newDorm.name} onChange={e => setNewDorm({...newDorm, name: e.target.value})} placeholder="e.g., Senior Boys Dorm" className="input" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6, display: 'block' }}>Type</label>
                  <select value={newDorm.type} onChange={e => setNewDorm({...newDorm, type: e.target.value as 'boys' | 'girls'})} className="input">
                    <option value="boys">Boys</option>
                    <option value="girls">Girls</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6, display: 'block' }}>Capacity</label>
                  <input type="number" value={newDorm.capacity} onChange={e => setNewDorm({...newDorm, capacity: parseInt(e.target.value) || 30})} className="input" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6, display: 'block' }}>Location (Optional)</label>
                <input type="text" value={newDorm.location} onChange={e => setNewDorm({...newDorm, location: e.target.value})} placeholder="e.g., Block A, Ground Floor" className="input" />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddDorm(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleAddDorm} className="btn btn-primary">Add Dorm</button>
            </div>
          </div>
        </div>
      )}

      {showAssign && selectedDorm && (
        <div className="modal-overlay" onClick={() => setShowAssign(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700 }}>Assign Students to {selectedDorm.name}</div>
              <button onClick={() => setShowAssign(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>close</MaterialIcon>
              </button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                <MaterialIcon style={{ fontSize: 32, color: 'var(--t4)', marginBottom: 8 }}>group</MaterialIcon>
                <div>Student selection - Select from enrolled students</div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAssign(false)} className="btn btn-ghost">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
