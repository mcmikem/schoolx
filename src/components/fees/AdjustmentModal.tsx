"use client";

interface AdjustmentData {
  student_id: string;
  adjustment_type: "discount" | "scholarship" | "penalty" | "manual_credit" | "write_off" | "bursary" | "amnesty";
  amount: string;
  description: string;
}

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Array<{ id: string; name: string; balance: number }>;
  onSubmit: (e: React.FormEvent) => void;
  newAdjustment: AdjustmentData;
  onAdjustmentChange: (updates: Partial<AdjustmentData>) => void;
  saving: boolean;
}

const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

export default function AdjustmentModal({
  isOpen,
  onClose,
  students,
  onSubmit,
  newAdjustment,
  onAdjustmentChange,
  saving,
}: AdjustmentModalProps) {
  const parsedAmount = Number(newAdjustment.amount);
  const adjustmentValidationError =
    !newAdjustment.student_id || !newAdjustment.amount || !newAdjustment.description.trim()
      ? "Select a student, amount, and reason to continue."
      : Number.isNaN(parsedAmount) || parsedAmount <= 0
        ? "Adjustment amount must be greater than 0."
        : "";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-outline-variant/10">
          <h2 className="font-headline font-bold text-xl text-primary">Record Fee Adjustment</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Use this for bursaries, write-offs, discounts, penalties, and manual credits.
          </p>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Student
            </label>
            <select
              value={newAdjustment.student_id}
              onChange={(e) => onAdjustmentChange({ student_id: e.target.value })}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
              required
            >
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} - {formatCurrency(student.balance)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Adjustment Type
              </label>
              <select
                value={newAdjustment.adjustment_type}
                onChange={(e) =>
                  onAdjustmentChange({ adjustment_type: e.target.value as AdjustmentData["adjustment_type"] })
                }
                className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
              >
                <option value="bursary">Bursary</option>
                <option value="write_off">Write-off</option>
                <option value="scholarship">Scholarship</option>
                <option value="amnesty">Fee Amnesty</option>
                <option value="discount">Discount</option>
                <option value="manual_credit">Manual Credit</option>
                <option value="penalty">Penalty</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Amount (UGX)
              </label>
              <input
                type="number"
                min="1"
                value={newAdjustment.amount}
                onChange={(e) => onAdjustmentChange({ amount: e.target.value })}
                className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Reason / Notes
            </label>
            <textarea
              value={newAdjustment.description}
              onChange={(e) => onAdjustmentChange({ description: e.target.value })}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm min-h-28 resize-y"
              placeholder="Explain why this adjustment is being applied"
              required
            />
          </div>

          <div className="rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">
            Credits such as bursary, scholarship, amnesty, discount, manual credit, and write-off reduce the expected
            balance. Penalties increase it.
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || Boolean(adjustmentValidationError)}
              className="btn btn-primary flex-1"
            >
              {saving ? "Saving..." : "Record Adjustment"}
            </button>
          </div>
          {adjustmentValidationError && <p className="text-sm text-[var(--t3)]">{adjustmentValidationError}</p>}
        </form>
      </div>
    </div>
  );
}
