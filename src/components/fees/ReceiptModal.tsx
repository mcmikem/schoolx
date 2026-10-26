"use client";
import type { RefObject } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/currency";

interface ReceiptModalProps {
  isOpen: boolean;
  student: { name: string; student_number: string; paid: number; balance: number } | null;
  schoolName: string;
  onClose: () => void;
  onPrint: () => void;
  paymentDate?: string;
  paymentAmount?: number;
  receiptNumber?: string | null;
  schoolDetails?: { phone?: string; email?: string; code?: string; logoUrl?: string; color?: string };
  contentRef?: RefObject<HTMLDivElement>;
}

/**
 * The receipt, as a slip of paper rather than a list of rows.
 *
 * This is the document a parent is handed across a desk, and the one a bursar
 * keeps in a receipt book. It used to be a table of labels and values in a
 * modal, which reads as a debug panel: no school, no receipt number, no
 * total worth photographing, and nothing that says the money was received.
 *
 * So it is now a receipt: the school at the top, the receipt number, the
 * pupil, the amount in hand, the balance, and a footer. The dashed rules and
 * the monospaced figures are the ones a thermal printer produces, so what the
 * bursar prints and what the parent sees on the phone are the same document.
 *
 * The classes are semantic (`receipt-row`, `receipt-value`, ...) as well as
 * styled: the print window has no Tailwind, so it styles these names
 * instead. Without them the printed receipt came out unstyled.
 */
export default function ReceiptModal({
  isOpen,
  student,
  schoolName,
  onClose,
  onPrint,
  paymentDate,
  paymentAmount,
  receiptNumber,
  schoolDetails,
  contentRef,
}: ReceiptModalProps) {
  if (!isOpen || !student) return null;

  const schoolColor = schoolDetails?.color || "#0b1c39";
  const balance = student.balance;
  const settled = balance <= 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fee Payment Receipt" size="sm">
      <div
        ref={contentRef}
        className="receipt-paper mx-auto max-w-[340px] rounded-lg bg-white px-5 py-6 text-[#1a1a1a] shadow-[0_18px_40px_rgba(15,23,42,0.18)] ring-1 ring-black/5"
        style={{ borderTop: `4px solid ${schoolColor}` }}
      >
        {/* The school, the way it is letterhead. */}
        <header className="receipt-header text-center">
          {schoolDetails?.logoUrl ? (
            <img
              src={schoolDetails.logoUrl}
              alt=""
              className="receipt-logo mx-auto mb-2 h-14 w-14 rounded-xl object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="receipt-logo mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl text-lg font-black text-white"
              style={{ background: schoolColor }}
            >
              {schoolName.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className="receipt-school text-lg font-black leading-tight" style={{ color: schoolColor }}>
            {schoolName}
          </h2>
          {(schoolDetails?.code || schoolDetails?.phone || schoolDetails?.email) && (
            <p className="receipt-meta mt-1 text-[11px] leading-snug text-[#666]">
              {[
                schoolDetails?.code ? `Code ${schoolDetails.code}` : null,
                schoolDetails?.phone ? `Tel ${schoolDetails.phone}` : null,
                schoolDetails?.email,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          )}
          <p className="receipt-title mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#888]">
            Official Fee Receipt
          </p>
        </header>

        <div className="receipt-rule my-4 border-t border-dashed border-[#d4d4d8]" />

        <div className="receipt-row flex items-baseline justify-between gap-3 py-1.5">
          <span className="receipt-label text-[12px] text-[#666]">Receipt no.</span>
          <span className="receipt-value font-mono text-[13px] font-bold">{receiptNumber || "—"}</span>
        </div>
        {!receiptNumber && (
          <p className="mt-1 text-right text-[10px] text-[#999]">
            Number issued when the payment syncs
          </p>
        )}
        {paymentDate && (
          <div className="receipt-row flex items-baseline justify-between gap-3 py-1.5">
            <span className="receipt-label text-[12px] text-[#666]">Date</span>
            <span className="receipt-value font-mono text-[13px] font-bold">
              {new Date(`${paymentDate.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB")}
            </span>
          </div>
        )}

        <div className="receipt-rule my-2 border-t border-dashed border-[#d4d4d8]" />

        <div className="receipt-row flex items-baseline justify-between gap-3 py-1.5">
          <span className="receipt-label text-[12px] text-[#666]">Pupil</span>
          <span className="receipt-value text-[13px] font-bold">{student.name}</span>
        </div>
        <div className="receipt-row flex items-baseline justify-between gap-3 py-1.5">
          <span className="receipt-label text-[12px] text-[#666]">Student no.</span>
          <span className="receipt-value font-mono text-[13px]">{student.student_number}</span>
        </div>

        <div className="receipt-rule my-2 border-t border-dashed border-[#d4d4d8]" />

        {paymentAmount !== undefined && (
          <div className="receipt-row flex items-baseline justify-between gap-3 py-1.5">
            <span className="receipt-label text-[12px] text-[#666]">This payment</span>
            <span className="receipt-value font-mono text-[13px] font-bold text-[#0f7b3f]">
              {formatCurrency(paymentAmount)}
            </span>
          </div>
        )}
        <div className="receipt-row flex items-baseline justify-between gap-3 py-1.5">
          <span className="receipt-label text-[12px] text-[#666]">Total paid</span>
          <span className="receipt-value font-mono text-[13px] font-bold">{formatCurrency(student.paid)}</span>
        </div>
        <div className="receipt-row flex items-baseline justify-between gap-3 py-1.5">
          <span className="receipt-label text-[12px] text-[#666]">Balance</span>
          <span
            className={`receipt-value receipt-balance font-mono text-[13px] font-bold ${
              settled ? "text-[#0f7b3f]" : "text-[#b42318]"
            }`}
          >
            {formatCurrency(balance)}
          </span>
        </div>

        {/* The amount, once more and large: this is the number the parent
            photographs and the number the bursar reads across a desk. */}
        <div className="receipt-total mt-5 border-t-2 pt-4 text-center" style={{ borderColor: schoolColor }}>
          <p className="receipt-total-label text-[10px] font-bold uppercase tracking-[0.2em] text-[#888]">
            Amount received
          </p>
          <p className="receipt-amount font-mono text-2xl font-black" style={{ color: schoolColor }}>
            {formatCurrency(paymentAmount ?? student.paid)}
          </p>
          <p
            className={`receipt-stamp mt-2 inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${
              settled ? "bg-[#e7f6ec] text-[#0f7b3f]" : "bg-[#fdeceb] text-[#b42318]"
            }`}
          >
            {settled ? "Paid in full" : "Balance outstanding"}
          </p>
        </div>

        <div className="receipt-rule my-4 border-t border-dashed border-[#d4d4d8]" />

        <footer className="receipt-footer text-center text-[11px] leading-snug text-[#888]">
          <p className="receipt-thanks font-bold" style={{ color: schoolColor }}>
            Thank you for your payment
          </p>
          <p className="mt-1">Keep this slip. It is your proof of payment.</p>
        </footer>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          onClick={onPrint}
          className="w-full min-h-[44px] rounded-xl bg-primary py-3 font-semibold text-white flex items-center justify-center gap-2"
        >
          <MaterialIcon icon="print" className="text-lg" />
          Print Receipt
        </button>
        <button
          onClick={onClose}
          className="w-full min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 text-sm font-semibold text-[var(--t2)]"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
