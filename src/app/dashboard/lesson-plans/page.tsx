'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function LessonPlansPage() {
  const { school, user } = useAuth()
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPlans() {
      if (!school?.id) return
      setLoading(true)
      const { data } = await supabase
        .from('lesson_plans')
        .select('*, subjects(name), classes(name), users(full_name)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
      setPlans(data || [])
      setLoading(false)
    }
    fetchPlans()
  }, [school?.id])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Lesson Plans</h1>
        <p className="text-[#5c6670] mt-1">Plan and track lessons</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div key={plan.id} className="card">
            <div className="card-header">
              <div>
                <div className="card-title">{plan.title}</div>
                <div className="card-sub">{plan.subjects?.name} - {plan.classes?.name}</div>
              </div>
            </div>
            <div className="card-body">
              <p className="text-sm text-[#5c6670]">{plan.description}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-[#5c6670]">
                <MaterialIcon icon="person" style={{ fontSize: 14 }} />
                {plan.users?.full_name}
              </div>
            </div>
          </div>
        ))}
        {plans.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-[#5c6670]">
            <MaterialIcon icon="assignment" style={{ fontSize: 48, opacity: 0.5 }} />
            <p className="mt-2">No lesson plans yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
