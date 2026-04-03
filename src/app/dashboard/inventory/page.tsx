'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { useAssets, useInventory } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { Asset } from '@/types'

export default function InventoryPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { assets, loading: loadingAssets } = useAssets(school?.id)
  const { transactions, loading: loadingTx, recordTransaction } = useInventory(school?.id)
  
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('out')
  const [activeTab, setActiveTab] = useState('stock')

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
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader title="Inventory & Supplies" subtitle="Track school assets and consumable supplies" />
        <TableSkeleton rows={5} />
      </div>
    )
  }

  const lowStockItems = assets.filter(a => a.is_consumable && a.current_stock <= a.min_stock_level)

  const tabs = [
    { id: 'stock', label: 'Current Stock', count: assets.length },
    { id: 'activity', label: 'Recent Activity', count: transactions.length }
  ]

  const filteredAssets = assets.filter(a => a.is_consumable)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Inventory & Supplies" 
        subtitle="Track school assets and consumable supplies"
        actions={
          lowStockItems.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-[var(--red-soft)] rounded-xl border border-[var(--red)]/20">
              <MaterialIcon icon="warning" className="text-[var(--red)]" />
              <div>
                <p className="text-xs text-[var(--red)] font-bold uppercase tracking-wider">Low Stock Alert</p>
                <p className="text-sm text-[var(--on-surface)] font-medium">{lowStockItems.length} items need restocking</p>
              </div>
            </div>
          )
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <TabPanel activeTab={activeTab} tabId="stock">
        {filteredAssets.length === 0 ? (
          <Card>
            <EmptyState
              icon="inventory_2"
              title="No consumable items"
              description="Add consumable assets to track inventory"
            />
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--t3)] text-sm uppercase tracking-wider">
                    <th className="pb-4 font-semibold">Item Name</th>
                    <th className="pb-4 font-semibold text-center">In Stock</th>
                    <th className="pb-4 font-semibold">Category</th>
                    <th className="pb-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-[var(--surface-container)] transition-colors group">
                      <td className="py-4">
                        <div>
                          <p className="font-semibold text-[var(--on-surface)]">{asset.name}</p>
                          {asset.is_consumable && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--navy-soft)] text-[var(--navy)] font-bold uppercase tracking-wider">Consumable</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <div className={`inline-block px-3 py-1 rounded-lg font-bold ${
                          asset.is_consumable && asset.current_stock <= asset.min_stock_level 
                            ? 'bg-[var(--red-soft)] text-[var(--red)]' 
                            : 'bg-[var(--surface-container)] text-[var(--on-surface)]'
                        }`}>
                          {asset.current_stock}
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-xs text-[var(--t3)] capitalize">{asset.category}</span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setSelectedAsset(asset); setTransactionType('in'); setShowTransactionModal(true); }}
                            className="p-2 bg-[var(--green-soft)] text-[var(--green)] hover:opacity-80 rounded-lg transition-colors"
                            title="Add Stock"
                          >
                            <MaterialIcon icon="add" />
                          </button>
                          <button 
                            onClick={() => { setSelectedAsset(asset); setTransactionType('out'); setShowTransactionModal(true); }}
                            className="p-2 bg-[var(--red-soft)] text-[var(--red)] hover:opacity-80 rounded-lg transition-colors"
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
          </Card>
        )}
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="activity">
        <Card>
          {transactions.length === 0 ? (
            <EmptyState
              icon="history"
              title="No recent activity"
              description="Transaction history will appear here"
            />
          ) : (
            <div className="space-y-4">
              {transactions.slice(0, 8).map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]">
                  <div className={`p-2 rounded-lg ${tx.transaction_type === 'in' ? 'bg-[var(--green-soft)] text-[var(--green)]' : 'bg-[var(--red-soft)] text-[var(--red)]'}`}>
                    <MaterialIcon icon={tx.transaction_type === 'in' ? 'arrow_downward' : 'arrow_upward'} className="text-sm" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[var(--on-surface)]">{tx.asset?.name || 'Item'}</p>
                    <p className="text-[10px] text-[var(--t4)] uppercase tracking-widest">{tx.transaction_type} · {tx.quantity} units</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[var(--t4)]">{new Date(tx.transaction_date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </TabPanel>

      {showTransactionModal && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                    {transactionType === 'in' ? 'Add Stock' : 'Issue Item'}
                  </h2>
                  <p className="text-xs text-[var(--t4)] uppercase tracking-widest">{selectedAsset.name}</p>
                </div>
                <button onClick={() => setShowTransactionModal(false)} className="text-[var(--t3)] hover:text-[var(--on-surface)]">
                  <MaterialIcon icon="close" />
                </button>
              </div>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleTransactionSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Quantity</label>
                  <input 
                    name="quantity"
                    type="number" 
                    required
                    min="1"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    placeholder="How many units?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Notes</label>
                  <textarea 
                    name="notes"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    placeholder="Reason for this transaction..."
                  ></textarea>
                </div>
                
                <Button 
                  type="submit"
                  className={`w-full mt-4 ${
                    transactionType === 'in' ? '' : ''
                  }`}
                  variant={transactionType === 'in' ? 'primary' : 'danger'}
                >
                  Confirm {transactionType === 'in' ? 'Addition' : 'Issuance'}
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}