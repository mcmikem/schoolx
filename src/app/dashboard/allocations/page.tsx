'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'

interface Allocation {
  id: string
  academic_year: string
  users?: { full_name: string }
  subjects?: { name: string }
  classes?: { name: string }
}

export default function AllocationsPage() {
  const { school } = useAuth()
  const [allocations, setAllocations] = useState<Allocation[]>([])
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
      <PageHeader 
        title="Subject Allocations" 
        subtitle="Assign teachers to subjects and classes"
      />

      <Card>
        <CardBody>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : allocations.length === 0 ? (
            <EmptyState 
              icon="assignment" 
              title="No allocations yet"
              description="Assign teachers to subjects and classes to get started"
            />
          ) : (
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
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}