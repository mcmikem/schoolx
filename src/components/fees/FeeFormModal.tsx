"use client";
import { useState, useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { AutoSaveIndicator } from "@/lib/useAutoSave";

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
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!newFee.name.trim()) errs.name = "Fee name is required";
    if (!newFee.amount || Number(newFee.amount) <= 0) {
      errs.amount = "Amount must be greater than 0";
    }
    if (!newFee.term) errs.term = "Term is required";
    return errs;
  }, [newFee]);

  const isValid = Object.keys(errors).length === 0;

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const fieldError = (field: string) =>
    touched[field] && errors[field] ? errors[field] : null;

  const errorBorder = (field: string) =>
    fieldError(field)
      ? "border-2 border-[var(--red)] bg-[var(--error-container)]"
      : "border border-[var(--border)] bg-surface-container";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl w-full max-w-lg"
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
        <form onSubmit={onSubmit} className="p-6 space-y-4" noValidate>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Fee Name
            </label>
            <input
              type="text"
              value={newFee.name}
              onChange={(e) => onFeeChange({ name: e.target.value })}
              onBlur={() => handleBlur("name")}
              className={`w-full rounded-xl py-3 px-4 text-sm transition-colors ${errorBorder("name")}`}
              placeholder="e.g. Tuition, Development, Library"
              required
            />
            {fieldError("name") && (
              <p className="text-xs text-[var(--red)] mt-1 flex items-center gap-1">
                <MaterialIcon className="text-sm">error</MaterialIcon>
                {fieldError("name")}
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
                onBlur={() => handleBlur("amount")}
                className={`w-full rounded-xl py-3 px-4 text-sm transition-colors ${errorBorder("amount")}`}
                required
                placeholder="0"
              />
              {fieldError("amount") && (
                <p className="text-xs text-[var(--red)] mt-1 flex items-center gap-1">
                  <MaterialIcon className="text-sm">error</MaterialIcon>
                  {fieldError("amount")}
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
                className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
              >
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
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
              disabled={saving || !isValid}
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
