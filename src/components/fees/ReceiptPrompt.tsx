"use client";
import { useEffect, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { formatCurrency } from "@/lib/currency";

interface ReceiptPromptProps {
  isOpen: boolean;
  studentName?: string;
  amount?: number;
  parentPhone?: string | null;
  onSendWhatsApp: () => void;
  onSendSms: () => void;
  onViewReceipt: () => void;
  onDismiss: () => void;
  /** How long it waits, untouched, before it gets out of the way. */
  autoDismissMs?: number;
}

/**
 * "Payment added -- send a receipt?"
 *
 * A bursar takes a payment and the whole screen changed: a receipt modal
 * opened over the fees list. It had to be closed before the next parent
 * could be served, and it covered the list the bursar was working down. So
 * the payment used to interrupt the one moment when the bursar wants to
 * carry on.
 *
 * Now the payment lands and a small bar comes up from the bottom: what was
 * added, and the two ways a parent actually wants a receipt -- WhatsApp or
 * SMS. It goes away on its own after a few seconds of nobody touching it, so
 * the bursar can keep going; touching it keeps it up.
 */
export default function ReceiptPrompt({
  isOpen,
  studentName,
  amount,
  parentPhone,
  onSendWhatsApp,
  onSendSms,
  onViewReceipt,
  onDismiss,
  autoDismissMs = 3000,
}: ReceiptPromptProps) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);

  const close = () => {
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      onDismiss();
    }, 180);
  };

  useEffect(() => {
    if (!isOpen) return;

    const arm = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setLeaving(true);
        window.setTimeout(() => {
          setLeaving(false);
          onDismiss();
        }, 180);
      }, autoDismissMs);
    };

    // Any sign of attention buys more time: a tap, a scroll, a key.
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;
    for (const event of events) window.addEventListener(event, arm, { passive: true });
    arm();

    return () => {
      for (const event of events) window.removeEventListener(event, arm);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [isOpen, autoDismissMs, onDismiss]);

  if (!isOpen) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[9995] flex justify-center px-3"
      style={{ bottom: "calc(var(--mobile-nav-clearance, 84px) + 12px)" }}
    >
      <div
        className={`pointer-events-auto w-full max-w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_18px_44px_rgba(15,23,42,0.28)] transition-all duration-200 ${
          leaving ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--green-soft,#dcfce7)] text-[var(--green,#16a34a)]">
            <MaterialIcon icon="check_circle" style={{ fontSize: 22 }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--t1)]">
              Payment added{studentName ? ` · ${studentName}` : ""}
            </p>
            <p className="truncate text-xs text-[var(--t3)]">
              {amount !== undefined ? `${formatCurrency(amount)} received` : "Recorded"}
              {parentPhone ? " · send a receipt?" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--t3)] hover:bg-[var(--surface-container-low)]"
          >
            <MaterialIcon icon="close" style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onSendWhatsApp}
            disabled={!parentPhone}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1f8f4d] px-3 text-sm font-bold text-white disabled:opacity-40"
          >
            <MaterialIcon icon="chat" style={{ fontSize: 18 }} />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={onSendSms}
            disabled={!parentPhone}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] px-3 text-sm font-bold text-[var(--t1)] disabled:opacity-40"
          >
            <MaterialIcon icon="sms" style={{ fontSize: 18 }} />
            SMS
          </button>
          <button
            type="button"
            onClick={onViewReceipt}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] px-3 text-sm font-semibold text-[var(--t2)]"
          >
            <MaterialIcon icon="receipt" style={{ fontSize: 18 }} />
            Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
