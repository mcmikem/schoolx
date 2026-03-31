'use client'
import MaterialIcon from '@/components/MaterialIcon'
import { PAYMENT_METHODS } from '@/lib/constants'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  students: Array<{ id: string; name: string; balance: number }>
  onSubmit: (e: React.FormEvent) => void
  newPayment: {
    student_id: string
    amount_paid: string
    payment_method: 'cash' | 'mobile_money' | 'bank' | 'installment'
    payment_reference: string
    momo_provider: 'mtn' | 'airtel'
    momo_transaction_id: string
    paid_by: string
    notes: string
  }
  onPaymentChange: (updates: Partial<typeof newPayment>) => void
  saving: boolean
}

const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

export default function PaymentModal({
  isOpen,
  onClose,
  students,
  onSubmit,
  newPayment,
  onPaymentChange,
  saving,
}: PaymentModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-outline-variant/10">
          <h2 className="font-headline font-bold text-xl text-primary">Record Payment</h2>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Student</label>
            {students.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">No students found - add students first</div>
            ) : (
              <select value={newPayment.student_id} onChange={(e) => onPaymentChange({ student_id: e.target.value })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" required>
                <option value="">Select student</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name} - {formatCurrency(s.balance)}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Amount (UGX)</label>
              <input type="number" value={newPayment.amount_paid} onChange={(e) => onPaymentChange({ amount_paid: e.target.value })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Method</label>
              <select value={newPayment.payment_method} onChange={(e) => onPaymentChange({ payment_method: e.target.value as typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS] })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm">
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Payment Reference</label>
            <input type="text" value={newPayment.payment_reference} onChange={(e) => onPaymentChange({ payment_reference: e.target.value })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" placeholder="e.g. Receipt number" />
          </div>
          {newPayment.payment_method === 'mobile_money' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">MoMo Provider</label>
                <select value={newPayment.momo_provider} onChange={(e) => onPaymentChange({ momo_provider: e.target.value as 'mtn' | 'airtel' })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm">
                  <option value="mtn">MTN</option>
                  <option value="airtel">Airtel</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Transaction ID</label>
                <input type="text" value={newPayment.momo_transaction_id} onChange={(e) => onPaymentChange({ momo_transaction_id: e.target.value })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" placeholder="MoMo transaction ID" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Paid By</label>
              <input type="text" value={newPayment.paid_by} onChange={(e) => onPaymentChange({ paid_by: e.target.value })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" placeholder="Name of payer" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Notes</label>
              <input type="text" value={newPayment.notes} onChange={(e) => onPaymentChange({ notes: e.target.value })} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" placeholder="Additional notes" />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl">{saving ? 'Saving...' : 'Record Payment'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
