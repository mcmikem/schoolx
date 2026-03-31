'use client'
import MaterialIcon from '@/components/MaterialIcon'

interface StudentBalance {
  id: string
  name: string
  student_number: string
  class_name: string
  balance: number
}

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  students: StudentBalance[]
  selectedStudent: StudentBalance | null
  onSelectStudent: (student: StudentBalance) => void
  onPrintInvoice: () => void
}

const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

export default function InvoiceModal({
  isOpen,
  onClose,
  students,
  selectedStudent,
  onSelectStudent,
  onPrintInvoice,
}: InvoiceModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-outline-variant/10">
          <h2 className="font-headline font-bold text-xl text-primary">Generate Invoice</h2>
          <p className="text-sm text-on-surface-variant mt-1">Select a student to generate their fee invoice</p>
        </div>
        <div className="p-6">
          <div className="max-h-80 overflow-y-auto space-y-2">
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className="w-full text-left p-4 rounded-xl hover:bg-surface-container transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-primary">{student.name}</div>
                  <div className="text-xs text-on-surface-variant">{student.student_number} • {student.class_name}</div>
                </div>
                <div className={`text-sm font-bold ${student.balance > 0 ? 'text-error' : 'text-secondary'}`}>
                  {formatCurrency(student.balance)} due
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="p-6 border-t border-outline-variant/10 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl">Cancel</button>
          {selectedStudent && (
            <button onClick={onPrintInvoice} className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2">
              <MaterialIcon icon="print" className="text-lg" />
              Print Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
