'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function TransportPage() {
  const { school } = useAuth()
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRoutes() {
      if (!school?.id) return
      setLoading(true)
      const { data } = await supabase
        .from('transport_routes')
        .select('*, students(first_name, last_name)')
        .eq('school_id', school.id)
        .order('route_name')
      setRoutes(data || [])
      setLoading(false)
    }
    fetchRoutes()
  }, [school?.id])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Transport</h1>
        <p className="text-[#5c6670] mt-1">Manage transport routes and students</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {routes.map(route => (
          <div key={route.id} className="card">
            <div className="card-header">
              <div className="card-title">{route.route_name}</div>
              <div className="card-sub">UGX {route.fee?.toLocaleString()}/term</div>
            </div>
            <div className="card-body">
              <p className="text-sm text-[#5c6670]">{route.description}</p>
              <div className="mt-2 text-xs text-[#5c6670]">
                Pickup: {route.pickup_time} | Drop: {route.dropoff_time}
              </div>
            </div>
          </div>
        ))}
        {routes.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-[#5c6670]">
            <MaterialIcon icon="directions_bus" style={{ fontSize: 48, opacity: 0.5 }} />
            <p className="mt-2">No transport routes</p>
          </div>
        )}
      </div>
    </div>
  )
}
