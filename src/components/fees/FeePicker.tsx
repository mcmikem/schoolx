"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

export interface FeeOption {
  id: string;
  name: string;
  amount?: number | string | null;
  /**
   * What the school filed the fee under -- "tuition", "meals", "development".
   * Recorded inconsistently in practice (live data has both "tuition" and
   * "Tuition"), so it is used alongside the name rather than instead of it.
   */
  category?: string | null;
  /** Set when the fee line was retired; kept visible but marked. */
  retired?: boolean;
}

interface FeePickerProps {
  fees: FeeOption[];
  value: string;
  onChange: (feeId: string) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  /**
   * Line to preselect, decided by the caller. The caller knows the school, class
   * and term, so it can tell whether tuition is unambiguous; this component only
   * falls back to it when the bursar has not chosen anything themselves.
   */
  defaultFeeId?: string;
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
 * There is deliberately no "not fee-specific" option. A school charges named
 * fees -- tuition, meals, transport, development -- so a payment belongs to one
 * of them, and offering an escape hatch only produced payments that could not
 * be attributed to anything when the bursar left it alone.
 *
 * The fee list is passed in rather than fetched here, so the caller decides
 * which school, class and term it applies to.
 */
export default function FeePicker({
  fees,
  value,
  onChange,
  label = "Fee",
  disabled,
  required,
  defaultFeeId = "",
}: FeePickerProps) {
  const [touched, setTouched] = useState(false);

  const live = useMemo(() => fees.filter((f) => !f.retired), [fees]);

  const labelText = (fee: FeeOption) =>
    fee.amount !== null && fee.amount !== undefined && fee.amount !== ""
      ? `${fee.name} — ${formatCurrency(Number(fee.amount))}`
      : fee.name;

  // A default is shown but never committed: it is only a starting point for the
  // select. Reporting it back to the parent is left to them deliberately -- a
  // payment that names a fee the bursar never looked at is a claim about money
  // they did not make, so the parent decides when it counts.
  const autoPicked =
    !touched && !value && defaultFeeId
      ? live.find((f) => f.id === defaultFeeId) ?? null
      : null;
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
        required
        onChange={(e) => {
          setTouched(true);
          onChange(e.target.value);
        }}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-container)] px-4 py-3 text-sm text-[var(--t1)]"
      >
        {!selected && <option value="">Choose a fee</option>}
        {live.map((fee) => (
          <option key={fee.id} value={fee.id}>
            {labelText(fee)}
          </option>
        ))}
      </select>
      {!live.length && (
        <p className="mt-1 text-[11px] text-[var(--red)]">
          This class has no fees set up. Add them under Fee Structure first.
        </p>
      )}
      {fees.length > live.length && (
        <p className="mt-1 text-[11px] text-[var(--t3)]">
          {fees.length - live.length} retired fee line{fees.length - live.length === 1 ? "" : "s"} hidden.
        </p>
      )}
    </div>
  );
}