'use client'
import MaterialIcon from '@/components/MaterialIcon'

interface ClassOption {
  id: string
  name: string
}

interface FeeFormData {
  name: string
  class_id: string
  amount: string
  term: number | 1 | 2 | 3
  due_date: string
}

interface FeeFormModalProps {
  isOpen: boolean
  onClose: () => void
  classes: ClassOption[]
  onSubmit: (e: React.FormEvent) => void
  newFee: FeeFormData
  onFeeChange: (updates: Record<string, unknown>) => void
  saving: boolean
}

export default function FeeFormModal({
  isOpen,
  onClose,
  classes,
  onSubmit,
  newFee,
  onFeeChange,
  saving,
}: FeeFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-outline-variant/10">
          <h2 className="font-headline font-bold text-xl text-primary">Add New Fee</h2>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Fee Name</label>
            <input type="text" value={newFee.name} onChange={(e) => onFeeChange({ name: e.target.value })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" placeholder="e.g. Tuition, Development, Library" required />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Class (Optional - leave empty for all)</label>
            {classes.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-amber-800 text-sm font-medium">No classes found</p>
                <p className="text-amber-600 text-xs mt-1">Contact support if this persists.</p>
              </div>
            ) : (
              <select value={newFee.class_id} onChange={(e) => onFeeChange({ class_id: e.target.value })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm">
                <option value="">All Classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Amount (UGX)</label>
              <input type="number" value={newFee.amount} onChange={(e) => onFeeChange({ amount: e.target.value })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Term</label>
              <select value={newFee.term} onChange={(e) => onFeeChange({ term: Number(e.target.value) as 1 | 2 | 3 })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm">
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Due Date (Optional)</label>
            <input type="date" value={newFee.due_date} onChange={(e) => onFeeChange({ due_date: e.target.value })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? 'Saving...' : 'Add Fee'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
