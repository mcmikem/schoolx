'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button, Input, Select } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Tabs, TabPanel } from '@/components/ui/Tabs'

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
  const [activeTab, setActiveTab] = useState('all')
  const [newAsset, setNewAsset] = useState({
    name: '',
    category: '',
    location: '',
    condition: 'Good',
    purchase_date: '',
    value: '',
    notes: '',
  })

  const fetchAssets = useCallback(async () => {
    if (!school?.id || !supabase) return
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116') {
          setAssets([])
          return
        }
        throw error
      }
      setAssets(data || [])
    } catch (err) {
      console.error('Error:', err)
      setAssets([])
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

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
    if (activeTab === 'all') return true
    return a.category === activeTab
  })

  const totalValue = assets.reduce((sum, a) => sum + Number(a.value || 0), 0)

  const tabs = [
    { id: 'all', label: 'All Assets', count: assets.length },
    ...categories.map(c => ({ id: c, label: c, count: assets.filter(a => a.category === c).length }))
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader 
        title="Asset Register" 
        subtitle="Track school property and equipment"
        actions={
          <Button onClick={() => setShowModal(true)} icon={<MaterialIcon icon="add" />}>
            Add Asset
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-2xl font-bold text-[var(--on-surface)]">{assets.length}</div>
          <div className="text-sm text-[var(--t3)]">Total Assets</div>
        </Card>
        <Card>
          <div className="text-2xl font-bold text-[var(--on-surface)]">UGX {(totalValue / 1000000).toFixed(1)}M</div>
          <div className="text-sm text-[var(--t3)]">Total Value</div>
        </Card>
        <Card>
          <div className="text-2xl font-bold text-[var(--amber)]">{assets.filter(a => a.condition === 'Needs Repair').length}</div>
          <div className="text-sm text-[var(--t3)]">Need Repair</div>
        </Card>
      </div>

      <Tabs tabs={tabs.filter(t => t.count > 0)} activeTab={activeTab} onChange={setActiveTab} />

      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredAssets.length === 0 ? (
        <Card>
          <EmptyState
            icon="category"
            title="No assets recorded"
            description="Add your first asset to start tracking"
            action={{ label: 'Add Asset', onClick: () => setShowModal(true) }}
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--surface-container)]">
                <tr>
                  <th className="p-4 text-sm font-semibold text-[var(--t2)]">Asset Name</th>
                  <th className="p-4 text-sm font-semibold text-[var(--t2)]">Category</th>
                  <th className="p-4 text-sm font-semibold text-[var(--t2)]">Location</th>
                  <th className="p-4 text-sm font-semibold text-[var(--t2)]">Condition</th>
                  <th className="p-4 text-sm font-semibold text-[var(--t2)]">Value</th>
                  <th className="p-4 text-sm font-semibold text-[var(--t2)]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-[var(--surface-container)] transition-colors">
                    <td className="p-4 font-medium text-[var(--on-surface)]">{asset.name}</td>
                    <td className="p-4 text-[var(--t3)]">{asset.category}</td>
                    <td className="p-4 text-[var(--t3)]">{asset.location}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        asset.condition === 'New' || asset.condition === 'Good' ? 'bg-[var(--green-soft)] text-[var(--green)]' :
                        asset.condition === 'Fair' ? 'bg-[var(--amber-soft)] text-[var(--amber)]' :
                        'bg-[var(--red-soft)] text-[var(--red)]'
                      }`}>
                        {asset.condition}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-[var(--on-surface)]">UGX {Number(asset.value || 0).toLocaleString()}</td>
                    <td className="p-4">
                      <button
                        onClick={() => deleteAsset(asset.id)}
                        className="p-2 text-[var(--t3)] hover:text-[var(--error)] rounded-lg hover:bg-[var(--red-soft)]"
                      >
                        <MaterialIcon icon="delete" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">Add Asset</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-[var(--t3)] hover:text-[var(--on-surface)]">
                  <MaterialIcon icon="close" />
                </button>
              </div>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Asset Name"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                  placeholder="e.g. Dell Laptop, Office Desk"
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Category"
                    value={newAsset.category}
                    onChange={(e) => setNewAsset({...newAsset, category: e.target.value})}
                    options={[{ value: '', label: 'Select category' }, ...categories.map(c => ({ value: c, label: c }))]}
                    required
                  />
                  <Select
                    label="Condition"
                    value={newAsset.condition}
                    onChange={(e) => setNewAsset({...newAsset, condition: e.target.value})}
                    options={conditions.map(c => ({ value: c, label: c }))}
                  />
                </div>

                <Input
                  label="Location"
                  value={newAsset.location}
                  onChange={(e) => setNewAsset({...newAsset, location: e.target.value})}
                  placeholder="e.g. Staff Room, Lab"
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Purchase Date"
                    type="date"
                    value={newAsset.purchase_date}
                    onChange={(e) => setNewAsset({...newAsset, purchase_date: e.target.value})}
                  />
                  <Input
                    label="Value (UGX)"
                    type="number"
                    value={newAsset.value}
                    onChange={(e) => setNewAsset({...newAsset, value: e.target.value})}
                    placeholder="0"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" className="flex-1">Add Asset</Button>
                </div>
              </form>
            </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}