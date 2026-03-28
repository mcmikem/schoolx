'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function HealthPage() {
  const { school } = useAuth()
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRecords() {
      if (!school?.id) return
      setLoading(true)
      const { data } = await supabase
        .from('health_records')
        .select('*, students(first_name, last_name), users(full_name)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
      setRecords(data || [])
      setLoading(false)
    }
    fetchRecords()
  }, [school?.id])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Health Records</h1>
        <p className="text-[#5c6670] mt-1">Track student health information</p>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Type</th>
              <th>Details</th>
              <th>Date</th>
              <th>Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {records.map(record => (
              <tr key={record.id}>
                <td>{record.students?.first_name} {record.students?.last_name}</td>
                <td>{record.record_type}</td>
                <td>{record.notes}</td>
                <td>{new Date(record.record_date).toLocaleDateString()}</td>
                <td>{record.users?.full_name}</td>
              </tr>
            ))}
            {records.length === 0 && !loading && (
              <tr><td colSpan={5} className="text-center py-8 text-[#5c6670]">No health records</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
