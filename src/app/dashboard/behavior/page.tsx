'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function BehaviorPage() {
  const { school } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      if (!school?.id) return
      setLoading(true)
      const { data } = await supabase
        .from('behavior_logs')
        .select('*, students(first_name, last_name), users(full_name)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
      setLogs(data || [])
      setLoading(false)
    }
    fetchLogs()
  }, [school?.id])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Behavior Log</h1>
        <p className="text-[#5c6670] mt-1">Track student behavior and incidents</p>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Incident</th>
              <th>Type</th>
              <th>Date</th>
              <th>Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>{log.students?.first_name} {log.students?.last_name}</td>
                <td>{log.description}</td>
                <td>
                  <span className={`badge ${log.severity === 'positive' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {log.type}
                  </span>
                </td>
                <td>{new Date(log.incident_date).toLocaleDateString()}</td>
                <td>{log.users?.full_name}</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr><td colSpan={5} className="text-center py-8 text-[#5c6670]">No behavior logs</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
