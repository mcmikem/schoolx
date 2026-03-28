'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function AllocationsPage() {
  const { school } = useAuth()
  const [allocations, setAllocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAllocations() {
      if (!school?.id) return
      setLoading(true)
      const { data } = await supabase
        .from('subject_allocations')
        .select('*, users(full_name), subjects(name), classes(name)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
      setAllocations(data || [])
      setLoading(false)
    }
    fetchAllocations()
  }, [school?.id])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Subject Allocations</h1>
        <p className="text-[#5c6670] mt-1">Assign teachers to subjects and classes</p>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Subject</th>
              <th>Class</th>
              <th>Academic Year</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map(alloc => (
              <tr key={alloc.id}>
                <td>{alloc.users?.full_name}</td>
                <td>{alloc.subjects?.name}</td>
                <td>{alloc.classes?.name}</td>
                <td>{alloc.academic_year}</td>
              </tr>
            ))}
            {allocations.length === 0 && !loading && (
              <tr><td colSpan={4} className="text-center py-8 text-[#5c6670]">No allocations yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
