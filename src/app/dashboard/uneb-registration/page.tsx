'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/EmptyState'

interface Candidate {
  id: string
  student_id: string
  exam_type: 'PLE' | 'UCE' | 'UACE'
  index_number?: string
  registration_status: 'pending' | 'registered' | 'confirmed'
  fees_paid: boolean
  photo_url?: string
  students?: { first_name: string; last_name: string; gender: string; classes: { name: string } }
}

export default function UNEBRegistrationPage() {
  const { school } = useAuth()
  const toast = useToast()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [selectedExam, setSelectedExam] = useState<'PLE' | 'UCE' | 'UACE'>('UCE')
  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState<any[]>([])
  const [registering, setRegistering] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const fetchCandidates = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('uneb_candidates')
      .select('*, students(first_name, last_name, gender, classes(name))')
      .eq('school_id', school?.id)
      .order('created_at', { ascending: false })
    setCandidates(data || [])
    setLoading(false)
  }, [school?.id])

  useEffect(() => {
    if (school?.id) fetchCandidates()
  }, [school?.id, fetchCandidates])

  const fetchClassStudents = async () => {
    if (!selectedClass) return
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, gender, classes(name)')
      .eq('school_id', school?.id)
      .eq('class_id', selectedClass)
      .eq('status', 'active')
    setStudents(data || [])
  }

  const registerCandidates = async () => {
    if (students.length === 0) {
      toast.error('No students selected')
      return
    }

    setRegistering(true)
    try {
      const records = students.map(s => ({
        school_id: school?.id,
        student_id: s.id,
        exam_type: selectedExam,
        registration_status: 'pending',
        fees_paid: false,
        academic_year: new Date().getFullYear().toString()
      }))

      const { error } = await supabase.from('uneb_candidates').insert(records)
      if (error) throw error

      toast.success(`${students.length} candidates registered for ${selectedExam}`)
      setShowRegister(false)
      fetchCandidates()
    } catch (err: any) {
      toast.error(err.message || 'Failed to register candidates')
    } finally {
      setRegistering(false)
    }
  }

  const updateStatus = async (id: string, status: 'registered' | 'confirmed') => {
    await supabase.from('uneb_candidates').update({ registration_status: status }).eq('id', id)
    fetchCandidates()
    toast.success(`Candidate ${status}`)
  }

  const filteredCandidates = candidates.filter(c => {
    if (activeTab === 'all') return true
    return c.registration_status === activeTab
  })

  const pendingCount = candidates.filter(c => c.registration_status === 'pending').length
  const registeredCount = candidates.filter(c => c.registration_status === 'registered').length
  const confirmedCount = candidates.filter(c => c.registration_status === 'confirmed').length

  const tabs = [
    { id: 'all', label: 'All', count: candidates.length },
    { id: 'pending', label: 'Pending', count: pendingCount },
    { id: 'registered', label: 'Registered', count: registeredCount },
    { id: 'confirmed', label: 'Confirmed', count: confirmedCount },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader 
        title="UNEB Registration"
        subtitle="Register candidates for PLE, UCE & UACE exams"
        actions={
          <Button onClick={() => setShowRegister(true)} icon={<MaterialIcon icon="add" />}>
            Register Candidates
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-amber-600">{pendingCount}</div>
          <div className="text-sm text-[var(--t3)]">Pending</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{registeredCount}</div>
          <div className="text-sm text-[var(--t3)]">Registered</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{confirmedCount}</div>
          <div className="text-sm text-[var(--t3)]">Confirmed</div>
        </Card>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <Card>
        <CardHeader>
          <CardTitle>All Candidates</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <TableSkeleton rows={5} />
          ) : filteredCandidates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--surface-container-low)]">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Student</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Class</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Exam</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Index #</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Status</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Fees</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map(candidate => (
                    <tr key={candidate.id} className="border-t border-[var(--border)]">
                      <td className="p-3">{candidate.students?.first_name} {candidate.students?.last_name}</td>
                      <td className="p-3">{candidate.students?.classes?.name}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[var(--navy-soft)] text-[var(--navy)]">{candidate.exam_type}</span>
                      </td>
                      <td className="p-3">{candidate.index_number || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          candidate.registration_status === 'confirmed' ? 'bg-[var(--green-soft)] text-[var(--green)]' :
                          candidate.registration_status === 'registered' ? 'bg-[var(--navy-soft)] text-[var(--navy)]' :
                          'bg-[var(--amber-soft)] text-[var(--amber)]'
                        }`}>
                          {candidate.registration_status}
                        </span>
                      </td>
                      <td className="p-3">
                        {candidate.fees_paid ? (
                          <span className="text-green-600">✓ Paid</span>
                        ) : (
                          <span className="text-red-600">✗ Unpaid</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {candidate.registration_status === 'pending' && (
                            <Button size="sm" onClick={() => updateStatus(candidate.id, 'registered')}>
                              Register
                            </Button>
                          )}
                          {candidate.registration_status === 'registered' && (
                            <Button size="sm" onClick={() => updateStatus(candidate.id, 'confirmed')}>
                              Confirm
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState 
              icon="group"
              title="No candidates registered"
              description="Register students for UNEB exams."
            />
          )}
        </CardBody>
      </Card>

      {showRegister && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-[var(--t1)]">Register Candidates</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--t1)]">Exam Type</label>
                <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value as 'PLE' | 'UCE' | 'UACE')} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--t1)]">
                  <option value="PLE">PLE (Primary Leaving Exam)</option>
                  <option value="UCE">UCE (Uganda Certificate of Education)</option>
                  <option value="UACE">UACE (Uganda Advanced Certificate of Education)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--t1)]">Select Class</label>
                <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); fetchClassStudents() }} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--t1)]">
                  <option value="">Select class...</option>
                  <option value="p7">Primary 7</option>
                  <option value="s4">Senior 4</option>
                  <option value="s6">Senior 6</option>
                </select>
              </div>

              {students.length > 0 && (
                <div>
                  <p className="text-sm text-[var(--t3)] mb-2">{students.length} students will be registered for {selectedExam}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setShowRegister(false)}>Cancel</Button>
              <Button className="flex-1" onClick={registerCandidates} disabled={registering || !students.length} loading={registering}>
                {students.length > 0 ? `Register ${students.length} Students` : 'Select a class'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}