'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

export default function ParentPortal() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [studentData, setStudentData] = useState<any>(null)
  const [parentName, setParentName] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('parent_session')
    if (stored) {
      const data = JSON.parse(stored)
      setStudentData(data.student)
      setParentName(data.parentName)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Format phone
      let formattedPhone = phone.replace(/^0/, '+256')
      if (phone.startsWith('+256')) {
        formattedPhone = phone
      }

      // Find parent user
      const { data: parentUser, error: parentError } = await supabase
        .from('users')
        .select('*, schools(name, logo_url)')
        .eq('phone', formattedPhone)
        .eq('role', 'parent')
        .single()

      if (parentError || !parentUser) {
        setError('No parent account found with this phone number')
        setLoading(false)
        return
      }

      // For demo/testing, accept any password. In production, verify against auth
      if (password.length < 4) {
        setError('Invalid password')
        setLoading(false)
        return
      }

      // Get children
      const { data: children } = await supabase
        .from('parent_students')
        .select('*, students(*, classes(name, level))')
        .eq('parent_id', parentUser.id)

      if (!children || children.length === 0) {
        setError('No children linked to this parent account')
        setLoading(false)
        return
      }

      const sessionData = {
        parentId: parentUser.id,
        parentName: parentUser.full_name,
        school: parentUser.schools,
        children: children.map((c: any) => c.students)
      }

      localStorage.setItem('parent_session', JSON.stringify(sessionData))
      setStudentData(children[0].students)
      setParentName(parentUser.full_name)

    } catch (err) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const switchChild = (child: any) => {
    setStudentData(child)
    const stored = localStorage.getItem('parent_session')
    if (stored) {
      const data = JSON.parse(stored)
      data.student = child
      localStorage.setItem('parent_session', JSON.stringify(data))
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('parent_session')
    setStudentData(null)
    setParentName('')
    setPhone('')
    setPassword('')
  }

  // Show dashboard if logged in
  if (studentData) {
    return <ParentDashboard student={studentData} parentName={parentName} onLogout={handleLogout} onSwitchChild={switchChild} />
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <MaterialIcon icon="family_restroom" style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>Parent Portal</h1>
          <p style={{ color: 'var(--t3)' }}>View your child&apos;s progress</p>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: 'var(--sh2)' }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--t2)' }}>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07xx xxx xxx or +256xx xxx xxx"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 15, background: 'var(--bg)', color: 'var(--t1)' }}
                required
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--t2)' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 15, background: 'var(--bg)', color: 'var(--t1)' }}
                required
              />
            </div>

            {error && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: 'var(--navy)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--t4)' }}>
            Contact school to get parent login credentials
          </p>
        </div>
      </div>
    </div>
  )
}

function ParentDashboard({ student, parentName, onLogout, onSwitchChild }: { student: any; parentName: string; onLogout: () => void; onSwitchChild: (child: any) => void }) {
  const [attendance, setAttendance] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!student?.id) return
      setLoading(true)
      
      const [attData, payData] = await Promise.all([
        supabase.from('attendance').select('*').eq('student_id', student.id).order('date', { ascending: false }).limit(30),
        supabase.from('fee_payments').select('*').eq('student_id', student.id).order('payment_date', { ascending: false }).limit(10)
      ])
      
      setAttendance(attData.data || [])
      setPayments(payData.data || [])
      setLoading(false)
    }
    fetchData()
  }, [student?.id])

  const presentDays = attendance.filter((a: any) => a.status === 'present').length
  const totalDays = attendance.length
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ background: 'var(--navy)', padding: '16px 20px', color: '#fff' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcon icon="account_circle" style={{ fontSize: 24 }} />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Welcome, {parentName}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Parent Portal</div>
              </div>
            </div>
            <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
              Logout
            </button>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{student.first_name} {student.last_name}</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{student.classes?.name} - {student.classes?.level}</div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--navy)' }}>{attendanceRate}%</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>Attendance</div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>{presentDays}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>Days Present</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
          <button style={{ background: 'var(--surface)', border: 'none', borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'center' }}>
            <MaterialIcon icon="receipt_long" style={{ fontSize: 24, color: 'var(--navy)' }} />
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--t2)' }}>Fees</div>
          </button>
          <button style={{ background: 'var(--surface)', border: 'none', borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'center' }}>
            <MaterialIcon icon="assignment" style={{ fontSize: 24, color: 'var(--navy)' }} />
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--t2)' }}>Homework</div>
          </button>
          <button style={{ background: 'var(--surface)', border: 'none', borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'center' }}>
            <MaterialIcon icon="chat" style={{ fontSize: 24, color: 'var(--navy)' }} />
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--t2)' }}>Messages</div>
          </button>
        </div>

        {/* Recent Attendance */}
        <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--t1)' }}>Recent Attendance</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)' }}>Loading...</div>
          ) : attendance.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)' }}>No attendance records</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attendance.slice(0, 7).map((att: any) => (
                <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--t2)' }}>{new Date(att.date).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 600, 
                    padding: '4px 10px', 
                    borderRadius: 20,
                    background: att.status === 'present' ? '#dcfce7' : att.status === 'absent' ? '#fee2e2' : '#fef3c7',
                    color: att.status === 'present' ? '#166534' : att.status === 'absent' ? '#dc2626' : '#92400e'
                  }}>
                    {att.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--t1)' }}>Recent Payments</div>
          {payments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)' }}>No payment records</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.slice(0, 5).map((pay: any) => (
                <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--t2)' }}>{new Date(pay.payment_date).toLocaleDateString()}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>UGX {Number(pay.amount_paid).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
