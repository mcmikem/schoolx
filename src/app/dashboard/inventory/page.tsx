'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { useAssets, useInventory } from '@/lib/hooks'
import GlassCard from '@/components/GlassCard'
import { Asset } from '@/types'

function MaterialIcon({ icon, className }: { icon: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{icon}</span>
}

export default function InventoryPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { assets, loading: loadingAssets } = useAssets(school?.id)
  const { transactions, loading: loadingTx, recordTransaction } = useInventory(school?.id)
  
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('out')

  const handleTransactionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedAsset) return

    const formData = new FormData(e.currentTarget)
    const quantity = Number(formData.get('quantity'))
    
    const result = await recordTransaction({
      school_id: school!.id,
      asset_id: selectedAsset.id,
      transaction_type: transactionType,
      quantity: quantity,
      notes: formData.get('notes') as string,
      transaction_date: new Date().toISOString().split('T')[0],
      recorded_by: user!.id
    })

    if (result.success) {
      toast.success(`Inventory updated: ${selectedAsset.name}`)
      setShowTransactionModal(false)
    } else {
      toast.error('Transaction failed')
    }
  }

  if (loadingAssets || loadingTx) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  const lowStockItems = assets.filter(a => a.is_consumable && a.current_stock <= a.min_stock_level)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Inventory & Supplies
          </h1>
          <p className="text-white/60">Track school assets and consumable supplies</p>
        </div>

        {lowStockItems.length > 0 && (
          <GlassCard className="bg-red-500/10 border-red-500/20 py-3 px-6 flex items-center gap-3">
            <MaterialIcon icon="warning" className="text-red-400" />
            <div>
              <p className="text-xs text-red-400 font-bold uppercase tracking-wider">Low Stock Alert</p>
              <p className="text-sm text-white font-medium">{lowStockItems.length} items need restocking</p>
            </div>
          </GlassCard>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <GlassCard>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <MaterialIcon icon="inventory_2" className="text-purple-400" />
                Current Stock
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-sm uppercase tracking-wider">
                    <th className="pb-4 font-semibold">Item Name</th>
                    <th className="pb-4 font-semibold text-center">In Stock</th>
                    <th className="pb-4 font-semibold">Category</th>
                    <th className="pb-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-4">
                        <div>
                          <p className="font-semibold text-white">{asset.name}</p>
                          {asset.is_consumable && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold uppercase tracking-wider">Consumable</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <div className={`inline-block px-3 py-1 rounded-lg font-bold ${
                          asset.is_consumable && asset.current_stock <= asset.min_stock_level 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'bg-white/10 text-white'
                        }`}>
                          {asset.current_stock}
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-xs text-white/60 capitalize">{asset.category}</span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setSelectedAsset(asset); setTransactionType('in'); setShowTransactionModal(true); }}
                            className="p-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                            title="Add Stock"
                          >
                            <MaterialIcon icon="add" />
                          </button>
                          <button 
                            onClick={() => { setSelectedAsset(asset); setTransactionType('out'); setShowTransactionModal(true); }}
                            className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Issue/Use"
                          >
                            <MaterialIcon icon="remove" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
              <MaterialIcon icon="history" className="text-blue-400" />
              Recent Activity
            </h2>
            <div className="space-y-4">
              {transactions.slice(0, 8).map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className={`p-2 rounded-lg ${tx.transaction_type === 'in' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    <MaterialIcon icon={tx.transaction_type === 'in' ? 'arrow_downward' : 'arrow_upward'} className="text-sm" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{tx.asset?.name || 'Item'}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">{tx.transaction_type} · {tx.quantity} units</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/40">{new Date(tx.transaction_date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {showTransactionModal && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {transactionType === 'in' ? 'Add Stock' : 'Issue Item'}
                </h2>
                <p className="text-xs text-white/40 uppercase tracking-widest">{selectedAsset.name}</p>
              </div>
              <button onClick={() => setShowTransactionModal(false)} className="text-white/40 hover:text-white">
                <MaterialIcon icon="close" />
              </button>
            </div>
            
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Quantity</label>
                <input 
                  name="quantity"
                  type="number" 
                  required
                  min="1"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  placeholder="How many units?"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">Notes</label>
                <textarea 
                  name="notes"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  placeholder="Reason for this transaction..."
                ></textarea>
              </div>
              
              <button 
                type="submit"
                className={`w-full py-4 text-white rounded-xl font-bold transition-all shadow-lg mt-4 ${
                  transactionType === 'in' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                }`}
              >
                Confirm {transactionType === 'in' ? 'Addition' : 'Issuance'}
              </button>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
