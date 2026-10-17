"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

export interface FeeOption {
  id: string;
  name: string;
  amount?: number | string | null;
  /** Set when the fee line was retired; kept visible but marked. */
  retired?: boolean;
}

interface FeePickerProps {
  fees: FeeOption[];
  value: string;
  onChange: (feeId: string) => void;
  label?: string;
  /** What an empty selection means, worded for the person filling the form. */
  emptyLabel?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Which fee a payment or a discount is for.
 *
 * Fees are not just tuition. A school charges meals, transport, a development
 * fund, application fees -- and until this existed, recording a payment for
 * meals had nowhere to say so, so every payment read as tuition.
 *
 * Tuition is preselected when the school has exactly one candidate, because
 * that is the common case and the answer is rarely anything else. Anything more
 * than one candidate is left to the person: guessing wrong here would file a
 * payment against the wrong fee, which is worse than asking.
 *
 * The fee list is passed in rather than fetched here, so the caller decides
 * which school, class and term it applies to.
 */
export default function FeePicker({
  fees,
  value,
  onChange,
  label = "Fee",
  emptyLabel = "Whole bill / not fee-specific",
  disabled,
  required,
}: FeePickerProps) {
  const [touched, setTouched] = useState(false);

  const live = useMemo(() => fees.filter((f) => !f.retired), [fees]);

  const labelText = (fee: FeeOption) =>
    fee.amount !== null && fee.amount !== undefined && fee.amount !== ""
      ? `${fee.name} — ${formatCurrency(Number(fee.amount))}`
      : fee.name;

  // Preselect only when there is no real choice to make, and never after the
  // person has already chosen something.
  const autoPicked = !touched && !value && live.length === 1 ? live[0] : null;
  const selected = value || autoPicked?.id || "";

  return (
    <div>
      <label
        htmlFor="fee-picker-select"
        className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)]"
      >
        {label}
        {required && <span className="ml-1 text-[var(--red)]">*</span>}
      </label>
      <select
        id="fee-picker-select"
        value={selected}
        disabled={disabled}
        required={required && !selected}
        onChange={(e) => {
          setTouched(true);
          onChange(e.target.value);
        }}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-container)] px-4 py-3 text-sm text-[var(--t1)]"
      >
        <option value="">{emptyLabel}</option>
        {live.map((fee) => (
          <option key={fee.id} value={fee.id}>
            {labelText(fee)}
          </option>
        ))}
      </select>
      {fees.length > live.length && (
        <p className="mt-1 text-[11px] text-[var(--t3)]">
          {fees.length - live.length} retired fee line{fees.length - live.length === 1 ? "" : "s"} hidden.
        </p>
      )}
    </div>
  );
}