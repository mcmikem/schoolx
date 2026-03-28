'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

export default function SchemeOfWorkPage() {
  const { school } = useAuth()
  const [schemes, setSchemes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSchemes() {
      if (!school?.id) return
      setLoading(true)
      const { data } = await supabase
        .from('scheme_of_work')
        .select('*, subjects(name), classes(name)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
      setSchemes(data || [])
      setLoading(false)
    }
    fetchSchemes()
  }, [school?.id])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Scheme of Work</h1>
        <p className="text-[#5c6670] mt-1">Subject outlines for the term</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schemes.map(scheme => (
          <div key={scheme.id} className="card">
            <div className="card-header">
              <div>
                <div className="card-title">{scheme.subjects?.name}</div>
                <div className="card-sub">{scheme.classes?.name} - Week {scheme.week}</div>
              </div>
            </div>
            <div className="card-body">
              <p className="text-sm text-[#5c6670]">{scheme.topic}</p>
            </div>
          </div>
        ))}
        {schemes.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-[#5c6670]">
            <MaterialIcon icon="list_alt" style={{ fontSize: 48, opacity: 0.5 }} />
            <p className="mt-2">No scheme of work yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
