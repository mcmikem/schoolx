'use client'
import MaterialIcon from '@/components/MaterialIcon'

interface ReceiptModalProps {
  isOpen: boolean
  student: { name: string; student_number: string; paid: number; balance: number } | null
  schoolName: string
  onClose: () => void
  onPrint: () => void
}

const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

export default function ReceiptModal({ isOpen, student, schoolName, onClose, onPrint }: ReceiptModalProps) {
  if (!isOpen || !student) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="text-center border-b-2 border-primary pb-4 mb-4">
            <h3 className="font-headline font-bold text-xl text-primary">{schoolName}</h3>
            <p className="text-sm text-on-surface-variant">Fee Payment Receipt</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="text-on-surface-variant">Student:</span>
              <span className="font-bold text-primary">{student.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="text-on-surface-variant">Student No:</span>
              <span className="font-bold">{student.student_number}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="text-on-surface-variant">Total Paid:</span>
              <span className="font-bold text-secondary">{formatCurrency(student.paid)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="text-on-surface-variant">Balance:</span>
              <span className={`font-bold ${student.balance > 0 ? 'text-error' : 'text-secondary'}`}>{formatCurrency(student.balance)}</span>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-outline-variant/10">
          <button onClick={onPrint} className="w-full py-3 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2">
            <MaterialIcon icon="print" className="text-lg" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  )
}
