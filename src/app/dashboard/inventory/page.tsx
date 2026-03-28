'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  location: string
  condition: string
  created_at: string
}

const CATEGORIES = ['Furniture', 'Electronics', 'Books', 'Sports Equipment', 'Lab Equipment', 'Kitchen', 'Cleaning', 'Office Supplies', 'Medical', 'Other']
const CONDITIONS = ['New', 'Good', 'Fair', 'Poor', 'Damaged']
const UNITS = ['pieces', 'sets', 'boxes', 'pairs', 'reams', 'liters', 'kg', 'units']

export default function InventoryPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    unit: '',
    location: '',
    condition: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchItems()
  }, [school?.id])

  const fetchItems = async () => {
    if (!school?.id) return
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('school_id', school.id)
        .eq('asset_type', 'inventory')
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('Error fetching inventory:', err)
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    setSubmitting(true)
    try {
      const payload = {
        school_id: school.id,
        asset_type: 'inventory',
        name: formData.name,
        category: formData.category,
        quantity: parseInt(formData.quantity) || 0,
        unit: formData.unit,
        location: formData.location,
        condition: formData.condition
      }

      let error
      if (editingItem) {
        ({ error } = await supabase
          .from('assets')
          .update(payload)
          .eq('id', editingItem.id))
      } else {
        ({ error } = await supabase
          .from('assets')
          .insert(payload))
      }

      if (error) throw error

      toast.success(editingItem ? 'Item updated' : 'Item added')
      closeModal()
      fetchItems()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save item')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Item deleted')
      setDeleteId(null)
      fetchItems()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  const openModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        name: item.name,
        category: item.category,
        quantity: item.quantity.toString(),
        unit: item.unit,
        location: item.location,
        condition: item.condition
      })
    } else {
      setEditingItem(null)
      setFormData({ name: '', category: '', quantity: '', unit: '', location: '', condition: '' })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData({ name: '', category: '', quantity: '', unit: '', location: '', condition: '' })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Inventory</h1>
          <p className="text-[#5c6670] mt-1">School assets and inventory</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          <MaterialIcon icon="add" className="text-lg" />
          Add Item
        </button>
      </div>

      {loading ? (
        <div className="tbl-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Location</th>
                <th>Condition</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td><div className="skeleton h-4 w-32" /></td>
                  <td><div className="skeleton h-4 w-24" /></td>
                  <td><div className="skeleton h-4 w-16" /></td>
                  <td><div className="skeleton h-4 w-16" /></td>
                  <td><div className="skeleton h-4 w-24" /></td>
                  <td><div className="skeleton h-4 w-20" /></td>
                  <td><div className="skeleton h-8 w-20" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="inventory_2" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No inventory items</h3>
          <p className="text-[#5c6670]">Add your first item to get started</p>
          <button onClick={() => openModal()} className="btn btn-primary mt-4">
            <MaterialIcon icon="add" className="text-lg" />
            Add Item
          </button>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Location</th>
                <th>Condition</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td className="font-medium">{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td>{item.location}</td>
                  <td>
                    <span className={`badge ${item.condition === 'New' || item.condition === 'Good' ? 'bg-green-100 text-green-800' : item.condition === 'Poor' || item.condition === 'Damaged' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {item.condition}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => openModal(item)} className="btn btn-sm btn-ghost">
                        <MaterialIcon icon="edit" className="text-lg" />
                      </button>
                      <button onClick={() => setDeleteId(item.id)} className="btn btn-sm btn-ghost text-red-500">
                        <MaterialIcon icon="delete" className="text-lg" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">
                  {editingItem ? 'Edit Item' : 'Add Item'}
                </h2>
                <button onClick={closeModal} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Item Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="input"
                  placeholder="Enter item name"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    className="input"
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    className="input"
                    required
                  >
                    <option value="">Select unit</option>
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="input"
                  placeholder="e.g. Store Room A"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Condition</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({...formData, condition: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select condition</option>
                  {CONDITIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? 'Saving...' : editingItem ? 'Update' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon icon="delete" className="text-2xl text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[#191c1d] mb-2">Delete Item?</h3>
              <p className="text-[#5c6670]">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn btn-danger flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}