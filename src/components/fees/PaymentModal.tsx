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
    if (
      selectedStudent &&
      Number(newPayment.amount_paid) > selectedStudent.balance
    ) {
      errs.amount_paid = `Amount exceeds student balance of ${formatCurrency(selectedStudent.balance)}`;
    }
    if (
      newPayment.payment_method === "mobile_money" &&
      !newPayment.momo_transaction_id
    ) {
      errs.momo_transaction_id = "Transaction ID is required for mobile money";
    }
    return errs;
  }, [newPayment, selectedStudent]);

  const step1Valid = !errors.student_id && !errors.amount_paid;

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

  const handleClose = () => {
    setStep(1);
    setTouched({});
    onClose();
  };

  const handleNext = () => {
    if (step1Valid) {
      setTouched({ student_id: true, amount_paid: true });
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-outline-variant/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline font-bold text-xl text-primary">
              Record Payment
            </h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-surface-container rounded-lg transition-colors"
            >
              <MaterialIcon icon="close" className="text-onSurface-variant" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${step >= 1 ? "bg-primary text-white" : "bg-surface-container text-onSurface-variant"}`}
            >
              1
            </div>
            <div
              className={`flex-1 h-0.5 rounded transition-colors ${step >= 2 ? "bg-primary" : "bg-surface-container"}`}
            />
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${step >= 2 ? "bg-primary text-white" : "bg-surface-container text-onSurface-variant"}`}
            >
              2
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-onSurface-variant">
              Student & Amount
            </span>
            <span className="text-[11px] text-onSurface-variant">
              Payment Details
            </span>
          </div>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-5" noValidate>
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Student
                </label>
                {students.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                    No students found - add students first
                  </div>
                ) : (
                  <>
                    <select
                      value={newPayment.student_id}
                      onChange={(e) =>
                        onPaymentChange({ student_id: e.target.value })
                      }
                      onBlur={() => handleBlur("student_id")}
                      className={`w-full rounded-xl py-3 px-4 text-sm transition-colors ${errorBorder("student_id")}`}
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
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Amount (UGX)
                </label>
                <input
                  type="number"
                  min="1"
                  value={newPayment.amount_paid}
                  onChange={(e) =>
                    onPaymentChange({ amount_paid: e.target.value })
                  }
                  onBlur={() => handleBlur("amount_paid")}
                  className={`w-full rounded-xl py-3 px-4 text-sm transition-colors ${errorBorder("amount_paid")}`}
                  required
                  placeholder="0"
                />
                {fieldError("amount_paid") && (
                  <p className="text-xs text-[var(--red)] mt-1 flex items-center gap-1">
                    <MaterialIcon className="text-sm">error</MaterialIcon>
                    {fieldError("amount_paid")}
                  </p>
                )}
                {selectedStudent &&
                  newPayment.amount_paid &&
                  Number(newPayment.amount_paid) > 0 &&
                  !fieldError("amount_paid") && (
                    <p className="text-xs text-[var(--green)] mt-1">
                      Balance after payment:{" "}
                      {formatCurrency(
                        Math.max(
                          0,
                          selectedStudent.balance -
                            Number(newPayment.amount_paid),
                        ),
                      )}
                    </p>
                  )}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl"
                >
                  Next
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Method
                </label>
                <select
                  value={newPayment.payment_method}
                  onChange={(e) =>
                    onPaymentChange({ payment_method: e.target.value })
                  }
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="installment">Installment</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Payment Reference
                </label>
                <input
                  type="text"
                  value={newPayment.payment_reference}
                  onChange={(e) =>
                    onPaymentChange({ payment_reference: e.target.value })
                  }
                  className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
                  placeholder="e.g. Receipt number"
                />
              </div>
              {newPayment.payment_method === "mobile_money" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                      MoMo Provider
                    </label>
                    <select
                      value={newPayment.momo_provider}
                      onChange={(e) =>
                        onPaymentChange({
                          momo_provider: e.target.value as "mtn" | "airtel",
                        })
                      }
                      className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
                    >
                      <option value="mtn">MTN</option>
                      <option value="airtel">Airtel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                      Transaction ID
                    </label>
                    <input
                      type="text"
                      value={newPayment.momo_transaction_id}
                      onChange={(e) =>
                        onPaymentChange({ momo_transaction_id: e.target.value })
                      }
                      onBlur={() => handleBlur("momo_transaction_id")}
                      className={`w-full rounded-xl py-3 px-4 text-sm transition-colors ${errorBorder("momo_transaction_id")}`}
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                    Paid By
                  </label>
                  <input
                    type="text"
                    value={newPayment.paid_by}
                    onChange={(e) =>
                      onPaymentChange({ paid_by: e.target.value })
                    }
                    className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
                    placeholder="Name of payer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={newPayment.notes}
                    onChange={(e) => onPaymentChange({ notes: e.target.value })}
                    className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm"
                    placeholder="Additional notes"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
