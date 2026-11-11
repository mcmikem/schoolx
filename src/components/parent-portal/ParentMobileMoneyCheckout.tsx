"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/Toast";
import { useOnlineStatus } from "@/lib/offline";

export type ParentMobileMoneyPurpose = "wallet_topup" | "fee_payment";

export interface ParentMobileMoneyChild {
  id: string;
  first_name: string;
}

type PaymentStatus = "initiating" | "pending" | "initiation_unknown" | "completed" | "failed";
type Payment = {
  id: string;
  purpose: ParentMobileMoneyPurpose;
  provider: "mtn" | "airtel";
  amount: number;
  currency: string;
  phoneLast4: string;
  status: PaymentStatus;
  providerStatus?: string | null;
  failureCode?: string | null;
  message?: string;
};

export default function ParentMobileMoneyCheckout({
  isOpen,
  onClose,
  child,
  purpose,
  defaultAmount = "",
  isDemo = false,
  onPaymentConfirmed,
}: {
  isOpen: boolean;
  onClose: () => void;
  child: ParentMobileMoneyChild | null;
  purpose: ParentMobileMoneyPurpose;
  defaultAmount?: string;
  isDemo?: boolean;
  onPaymentConfirmed: (amount: number) => void;
}) {
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const [amount, setAmount] = useState(defaultAmount);
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<"mtn" | "airtel">("mtn");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [availableProviders, setAvailableProviders] = useState<{ mtn: boolean; airtel: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const paymentRef = useRef<Payment | null>(payment);

  useEffect(() => {
    paymentRef.current = payment;
  }, [payment]);

  useEffect(() => {
    if (!isOpen || !child) return;
    setAmount(defaultAmount);
    setPayment(null);
    setChecked(false);
    setAvailableProviders(isDemo ? { mtn: true, airtel: true } : null);
    let cancelled = false;
    if (!isDemo) {
      const params = new URLSearchParams({ studentId: child.id, purpose });
      fetch(`/api/parent/mobile-money/?${params.toString()}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((result) => {
          const recovered = result?.success ? (result.data?.payment as Payment | null) : null;
          if (!cancelled && result?.success && result.data?.providers) {
            const available = result.data.providers as { mtn: boolean; airtel: boolean };
            setAvailableProviders(available);
            if (!available.mtn && available.airtel) setProvider("airtel");
          }
          if (!cancelled && recovered) {
            setPayment(recovered);
            setAmount(String(recovered.amount));
            setProvider(recovered.provider);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, child, purpose, defaultAmount, isDemo]);

  const refreshPayment = useCallback(async () => {
    const currentPayment = paymentRef.current;
    if (!currentPayment || isDemo || currentPayment.status === "completed" || currentPayment.status === "failed") {
      return currentPayment;
    }
    const response = await fetch(`/api/parent/mobile-money/?paymentId=${encodeURIComponent(currentPayment.id)}`, {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result?.success) throw new Error(result?.error || "Could not check payment status.");
    const updated = result.data?.payment as Payment | null;
    if (updated) {
      setPayment((previous) => {
        if (
          previous &&
          previous.id === updated.id &&
          previous.status === updated.status &&
          previous.providerStatus === updated.providerStatus &&
          previous.failureCode === updated.failureCode
        ) {
          return previous;
        }
        paymentRef.current = updated;
        return updated;
      });
    }
    return updated;
  }, [isDemo]);

  useEffect(() => {
    if (!isOpen || !payment || isDemo || payment.status === "completed" || payment.status === "failed") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const updated = await refreshPayment();
        if (cancelled || !updated) return;
        if (updated.status === "completed" && !checked) {
          setChecked(true);
          toast.success(
            purpose === "wallet_topup"
              ? "Payment confirmed. Pocket money is ready."
              : "Payment confirmed. Fee balance updated.",
          );
          onPaymentConfirmed(updated.amount);
        } else if (updated.status === "failed") {
          setChecked(true);
          toast.error("The payment was not completed. No balance was changed.");
        }
      } catch {
        // Network trouble must never turn a pending payment into a failed one.
      }
    };
    const timer = window.setInterval(() => void poll(), 7000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isOpen, payment?.id, payment?.status, isDemo, checked, refreshPayment, onPaymentConfirmed, purpose, toast]);

  const startPayment = async () => {
    const parsedAmount = Number(amount);
    if (!child) return;
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount < 500 || parsedAmount > 5_000_000) {
      toast.error("Enter a whole amount from UGX 500 to UGX 5,000,000.");
      return;
    }
    if (!/^((\+?256)|0)?7\d{8}$/.test(phone.replace(/[\s()-]/g, ""))) {
      toast.error("Enter a valid Ugandan mobile number, for example 0772 123 456.");
      return;
    }
    setLoading(true);
    if (isDemo) {
      const simulated: Payment = {
        id: `demo-${Date.now()}`,
        purpose,
        provider,
        amount: parsedAmount,
        currency: "UGX",
        phoneLast4: phone.slice(-4),
        status: "completed",
        message: "Demo only. No money was moved.",
      };
      setPayment(simulated);
      setLoading(false);
      onPaymentConfirmed(parsedAmount);
      toast.success("Demo payment complete. No real money was moved.");
      return;
    }

    try {
      const response = await fetch("/api/parent/mobile-money/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: child.id,
          purpose,
          provider,
          amount: parsedAmount,
          phone,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.error || "Could not start the payment.");
      const created = result.data?.payment as Payment | undefined;
      if (!created) throw new Error("The payment service did not return a payment status.");
      setPayment(created);
      setAmount(String(created.amount));
      if (created.status === "failed") {
        toast.error(created.message || "The provider did not accept the request. No balance was changed.");
      } else if (created.status === "completed") {
        setChecked(true);
        onPaymentConfirmed(created.amount);
      } else if (created.status === "initiation_unknown") {
        toast.info(
          created.message ||
            "We are checking whether the phone request reached the network. Do not start another payment yet.",
        );
      } else {
        toast.info(created.message || "Payment request sent. Approve it on your phone.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the payment.");
    } finally {
      setLoading(false);
    }
  };

  const title = purpose === "wallet_topup" ? "Add Pocket Money" : "Pay School Fees";
  const settled = payment?.status === "completed";
  const failed = payment?.status === "failed";
  const waiting = payment && !settled && !failed;
  const providerAvailable = isDemo || availableProviders?.[provider] === true;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto"
    >
      <div className="space-y-5">
        <p className="text-sm text-[var(--on-surface-variant)]">
          {purpose === "wallet_topup"
            ? `Add money to ${child?.first_name || "your learner"}'s canteen wallet.`
            : `Pay ${child?.first_name || "your learner"}'s outstanding school fees.`}
        </p>

        {isDemo && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">
            Demo only. This preview will not request money or move real funds.
          </p>
        )}

        {!payment && (
          <>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Mobile money network">
              {(["mtn", "airtel"] as const).map((network) => (
                <button
                  key={network}
                  type="button"
                  aria-pressed={provider === network}
                  onClick={() => setProvider(network)}
                  disabled={availableProviders !== null && !availableProviders[network]}
                  className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    provider === network
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface-variant)]"
                  }`}
                >
                  {network === "mtn" ? "MTN MoMo" : "Airtel Money"}
                </button>
              ))}
            </div>

            {availableProviders && !availableProviders.mtn && !availableProviders.airtel && !isDemo && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                This school has not connected live mobile money yet. Please ask the school office to enable it, or use
                the manual payment option on the Fees page.
              </p>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                Amount (UGX)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={500}
                max={5_000_000}
                step={1000}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="input w-full"
                placeholder="e.g. 10,000"
                disabled={loading}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                Phone to charge
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="input w-full"
                placeholder="0772 123 456"
                disabled={loading}
              />
              <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
                You will approve the request with your mobile money PIN on your phone.
              </span>
            </label>

            {!isOnline && (
              <p className="rounded-xl bg-[var(--amber-soft)] px-3 py-2 text-xs font-semibold text-[var(--amber-ink)]">
                Connect to the internet before requesting a mobile money prompt.
              </p>
            )}

            <Button
              onClick={() => void startPayment()}
              loading={loading}
              disabled={!child || !isOnline || !providerAvailable}
              className="w-full"
            >
              <MaterialIcon icon="lock" /> Request secure phone prompt
            </Button>
            <p className="text-center text-xs leading-5 text-[var(--on-surface-variant)]">
              No money is taken until you approve the prompt. SkoolMate waits for provider confirmation before updating
              the balance.
            </p>
          </>
        )}

        {waiting && (
          <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-800"
                aria-hidden="true"
              />
              <div>
                <h3 className="font-bold">Waiting for phone approval</h3>
                <p className="mt-1 text-sm leading-5">
                  Approve UGX {payment.amount.toLocaleString()} on the{" "}
                  {payment.provider === "mtn" ? "MTN MoMo" : "Airtel Money"} phone ending in {payment.phoneLast4}. Keep
                  this page open; SkoolMate will check the result.
                </p>
                {payment.status === "initiation_unknown" && (
                  <p className="mt-2 text-xs font-semibold">
                    We are confirming whether the request reached the network. Do not start another payment.
                  </p>
                )}
              </div>
            </div>
            <Button type="button" variant="secondary" className="w-full" onClick={() => void refreshPayment()}>
              Check payment status
            </Button>
          </div>
        )}

        {settled && (
          <div
            className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
            role="status"
          >
            <div className="flex items-center gap-2 font-bold">
              <MaterialIcon icon="check_circle" className="text-2xl" /> Payment confirmed
            </div>
            <p className="text-sm leading-5">
              UGX {payment.amount.toLocaleString()} has been{" "}
              {purpose === "wallet_topup" ? "added to the canteen wallet" : "recorded against school fees"}.
            </p>
            <Button className="w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        )}

        {failed && (
          <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950" role="status">
            <div className="flex items-center gap-2 font-bold">
              <MaterialIcon icon="error" className="text-2xl" /> Payment not completed
            </div>
            <p className="text-sm leading-5">
              No wallet credit or fee payment was recorded. Check the network and phone, then try again.
            </p>
            <Button className="w-full" onClick={() => setPayment(null)}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
