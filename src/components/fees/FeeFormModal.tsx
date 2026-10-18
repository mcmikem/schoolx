"use client";
import { useId } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Modal } from "@/components/ui/Modal";
import { AutoSaveIndicator } from "@/lib/useAutoSave";
import { useFormValidation, ValidationRules } from "@/lib/useFormValidation";

interface ClassOption {
  id: string;
  name: string;
}

export type FeeCategory =
  | "tuition"
  | "boarding"
  | "meals"
  | "transport"
  | "uniform"
  | "registration"
  | "functional"
  | "pta"
  | "development"
  | "library"
  | "sports"
  | "ict"
  | "medical"
  | "exam"
  | "uneb"
  | "bank_charges"
  | "other";

export type BoardingStatus = "day" | "boarding" | "both";

export type FeeFrequency = "per_term" | "one_off" | "per_year";

export interface FeeFormData {
  name: string;
  class_id: string;
  amount: string;
  term: number | null;
  due_date: string;
  category: FeeCategory;
  boarding_status: BoardingStatus;
  frequency: FeeFrequency;
  transport_zone: string;
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
  /** True when adjusting an existing fee item rather than creating a new one. */
  isEditing?: boolean;
  draftLastSaved?: Date | null;
  draftIsDirty?: boolean;
}

const feeRules = {
  name: { ...ValidationRules.required, message: "Fee name is required" },
  amount: { ...ValidationRules.required, ...ValidationRules.positiveNumber, message: "Amount must be greater than 0" },
  category: ValidationRules.required,
  frequency: ValidationRules.required,
  // term required only for per_term frequency
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
  isEditing = false,
  draftLastSaved,
  draftIsDirty,
}: FeeFormModalProps) {
  const formId = useId();
  const feeValidation = useFormValidation({
    ...feeRules,
    term: newFee.frequency === "per_term" ? ValidationRules.required : {},
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fields = ["name", "amount", "category", "frequency", "term"];
    fields.forEach((f) => feeValidation.markTouched(f));
    if (!feeValidation.validate(newFee)) return;
    onSubmit(e);
  };

  const showError = (field: string) => feeValidation.isTouched(field) && feeValidation.getFieldError(field);

  const errorBorder = (field: string) =>
    showError(field)
      ? "border-2 border-[var(--red)] bg-[var(--error-container)]"
      : "border border-[var(--border)] bg-surface-container";

  /*
    Rendered through the shared Modal rather than a hand-rolled full-screen
    wrapper. Two reasons, both of which left the dialog off-screen:

      1. iOS Safari resolves a viewport-fixed element that also carries a
         backdrop blur against the document instead of the viewport once the
         page is scrolled, so the whole dialog rendered at document coordinates
         and the bursar had to scroll to find it.
      2. Rendering inline meant any ancestor with a transform/filter/overflow
         created a containing block and trapped the fixed element inside it.
         The fees page is full of sticky bars and scroll containers.

    The shared Modal portals to document.body, keeps the backdrop blur on a
    separate absolute layer, and brings Escape, focus restore, a focus trap and
    a body scroll lock — none of which this version had.
  */
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Fee" : "Add New Fee"}
      size="md"
      headerAction={<AutoSaveIndicator lastSaved={draftLastSaved ?? null} isDirty={draftIsDirty ?? false} />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor={`${formId}-name`}
            className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
          >
            Fee Name
          </label>
          <input
            id={`${formId}-name`}
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
          <label
            htmlFor={`${formId}-class`}
            className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
          >
            Class (Optional - leave empty for all)
          </label>
          {classesLoading ? (
            <div className="bg-[var(--navy-soft)] border border-[rgba(0,31,63,0.12)] rounded-xl p-4">
              <p className="text-[var(--t1)] text-sm font-medium">Loading classes...</p>
              <p className="text-[var(--t3)] text-xs mt-1">The class list is still being fetched for this school.</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-800 text-sm font-medium">No classes found</p>
              <p className="text-amber-600 text-xs mt-1">Contact support if this persists.</p>
            </div>
          ) : (
            <select
              id={`${formId}-class`}
              value={newFee.class_id}
              onChange={(e) => onFeeChange({ class_id: e.target.value })}
              onBlur={() => feeValidation.markTouched("class_id")}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
            >
              <option value="">All classes (school-wide)</option>
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
        <div>
          <label
            htmlFor={`${formId}-category`}
            className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
          >
            Category
          </label>
          <select
            id={`${formId}-category`}
            value={newFee.category}
            onChange={(e) => onFeeChange({ category: e.target.value })}
            onBlur={() => feeValidation.markTouched("category")}
            className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
          >
            <option value="tuition">Tuition</option>
            <option value="boarding">Boarding</option>
            <option value="meals">Meals</option>
            <option value="transport">Transport</option>
            <option value="uniform">Uniform</option>
            <option value="registration">Registration</option>
            <option value="functional">Functional</option>
            <option value="pta">PTA</option>
            <option value="development">Development</option>
            <option value="library">Library</option>
            <option value="sports">Sports</option>
            <option value="ict">ICT</option>
            <option value="medical">Medical</option>
            <option value="exam">Exam</option>
            <option value="uneb">UNEB</option>
            <option value="bank_charges">Bank Charges</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label
            htmlFor={`${formId}-boarding`}
            className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
          >
            Applies To
          </label>
          <select
            id={`${formId}-boarding`}
            value={newFee.boarding_status}
            onChange={(e) => onFeeChange({ boarding_status: e.target.value })}
            onBlur={() => feeValidation.markTouched("boarding_status")}
            className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
          >
            <option value="day">Day Students</option>
            <option value="boarding">Boarding Students</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div>
          <label
            htmlFor={`${formId}-frequency`}
            className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
          >
            Frequency
          </label>
          <select
            id={`${formId}-frequency`}
            value={newFee.frequency}
            onChange={(e) => onFeeChange({ frequency: e.target.value })}
            onBlur={() => feeValidation.markTouched("frequency")}
            className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
          >
            <option value="per_term">Per Term</option>
            <option value="one_off">One-off</option>
            <option value="per_year">Per Year</option>
          </select>
        </div>
        {newFee.category === "transport" && (
          <div>
            <label
              htmlFor={`${formId}-zone`}
              className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
            >
              Transport Zone (if transport)
            </label>
            <input
              id={`${formId}-zone`}
              type="text"
              value={newFee.transport_zone}
              onChange={(e) => onFeeChange({ transport_zone: e.target.value })}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
              placeholder="Zone 1 / Zone 2 / Zone 3..."
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={`${formId}-amount`}
              className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
            >
              Amount (UGX)
            </label>
            <input
              id={`${formId}-amount`}
              type="number"
              inputMode="numeric"
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
            <label
              htmlFor={`${formId}-term`}
              className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
            >
              Term (if per term)
            </label>
            <select
              id={`${formId}-term`}
              value={newFee.term || 1}
              onChange={(e) => onFeeChange({ term: Number(e.target.value) as 1 | 2 | 3 })}
              onBlur={() => feeValidation.markTouched("term")}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
              disabled={newFee.frequency !== "per_term"}
            >
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>
        </div>
        <div>
          <label
            htmlFor={`${formId}-due`}
            className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
          >
            Due Date (Optional)
          </label>
          <input
            id={`${formId}-due`}
            type="date"
            value={newFee.due_date}
            onChange={(e) => onFeeChange({ due_date: e.target.value })}
            className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Fee"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
