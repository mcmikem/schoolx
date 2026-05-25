"use client";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { AutoSaveIndicator } from "@/lib/useAutoSave";
import { useFormValidation, ValidationRules } from "@/lib/useFormValidation";

interface ClassOption {
  id: string;
  name: string;
}

interface FeeFormData {
  name: string;
  class_id: string;
  amount: string;
  term: number | 1 | 2 | 3;
  due_date: string;
}

interface FeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassOption[];
  classesLoading?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  newFee: FeeFormData;
  onFeeChange: (updates: Record<string, unknown>) => void;
  saving: boolean;
  draftLastSaved?: Date | null;
  draftIsDirty?: boolean;
}

const feeRules = {
  name: { ...ValidationRules.required, message: 'Fee name is required' },
  amount: { ...ValidationRules.required, ...ValidationRules.positiveNumber, message: 'Amount must be greater than 0' },
  class_id: ValidationRules.required,
  term: ValidationRules.required,
};

export default function FeeFormModal({
  isOpen,
  onClose,
  classes,
  classesLoading = false,
  onSubmit,
  newFee,
  onFeeChange,
  saving,
  draftLastSaved,
  draftIsDirty,
}: FeeFormModalProps) {
  const feeValidation = useFormValidation(feeRules);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fields = ['name', 'amount', 'class_id', 'term'];
    fields.forEach(f => feeValidation.markTouched(f));
    if (!feeValidation.validate(newFee)) return;
    onSubmit(e);
  };

  const showError = (field: string) =>
    feeValidation.isTouched(field) && feeValidation.getFieldError(field);

  const errorBorder = (field: string) =>
    showError(field)
      ? "border-2 border-[var(--red)] bg-[var(--error-container)]"
      : "border border-[var(--border)] bg-surface-container";

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
          <div className="flex items-center justify-between">
            <h2 className="font-headline font-bold text-xl text-primary">
              Add New Fee
            </h2>
            <AutoSaveIndicator
              lastSaved={draftLastSaved ?? null}
              isDirty={draftIsDirty ?? false}
            />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Fee Name
            </label>
            <input
              type="text"
              value={newFee.name}
              onChange={(e) => onFeeChange({ name: e.target.value })}
              onBlur={() => feeValidation.markTouched("name")}
              className={`w-full rounded-xl py-3 px-4 text-sm transition-colors ${errorBorder("name")}`}
              placeholder="e.g. Tuition, Development, Library"
              required
            />
            {showError("name") && (
              <p className="text-xs text-[var(--red)] mt-1 flex items-center gap-1">
                <MaterialIcon className="text-sm">error</MaterialIcon>
                {feeValidation.getFieldError("name")}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Class (Optional - leave empty for all)
            </label>
            {classesLoading ? (
              <div className="bg-[var(--navy-soft)] border border-[rgba(0,31,63,0.12)] rounded-xl p-4">
                <p className="text-[var(--t1)] text-sm font-medium">
                  Loading classes...
                </p>
                <p className="text-[var(--t3)] text-xs mt-1">
                  The class list is still being fetched for this school.
                </p>
              </div>
            ) : classes.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-amber-800 text-sm font-medium">
                  No classes found
                </p>
                <p className="text-amber-600 text-xs mt-1">
                  Contact support if this persists.
                </p>
              </div>
            ) : (
              <select
                value={newFee.class_id}
                onChange={(e) => onFeeChange({ class_id: e.target.value })}
                onBlur={() => feeValidation.markTouched("class_id")}
                className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {showError("class_id") && (
              <p className="text-xs text-[var(--red)] mt-1 flex items-center gap-1">
                <MaterialIcon className="text-sm">error</MaterialIcon>
                {feeValidation.getFieldError("class_id")}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Amount (UGX)
              </label>
              <input
                type="number"
                min="1"
                value={newFee.amount}
                onChange={(e) => onFeeChange({ amount: e.target.value })}
                onBlur={() => feeValidation.markTouched("amount")}
                className={`w-full rounded-xl py-3 px-4 text-sm transition-colors ${errorBorder("amount")}`}
                required
                placeholder="0"
              />
              {showError("amount") && (
                <p className="text-xs text-[var(--red)] mt-1 flex items-center gap-1">
                  <MaterialIcon className="text-sm">error</MaterialIcon>
                  {feeValidation.getFieldError("amount")}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Term
              </label>
              <select
                value={newFee.term}
                onChange={(e) =>
                  onFeeChange({ term: Number(e.target.value) as 1 | 2 | 3 })
                }
                onBlur={() => feeValidation.markTouched("term")}
                className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
              >
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
              {showError("term") && (
                <p className="text-xs text-[var(--red)] mt-1 flex items-center gap-1">
                  <MaterialIcon className="text-sm">error</MaterialIcon>
                  {feeValidation.getFieldError("term")}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={newFee.due_date}
              onChange={(e) => onFeeChange({ due_date: e.target.value })}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Add Fee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
