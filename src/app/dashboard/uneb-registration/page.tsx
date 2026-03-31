'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

import MaterialIcon from '@/components/MaterialIcon'

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

  const pendingCount = candidates.filter(c => c.registration_status === 'pending').length
  const registeredCount = candidates.filter(c => c.registration_status === 'registered').length
  const confirmedCount = candidates.filter(c => c.registration_status === 'confirmed').length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">UNEB Registration</h1>
          <p className="text-[#5c6670] mt-1">Register candidates for PLE, UCE & UACE exams</p>
        </div>
        <button onClick={() => setShowRegister(true)} className="btn btn-primary">
          <MaterialIcon icon="add" style={{ fontSize: 18 }} />
          Register Candidates
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-amber-600">{pendingCount}</div>
            <div className="text-sm text-[#5c6670]">Pending</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-blue-600">{registeredCount}</div>
            <div className="text-sm text-[#5c6670]">Registered</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-green-600">{confirmedCount}</div>
            <div className="text-sm text-[#5c6670]">Confirmed</div>
          </div>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">All Candidates</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Exam</th>
                <th>Index #</th>
                <th>Status</th>
                <th>Fees</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map(candidate => (
                <tr key={candidate.id}>
                  <td>{candidate.students?.first_name} {candidate.students?.last_name}</td>
                  <td>{candidate.students?.classes?.name}</td>
                  <td>
                    <span className="badge bg-blue-100 text-blue-800">{candidate.exam_type}</span>
                  </td>
                  <td>{candidate.index_number || '-'}</td>
                  <td>
                    <span className={`badge ${
                      candidate.registration_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      candidate.registration_status === 'registered' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {candidate.registration_status}
                    </span>
                  </td>
                  <td>
                    {candidate.fees_paid ? (
                      <span className="text-green-600">✓ Paid</span>
                    ) : (
                      <span className="text-red-600">✗ Unpaid</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {candidate.registration_status === 'pending' && (
                        <button onClick={() => updateStatus(candidate.id, 'registered')} className="btn-sm bg-blue-500 text-white px-2 py-1 rounded">
                          Register
                        </button>
                      )}
                      {candidate.registration_status === 'registered' && (
                        <button onClick={() => updateStatus(candidate.id, 'confirmed')} className="btn-sm bg-green-500 text-white px-2 py-1 rounded">
                          Confirm
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {candidates.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-8 text-[#5c6670]">No candidates registered</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Register Candidates</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Exam Type</label>
                <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value as any)} className="input">
                  <option value="PLE">PLE (Primary Leaving Exam)</option>
                  <option value="UCE">UCE (Uganda Certificate of Education)</option>
                  <option value="UACE">UACE (Uganda Advanced Certificate of Education)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Select Class</label>
                <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); fetchClassStudents() }} className="input">
                  <option value="">Select class...</option>
                  <option value="p7">Primary 7</option>
                  <option value="s4">Senior 4</option>
                  <option value="s6">Senior 6</option>
                </select>
              </div>

              {students.length > 0 && (
                <div>
                  <p className="text-sm text-[#5c6670] mb-2">{students.length} students will be registered for {selectedExam}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRegister(false)} className="btn flex-1 bg-gray-100">Cancel</button>
              <button onClick={registerCandidates} disabled={registering || !students.length} className="btn btn-primary flex-1">
                {registering ? 'Registering...' : `Register ${students.length} Students`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
