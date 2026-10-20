"use client";
import { useState, useMemo, useEffect } from "react";
import FeePicker, { type FeeOption } from "@/components/fees/FeePicker";
import MaterialIcon from "@/components/MaterialIcon";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/currency";
import PaymentStudentSearch, { type PaymentStudentOption } from "@/components/fees/PaymentStudentSearch";
import { getLocalDateString } from "@/lib/hooks/utils";
import { isValidDate } from "@/lib/validation";

interface PaymentData {
  student_id: string;
  amount_paid: string;
  payment_date: string;
  payment_method: string;
  payment_reference: string;
  momo_provider: "mtn" | "airtel";
  momo_transaction_id: string;
  paid_by: string;
  notes: string;
  allow_overpayment: boolean;
  /** Fee being paid. "" means the preselected one is showing. */
  fee_id: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: PaymentStudentOption[];
  /**
   * Parents on file, keyed by pupil id. Used to fill "Paid By" so it is not
   * typed on every payment -- but only ever as a suggestion, never a lock.
   */
  parentNamesByStudent?: Record<string, string[]>;
  /**
   * Fee lines this school charges, so a payment for meals or the development
   * fund can be recorded against the right fee instead of reading as tuition.
   */
  fees?: FeeOption[];
  /** Tuition line to preselect when the bursar has not chosen a fee. */
  defaultFeeId?: string;
  /** Which fee is recorded against. "" means the whole bill. */
  feeId?: string;
  onFeeChange?: (feeId: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  newPayment: PaymentData;
  onPaymentChange: (updates: Record<string, unknown>) => void;
  saving: boolean;
}

export default function PaymentModal({
  isOpen,
  onClose,
  students,
  parentNamesByStudent,
  fees,
  defaultFeeId,
  feeId,
  onFeeChange,
  onSubmit,
  newPayment,
  onPaymentChange,
  saving,
}: PaymentModalProps) {
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTouched({});
    }
  }, [isOpen]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === newPayment.student_id),
    [students, newPayment.student_id],
  );

  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!newPayment.student_id) errs.student_id = "Please select a student";
    if (
      !newPayment.amount_paid ||
      !Number.isFinite(Number(newPayment.amount_paid)) ||
      Number(newPayment.amount_paid) <= 0
    ) {
      errs.amount_paid = "Amount must be greater than 0";
    }
    if (selectedStudent && Number(newPayment.amount_paid) > selectedStudent.balance && !newPayment.allow_overpayment) {
      errs.amount_paid = `Amount exceeds student balance of ${formatCurrency(selectedStudent.balance)}`;
    }
    if (newPayment.payment_method === "mobile_money" && !newPayment.momo_transaction_id.trim()) {
      errs.momo_transaction_id = "Transaction ID is required for mobile money";
    }
    if (!newPayment.payment_date || !isValidDate(newPayment.payment_date))
      errs.payment_date = "Choose the date the payment was received.";
    else if (newPayment.payment_date > getLocalDateString())
      errs.payment_date = "Payment date cannot be in the future.";
    // The preselected fee is shown but not stored in state, so a blank fee_id
    // still counts as chosen as long as a default is on offer. Only when there
    // is nothing to preselect and nothing picked is this an error.
    if (!newPayment.fee_id && !defaultFeeId) errs.fee_id = "Choose which fee this payment is for";
    return errs;
  }, [newPayment, selectedStudent, defaultFeeId]);
  const overpaymentAmount =
    selectedStudent && Number(newPayment.amount_paid) > selectedStudent.balance
      ? Number(newPayment.amount_paid) - selectedStudent.balance
      : 0;

  const step1Valid = !errors.student_id && !errors.amount_paid && !errors.fee_id;
  const submitDisabledReason = !step1Valid
    ? errors.fee_id || "Complete the student and amount fields first."
    : errors.payment_date || errors.momo_transaction_id || errors.amount_paid || errors.student_id
      ? errors.payment_date || errors.momo_transaction_id || errors.amount_paid || errors.student_id || ""
      : "";
  const nextDisabledReason =
    students.length === 0
      ? "Add students first before recording payments."
      : !newPayment.student_id
        ? "Select a student to continue."
        : !newPayment.amount_paid || Number(newPayment.amount_paid) <= 0
          ? "Enter a payment amount greater than 0."
          : errors.amount_paid
            ? errors.amount_paid
            : "";

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const fieldError = (field: string) =>
    (touched[field] || (field === "amount_paid" && overpaymentAmount > 0)) && errors[field] ? errors[field] : null;

  const errorBorder = (field: string) =>
    fieldError(field)
      ? "border-2 border-[var(--red)] bg-[var(--surface)]"
      : "border border-[var(--border)] bg-[var(--surface)]";

  // Parents on file for the pupil being paid.
  const payerSuggestions = newPayment.student_id ? (parentNamesByStudent?.[newPayment.student_id] ?? []) : [];

  // Fill "Paid By" once, and only into an empty field.
  //
  // The whole point is to stop the same parent being typed differently on every
  // payment, which is what makes a cashbook impossible to reconcile. It has to
  // stay a suggestion though: a grandmother, a sponsor, or a staff member
  // collecting fees is ordinary, and silently overwriting what someone typed is
  // worse than making them type. A change of pupil starts a fresh suggestion.
  const [payerAutoFilled, setPayerAutoFilled] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (newPayment.paid_by.trim()) return;
    const first = payerSuggestions[0];
    if (first) {
      onPaymentChange({ paid_by: first });
      setPayerAutoFilled(true);
      return;
    }
    setPayerAutoFilled(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, newPayment.student_id]);

  if (!isOpen) return null;

  const amountNum = Number(newPayment.amount_paid) || 0;
  const balanceAfter = selectedStudent ? Math.max(0, selectedStudent.balance - amountNum) : null;
  const presetOptions = selectedStudent
    ? [
        { label: "Full", value: selectedStudent.balance },
        { label: "Half", value: Math.round(selectedStudent.balance / 2) },
        { label: "50k", value: 50000 },
        { label: "100k", value: 100000 },
      ].filter((p) => p.value > 0 && p.value <= selectedStudent.balance)
    : [];

  const handleClose = () => {
    if (saving) return;
    setStep(1);
    setTouched({});
    onClose();
  };

  const handleNext = () => {
    setTouched({ student_id: true, amount_paid: true });
    if (step1Valid) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  /*
    Portal-rendered through the shared Modal. This is the dialog behind Record
    Payment, and it had the same defect as the other fee modals: a backdrop blur
    on the viewport-fixed element, which iOS Safari resolves against the
    document once the page has scrolled — so the whole dialog, including the
    step indicator and the amount field, sat off-screen. Modal also restores
    focus on close and locks background scroll while a payment is being taken.
  */
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Record Payment" size="md">
      <div className="-mt-2">
        {selectedStudent && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--t1)] truncate">{selectedStudent.name}</div>
              <div className="text-xs text-[var(--t3)] tabular-nums">
                Owes {formatCurrency(selectedStudent.balance)}
                {balanceAfter !== null && amountNum > 0 ? ` → ${formatCurrency(balanceAfter)} left` : ""}
              </div>
            </div>
            <span className={`badge flex-shrink-0 ${selectedStudent.balance > 0 ? "badge-red" : "badge-green"}`}>
              {selectedStudent.balance > 0 ? "Balance due" : "Cleared"}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-4">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors bg-[var(--primary)] text-[var(--on-primary)]"
            aria-current={step === 1 ? "step" : undefined}
          >
            1
          </div>
          <div
            className="flex-1 h-0.5 rounded transition-colors"
            style={{ background: step >= 2 ? "var(--primary)" : "var(--border)" }}
          />
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
              step >= 2
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "border border-[var(--border)] text-[var(--t3)]"
            }`}
            aria-current={step === 2 ? "step" : undefined}
          >
            2
          </div>
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs font-semibold text-[var(--t3)]">Student & Amount</span>
          <span className="text-xs font-semibold text-[var(--t3)]">Payment Details</span>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (step === 1) {
            handleNext();
            return;
          }
          setTouched({ student_id: true, amount_paid: true, payment_date: true, momo_transaction_id: true });
          if (!submitDisabledReason && !saving) onSubmit(event);
        }}
        className="space-y-5"
        noValidate
      >
        {step === 1 && (
          <>
            {students.length === 0 ? (
              <div className="rounded-xl border border-[var(--amber)] bg-[var(--amber-soft)] p-3 text-sm text-[var(--t1)]">
                No students found. Add students before recording payments.
              </div>
            ) : (
              <PaymentStudentSearch
                students={students}
                value={newPayment.student_id}
                onChange={(studentId) => onPaymentChange({ student_id: studentId, allow_overpayment: false })}
                error={fieldError("student_id")}
                disabled={saving}
              />
            )}
            <div>
              <label
                htmlFor="payment-amount"
                className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2"
              >
                Amount (UGX)
              </label>
              <input
                id="payment-amount"
                type="number"
                inputMode="numeric"
                min="1"
                value={newPayment.amount_paid}
                onChange={(e) => onPaymentChange({ amount_paid: e.target.value })}
                onBlur={() => handleBlur("amount_paid")}
                aria-invalid={Boolean(fieldError("amount_paid"))}
                aria-describedby={fieldError("amount_paid") ? "payment-amount-error" : undefined}
                className={`w-full rounded-xl py-3.5 px-4 text-[15px] font-semibold tabular-nums transition-colors ${errorBorder("amount_paid")}`}
                required
                placeholder="0"
              />
              {presetOptions.length > 0 && (
                <div className="flex gap-2 mt-2.5 flex-wrap" role="group" aria-label="Quick amounts">
                  {presetOptions.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => onPaymentChange({ amount_paid: String(p.value) })}
                      className={`min-h-[44px] px-3.5 rounded-full text-xs font-bold border transition-colors active:scale-[0.97] ${
                        amountNum === p.value
                          ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent"
                          : "bg-[var(--surface)] text-[var(--t2)] border-[var(--border)] hover:border-[var(--border2)] hover:bg-[var(--surface-container-low)]"
                      }`}
                    >
                      {p.label} · {p.value >= 1000 ? `${Math.round(p.value / 1000)}k` : p.value}
                    </button>
                  ))}
                </div>
              )}
              {fieldError("amount_paid") && (
                <p
                  id="payment-amount-error"
                  role="alert"
                  className="text-xs text-[var(--red)] mt-1 flex items-center gap-1"
                >
                  <MaterialIcon className="text-sm">error</MaterialIcon>
                  {fieldError("amount_paid")}
                </p>
              )}
              {overpaymentAmount > 0 && (
                <label className="flex items-start gap-2.5 mt-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 cursor-pointer hover:border-[var(--border2)]">
                  <input
                    type="checkbox"
                    checked={!!newPayment.allow_overpayment}
                    onChange={(e) => onPaymentChange({ allow_overpayment: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded accent-[var(--primary)]"
                  />
                  <span className="text-xs text-[var(--t2)]">
                    <span className="font-semibold text-[var(--t1)]">Record excess as credit</span>
                    <span className="block text-[var(--t3)] tabular-nums">
                      {formatCurrency(overpaymentAmount)} over the balance will be kept as a credit on this
                      student&apos;s account.
                    </span>
                  </span>
                </label>
              )}
              {selectedStudent &&
                newPayment.amount_paid &&
                Number(newPayment.amount_paid) > 0 &&
                !fieldError("amount_paid") && (
                  <p className="text-xs font-medium tabular-nums mt-1.5" style={{ color: "var(--green)" }}>
                    {formatCurrency(Math.max(0, selectedStudent.balance - Number(newPayment.amount_paid)))} left after
                    this payment
                  </p>
                )}
            </div>
            <div className="sticky bottom-0 z-10 flex gap-3 border-t border-[var(--border)] bg-[var(--surface)] py-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 min-h-[48px] py-3 bg-[var(--surface-container-low)] border border-[var(--border)] text-[var(--t2)] font-semibold rounded-xl active:scale-[0.98] transition-transform"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={students.length === 0 || !step1Valid}
                className="flex-1 min-h-[48px] py-3 bg-[var(--primary)] text-[var(--on-primary)] font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform tabular-nums"
              >
                Next{amountNum > 0 ? ` · ${formatCurrency(amountNum)}` : ""}
              </button>
            </div>
            {(students.length === 0 || !step1Valid) && nextDisabledReason && (
              <p className="text-xs text-[var(--t3)] text-right">{nextDisabledReason}</p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label htmlFor="payment-date" className="block text-sm font-semibold text-[var(--t1)] mb-2">
                Payment date
              </label>
              <input
                id="payment-date"
                type="date"
                required
                max={getLocalDateString()}
                value={newPayment.payment_date}
                onChange={(event) => onPaymentChange({ payment_date: event.target.value })}
                onBlur={() => handleBlur("payment_date")}
                aria-invalid={Boolean(errors.payment_date)}
                aria-describedby="payment-date-help"
                className={`w-full rounded-xl px-4 py-3.5 text-base text-[var(--t1)] ${errorBorder("payment_date")}`}
              />
              <p id="payment-date-help" className="mt-1.5 text-xs text-[var(--t3)]">
                When the money was received. Choose an earlier date for a payment entered later.
              </p>
              {fieldError("payment_date") && (
                <p role="alert" className="mt-1 text-xs text-[var(--red)]">
                  {fieldError("payment_date")}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="payment-method"
                className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2"
              >
                Method
              </label>
              <select
                id="payment-method"
                value={newPayment.payment_method}
                onChange={(e) => onPaymentChange({ payment_method: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3.5 px-4 text-sm text-[var(--t1)]"
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="bank">Bank Transfer</option>
                <option value="installment">Installment</option>
                <option value="in_kind">In Kind (Goods/Services)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="payment-reference"
                className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2"
              >
                Payment Reference
              </label>
              <input
                id="payment-reference"
                type="text"
                value={newPayment.payment_reference}
                onChange={(e) => onPaymentChange({ payment_reference: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3.5 px-4 text-sm text-[var(--t1)]"
                placeholder="e.g. Receipt number"
              />
            </div>
            {newPayment.payment_method === "in_kind" && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2">
                  Description of Goods/Services
                </label>
                <textarea
                  value={newPayment.notes}
                  onChange={(e) => onPaymentChange({ notes: e.target.value })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3.5 px-4 text-sm min-h-20 resize-y text-[var(--t1)]"
                  placeholder="e.g. 3 bags of maize flour, school uniform supplies"
                />
                <p className="text-xs text-[var(--t3)] mt-1">
                  Amount (UGX) represents the fair value of the goods or services provided.
                </p>
              </div>
            )}
            {newPayment.payment_method === "mobile_money" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="payment-provider"
                    className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2"
                  >
                    MoMo Provider
                  </label>
                  <select
                    id="payment-provider"
                    value={newPayment.momo_provider}
                    onChange={(e) =>
                      onPaymentChange({
                        momo_provider: e.target.value as "mtn" | "airtel",
                      })
                    }
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3.5 px-4 text-sm text-[var(--t1)]"
                  >
                    <option value="mtn">MTN</option>
                    <option value="airtel">Airtel</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="payment-transaction"
                    className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2"
                  >
                    Transaction ID
                  </label>
                  <input
                    id="payment-transaction"
                    type="text"
                    value={newPayment.momo_transaction_id}
                    onChange={(e) => onPaymentChange({ momo_transaction_id: e.target.value })}
                    onBlur={() => handleBlur("momo_transaction_id")}
                    className={`w-full rounded-xl py-3.5 px-4 text-sm transition-colors ${errorBorder("momo_transaction_id")}`}
                    placeholder="MoMo transaction ID"
                  />
                  {fieldError("momo_transaction_id") && (
                    <p className="text-xs text-[var(--red)] mt-1 flex items-center gap-1">
                      <MaterialIcon className="text-sm">error</MaterialIcon>
                      {fieldError("momo_transaction_id")}
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="payment-payer"
                  className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2"
                >
                  Paid By
                </label>
                <input
                  id="payment-payer"
                  type="text"
                  value={newPayment.paid_by}
                  onChange={(e) => {
                    setPayerAutoFilled(false);
                    onPaymentChange({ paid_by: e.target.value });
                  }}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3.5 px-4 text-sm text-[var(--t1)]"
                  placeholder="Name of payer"
                  autoComplete="off"
                />
                {payerSuggestions.length > 1 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[var(--t3)]">On file:</span>
                    {payerSuggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => onPaymentChange({ paid_by: name })}
                        className={`min-h-9 rounded-full px-2.5 text-xs font-semibold transition-colors ${
                          newPayment.paid_by === name
                            ? "bg-[var(--primary)] text-white"
                            : "bg-[var(--surface-container)] text-[var(--t2)]"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                {payerAutoFilled && payerSuggestions.includes(newPayment.paid_by) && (
                  <p className="mt-1.5 text-xs text-[var(--t3)]">
                    Filled from the parent on file. Edit it if someone else paid.
                  </p>
                )}
              </div>
              <div>
                <FeePicker
                  fees={fees ?? []}
                  defaultFeeId={defaultFeeId}
                  value={feeId ?? ""}
                  onChange={(id) => onFeeChange?.(id)}
                  label="Paying Which Fee"
                />
                {errors.fee_id && <p className="mt-1 text-xs text-[var(--red)]">{errors.fee_id}</p>}
              </div>
              <div>
                <label
                  htmlFor="payment-notes"
                  className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2"
                >
                  Notes
                </label>
                <input
                  id="payment-notes"
                  type="text"
                  value={newPayment.notes}
                  onChange={(e) => onPaymentChange({ notes: e.target.value })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3.5 px-4 text-sm text-[var(--t1)]"
                  placeholder="Additional notes"
                />
              </div>
            </div>
            <div className="sticky bottom-0 z-10 flex gap-3 border-t border-[var(--border)] bg-[var(--surface)] py-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 min-h-[48px] py-3 bg-[var(--surface-container-low)] border border-[var(--border)] text-[var(--t2)] font-semibold rounded-xl active:scale-[0.98] transition-transform"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={saving || Boolean(submitDisabledReason)}
                className="flex-[2] min-h-[48px] py-3 bg-[var(--primary)] text-[var(--on-primary)] font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform tabular-nums"
              >
                {saving ? "Saving..." : amountNum > 0 ? `Record ${formatCurrency(amountNum)}` : "Record Payment"}
              </button>
            </div>
            {submitDisabledReason && <p className="text-xs text-[var(--t3)] text-right">{submitDisabledReason}</p>}
          </>
        )}
      </form>
    </Modal>
  );
}
