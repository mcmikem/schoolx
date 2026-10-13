"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { Modal } from "@/components/ui/Modal";
import { StudentBalance } from "./FeeTable";
import { formatCurrency } from "@/lib/currency";

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentBalance[];
  selectedStudent: StudentBalance | null;
  onSelectStudent: (student: StudentBalance) => void;
  onPrintInvoice: () => void;
}

export default function InvoiceModal({
  isOpen,
  onClose,
  students,
  selectedStudent,
  onSelectStudent,
  onPrintInvoice,
}: InvoiceModalProps) {
  if (!isOpen) return null;

  /*
    Portal-rendered through the shared Modal — the old wrapper put a backdrop
    blur on the viewport-fixed element, which iOS Safari resolves against the
    document once the page is scrolled, so this dialog opened off-screen.
  */
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Invoice" size="md">
      <p className="text-sm text-on-surface-variant -mt-2 mb-4">Select a student to generate their fee invoice</p>
      <div>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {students.map((student) => (
            <button
              key={student.id}
              onClick={() => onSelectStudent(student)}
              className="w-full text-left p-4 rounded-xl hover:bg-surface-container transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-primary">{student.name}</div>
                <div className="text-xs text-on-surface-variant">
                  {student.student_number} • {student.class_name}
                </div>
              </div>
              <div className={`text-sm font-bold ${student.balance > 0 ? "text-error" : "text-secondary"}`}>
                {formatCurrency(student.balance)} due
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="p-6 border-t border-outline-variant/10 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl"
        >
          Cancel
        </button>
        {selectedStudent && (
          <button
            onClick={onPrintInvoice}
            className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2"
          >
            <MaterialIcon icon="print" className="text-lg" />
            Print Invoice
          </button>
        )}
      </div>
    </Modal>
  );
}
