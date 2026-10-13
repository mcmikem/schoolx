"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/currency";

interface ReceiptModalProps {
  isOpen: boolean;
  student: { name: string; student_number: string; paid: number; balance: number } | null;
  schoolName: string;
  onClose: () => void;
  onPrint: () => void;
}

/**
 * Portal-rendered through the shared Modal: the previous hand-rolled wrapper
 * combined viewport-fixed positioning with a backdrop blur, which iOS Safari
 * resolves against the document once the page is scrolled — the receipt
 * appeared off-screen and had to be scrolled to.
 */
export default function ReceiptModal({ isOpen, student, schoolName, onClose, onPrint }: ReceiptModalProps) {
  if (!isOpen || !student) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fee Payment Receipt" size="md">
      <div className="space-y-3">
        <div className="flex justify-between py-2 border-b border-dashed">
          <span className="text-on-surface-variant">School:</span>
          <span className="font-bold text-primary">{schoolName}</span>
        </div>
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
          <span className={`font-bold ${student.balance > 0 ? "text-error" : "text-secondary"}`}>
            {formatCurrency(student.balance)}
          </span>
        </div>
      </div>
      <button
        onClick={onPrint}
        className="mt-6 w-full py-3 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 min-h-[44px]"
      >
        <MaterialIcon icon="print" className="text-lg" />
        Print Receipt
      </button>
    </Modal>
  );
}
