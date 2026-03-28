'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function InventoryPage() {
  const { school } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchItems() {
      if (!school?.id) return
      setLoading(true)
      const { data } = await supabase
        .from('assets')
        .select('*')
        .eq('school_id', school.id)
        .eq('asset_type', 'inventory')
        .order('created_at', { ascending: false })
      setItems(data || [])
      setLoading(false)
    }
    fetchItems()
  }, [school?.id])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Inventory</h1>
        <p className="text-[#5c6670] mt-1">School assets and inventory</p>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Condition</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.quantity}</td>
                <td>{item.condition}</td>
                <td>{item.location}</td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={5} className="text-center py-8 text-[#5c6670]">No inventory items</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
