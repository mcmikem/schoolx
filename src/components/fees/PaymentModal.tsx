"use client";
import { useState, useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface PaymentData {
  student_id: string;
  amount_paid: string;
  payment_method: string;
  payment_reference: string;
  momo_provider: "mtn" | "airtel";
  momo_transaction_id: string;
  paid_by: string;
  notes: string;
  allow_overpayment: boolean;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Array<{ id: string; name: string; balance: number }>;
  onSubmit: (e: React.FormEvent) => void;
  newPayment: PaymentData;
  onPaymentChange: (updates: Record<string, unknown>) => void;
  saving: boolean;
}

const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

export default function PaymentModal({
  isOpen,
  onClose,
  students,
  onSubmit,
  newPayment,
  onPaymentChange,
  saving,
}: PaymentModalProps) {
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === newPayment.student_id),
    [students, newPayment.student_id],
  );

  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!newPayment.student_id) errs.student_id = "Please select a student";
    if (!newPayment.amount_paid || Number(newPayment.amount_paid) <= 0) {
      errs.amount_paid = "Amount must be greater than 0";
    }
    if (selectedStudent && Number(newPayment.amount_paid) > selectedStudent.balance && !newPayment.allow_overpayment) {
      errs.amount_paid = `Amount exceeds student balance of ${formatCurrency(selectedStudent.balance)}`;
    }
    if (newPayment.payment_method === "mobile_money" && !newPayment.momo_transaction_id) {
      errs.momo_transaction_id = "Transaction ID is required for mobile money";
    }
    return errs;
  }, [newPayment, selectedStudent]);
  const overpaymentAmount =
    selectedStudent && Number(newPayment.amount_paid) > selectedStudent.balance
      ? Number(newPayment.amount_paid) - selectedStudent.balance
      : 0;

  const step1Valid = !errors.student_id && !errors.amount_paid;
  const submitDisabledReason = !step1Valid
    ? "Complete the student and amount fields first."
    : errors.momo_transaction_id || errors.amount_paid || errors.student_id
      ? errors.momo_transaction_id || errors.amount_paid || errors.student_id || ""
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

  const fieldError = (field: string) => (touched[field] && errors[field] ? errors[field] : null);

  const errorBorder = (field: string) =>
    fieldError(field)
      ? "border-2 border-[var(--red)] bg-[var(--surface)]"
      : "border border-[var(--border)] bg-[var(--surface)]";

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

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-hidden shadow-xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline font-bold text-xl text-[var(--t1)] tracking-tight">Record Payment</h2>
            <button
              onClick={handleClose}
              aria-label="Close payment dialog"
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--t3)] transition-colors hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)]"
            >
              <MaterialIcon icon="close" className="text-onSurface-variant" />
            </button>
          </div>
          {selectedStudent && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--t1)] truncate">{selectedStudent.name}</div>
                <div className="text-xs text-[var(--t3)] tabular-nums">
                  Owes {formatCurrency(selectedStudent.balance)}
                  {balanceAfter !== null && amountNum > 0 ? ` → ${formatCurrency(balanceAfter)} left` : ""}
                </div>
              </div>
              <span className="badge badge-red flex-shrink-0">Unpaid</span>
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
            <span className="text-[11px] font-semibold text-[var(--t3)]">Student & Amount</span>
            <span className="text-[11px] font-semibold text-[var(--t3)]">Payment Details</span>
          </div>
        </div>
        <form
          onSubmit={onSubmit}
          className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-11rem)]"
          noValidate
        >
          {step === 1 && (
            <>
              <div>
                <label
                  htmlFor="payment-student"
                  className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2"
                >
                  Student
                </label>
                {students.length === 0 ? (
                  <div className="rounded-xl p-3 text-sm font-medium border border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--t1)]">
                    No students found - add students first
                  </div>
                ) : (
                  <>
                    <select
                      id="payment-student"
                      value={newPayment.student_id}
                      onChange={(e) => onPaymentChange({ student_id: e.target.value })}
                      onBlur={() => handleBlur("student_id")}
                      className={`w-full rounded-xl py-3.5 px-4 text-sm text-[var(--t1)] transition-colors ${errorBorder("student_id")}`}
                      required
                    >
                      <option value="">Select student</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} - {formatCurrency(s.balance)}
                        </option>
                      ))}
                    </select>
                    {fieldError("student_id") && (
                      <p className="text-xs text-[var(--red)] mt-1 flex items-center gap-1">
                        <MaterialIcon className="text-sm">error</MaterialIcon>
                        {fieldError("student_id")}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div>
                <label
                  htmlFor="payment-amount"
                  className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2"
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
                        className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold border transition-colors active:scale-[0.97] ${
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
                  <p className="text-xs text-[var(--red)] mt-1 flex items-center gap-1">
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
              <div className="flex gap-3 pt-2">
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
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2">
                  Method
                </label>
                <select
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
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2">
                  Payment Reference
                </label>
                <input
                  type="text"
                  value={newPayment.payment_reference}
                  onChange={(e) => onPaymentChange({ payment_reference: e.target.value })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3.5 px-4 text-sm text-[var(--t1)]"
                  placeholder="e.g. Receipt number"
                />
              </div>
              {newPayment.payment_method === "in_kind" && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2">
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
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2">
                      MoMo Provider
                    </label>
                    <select
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
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2">
                      Transaction ID
                    </label>
                    <input
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
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2">
                    Paid By
                  </label>
                  <input
                    type="text"
                    value={newPayment.paid_by}
                    onChange={(e) => onPaymentChange({ paid_by: e.target.value })}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3.5 px-4 text-sm text-[var(--t1)]"
                    placeholder="Name of payer"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={newPayment.notes}
                    onChange={(e) => onPaymentChange({ notes: e.target.value })}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3.5 px-4 text-sm text-[var(--t1)]"
                    placeholder="Additional notes"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
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
                  {saving ? "Saving..." : amountNum > 0 ? `Pay ${formatCurrency(amountNum)}` : "Record Payment"}
                </button>
              </div>
              {submitDisabledReason && <p className="text-xs text-[var(--t3)] text-right">{submitDisabledReason}</p>}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
