'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface Asset {
  id: string
  name: string
  category: string
  location: string
  condition: string
  purchase_date: string
  value: number
  notes: string
  created_at: string
}

const categories = [
  'Furniture',
  'Electronics',
  'Books',
  'Sports Equipment',
  'Laboratory',
  'Kitchen',
  'Office',
  'Other'
]

const conditions = [
  'New',
  'Good',
  'Fair',
  'Poor',
  'Needs Repair'
]

export default function AssetsPage() {
  const { school } = useAuth()
  const toast = useToast()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [newAsset, setNewAsset] = useState({
    name: '',
    category: '',
    location: '',
    condition: 'Good',
    purchase_date: '',
    value: '',
    notes: '',
  })

  useEffect(() => {
    fetchAssets()
  }, [school?.id])

  const fetchAssets = async () => {
    if (!school?.id || !supabase) return
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAssets(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id || !supabase) return

    try {
      const { error } = await supabase.from('assets').insert({
        school_id: school.id,
        name: newAsset.name,
        category: newAsset.category,
        location: newAsset.location,
        condition: newAsset.condition,
        purchase_date: newAsset.purchase_date || null,
        value: Number(newAsset.value) || 0,
        notes: newAsset.notes || null,
      })

      if (error) throw error

      toast.success('Asset added')
      setShowModal(false)
      setNewAsset({ name: '', category: '', location: '', condition: 'Good', purchase_date: '', value: '', notes: '' })
      fetchAssets()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add asset')
    }
  }

  const deleteAsset = async (id: string) => {
    if (!confirm('Delete this asset?') || !supabase) return
    try {
      const { error } = await supabase.from('assets').delete().eq('id', id)
      if (error) throw error
      setAssets(assets.filter(a => a.id !== id))
      toast.success('Asset deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const filteredAssets = assets.filter(a => {
    if (filterCategory === 'all') return true
    return a.category === filterCategory
  })

  const totalValue = assets.reduce((sum, a) => sum + Number(a.value || 0), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Asset Register</h1>
          <p className="text-[#5c6670] mt-1">Track school property and equipment</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <MaterialIcon icon="add" />
          Add Asset
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value">{assets.length}</div>
          <div className="stat-label">Total Assets</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value">UGX {(totalValue / 1000000).toFixed(1)}M</div>
          <div className="stat-label">Total Value</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value text-yellow-600">{assets.filter(a => a.condition === 'Needs Repair').length}</div>
          <div className="stat-label">Need Repair</div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input sm:w-48">
          <option value="all">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Assets List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton w-full h-4 mb-2" />
              <div className="skeleton w-3/4 h-3" />
            </div>
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#002045] mb-2">No assets recorded</h3>
          <p className="text-[#5c6670]">Add your first asset</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead className="bg-[#f8fafb]">
              <tr>
                <th>Asset Name</th>
                <th>Category</th>
                <th>Location</th>
                <th>Condition</th>
                <th>Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id}>
                  <td className="font-medium text-[#002045]">{asset.name}</td>
                  <td className="text-[#5c6670]">{asset.category}</td>
                  <td className="text-[#5c6670]">{asset.location}</td>
                  <td>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      asset.condition === 'New' || asset.condition === 'Good' ? 'bg-[#e8f5e9] text-[#006e1c]' :
                      asset.condition === 'Fair' ? 'bg-[#fff3e0] text-[#e65100]' :
                      'bg-[#ffebee] text-[#c62828]'
                    }`}>
                      {asset.condition}
                    </span>
                  </td>
                  <td className="font-medium">UGX {Number(asset.value || 0).toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() => deleteAsset(asset.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#002045]">Add Asset</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Asset Name</label>
                <input
                  type="text"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                  className="input"
                  placeholder="e.g. Dell Laptop, Office Desk"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select 
                    value={newAsset.category}
                    onChange={(e) => setNewAsset({...newAsset, category: e.target.value})}
                    className="input"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Condition</label>
                  <select 
                    value={newAsset.condition}
                    onChange={(e) => setNewAsset({...newAsset, condition: e.target.value})}
                    className="input"
                  >
                    {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Location</label>
                <input
                  type="text"
                  value={newAsset.location}
                  onChange={(e) => setNewAsset({...newAsset, location: e.target.value})}
                  className="input"
                  placeholder="e.g. Staff Room, Lab"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Purchase Date</label>
                  <input
                    type="date"
                    value={newAsset.purchase_date}
                    onChange={(e) => setNewAsset({...newAsset, purchase_date: e.target.value})}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Value (UGX)</label>
                  <input
                    type="number"
                    value={newAsset.value}
                    onChange={(e) => setNewAsset({...newAsset, value: e.target.value})}
                    className="input"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Add Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
