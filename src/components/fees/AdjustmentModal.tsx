"use client";
import FeePicker, { type FeeOption } from "@/components/fees/FeePicker";
import StudentPicker from "@/components/students/StudentPicker";
import { Modal } from "@/components/ui/Modal";
import { useEffect } from "react";

interface AdjustmentData {
  student_id: string;
  adjustment_type: "discount" | "scholarship" | "penalty" | "manual_credit" | "write_off" | "bursary" | "amnesty";
  amount: string;
  description: string;
  /** Fee line being discounted. "" = whole bill. */
  fee_id: string;
}

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Array<{ id: string; name: string; balance: number }>;
  fees?: FeeOption[];
  /** Tuition line to preselect when the bursar has not chosen a fee. */
  defaultFeeId?: string;
  onSubmit: (e: React.FormEvent) => void;
  newAdjustment: AdjustmentData;
  onAdjustmentChange: (updates: Partial<AdjustmentData>) => void;
  saving: boolean;
}

export default function AdjustmentModal({
  isOpen,
  onClose,
  students,
  fees,
  defaultFeeId,
  onSubmit,
  newAdjustment,
  onAdjustmentChange,
  saving,
}: AdjustmentModalProps) {
  const parsedAmount = Number(newAdjustment.amount);

  // Auto-commit a sensible default fee once fees load, so the form is never
  // blocked on a value the picker is already showing.
  useEffect(() => {
    if (newAdjustment.fee_id) return;
    const live = (fees ?? []).filter((f) => !f.retired);
    const candidate = defaultFeeId || (live.length === 1 ? live[0].id : "");
    if (candidate) onAdjustmentChange({ fee_id: candidate });
  }, [fees, defaultFeeId, newAdjustment.fee_id, onAdjustmentChange]);
  // Mirrors the payment form: the shown default counts as chosen, so an
  // untouched form is not blocked by a fee it is already displaying.
  const hasFees = (fees ?? []).some((f) => !f.retired);
  const adjustmentValidationError =
    !newAdjustment.student_id || !newAdjustment.amount || !newAdjustment.description.trim()
      ? "Select a student, amount, and reason to continue."
      : !hasFees
        ? "This class has no fees set up. Add them under Fee Structure first."
        : Number.isNaN(parsedAmount) || parsedAmount <= 0
          ? "Adjustment amount must be greater than 0."
          : "";

  if (!isOpen) return null;

  /*
    Portal-rendered through the shared Modal. The previous wrapper combined
    viewport-fixed positioning with a backdrop blur on one element, which iOS
    Safari resolves against the document once the page is scrolled — the dialog
    landed off-screen. Modal also adds Escape, focus trap and a scroll lock.
  */
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Fee Adjustment" size="md">
      <p className="text-sm text-on-surface-variant -mt-2 mb-4">
        Use this for bursaries, write-offs, discounts, penalties, and manual credits.
      </p>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Student
          </label>
          <StudentPicker
            students={students}
            value={newAdjustment.student_id}
            onChange={(studentId) => onAdjustmentChange({ student_id: studentId })}
            required
          />
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
              inputMode="numeric"
              min="1"
              value={newAdjustment.amount}
              onChange={(e) => onAdjustmentChange({ amount: e.target.value })}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
              required
            />
          </div>
        </div>

        <FeePicker
          fees={fees ?? []}
          defaultFeeId={defaultFeeId}
          value={newAdjustment.fee_id}
          onChange={(fee_id) => onAdjustmentChange({ fee_id })}
          label="Applies To Which Fee"
        />

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
    </Modal>
  );
}
