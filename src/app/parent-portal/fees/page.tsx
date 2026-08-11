"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import { ChildSelector } from "@/components/parent-portal/ChildSelector";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";
import {
  calculateFeeStats,
  ParentPortalFeeStructureItem,
  ParentPortalPayment,
  ParentPortalWalletTransaction,
  normalizeFeeTermItems,
  normalizePayments,
  normalizeWalletTransactions,
  pickPreferredSchemaRows,
} from "@/lib/parent-portal";
import {
  getDemoFeeStructure,
  getDemoPayments,
  getDemoWalletBalance,
  getDemoWalletTransactions,
} from "@/lib/parent-portal-demo";

const WALLET_BADGE_STYLES: Record<ParentPortalWalletTransaction["type"], string> = {
  topup: "bg-emerald-50 text-emerald-700 border-emerald-200",
  spend: "bg-amber-50 text-amber-700 border-amber-200",
  refund: "bg-blue-50 text-blue-700 border-blue-200",
  adjustment: "bg-slate-100 text-slate-700 border-slate-200",
};

const QUICK_TOPUP_AMOUNTS = [5000, 10000, 20000, 50000] as const;

export default function ParentFeesPage() {
  const { isDemo } = useAuth();
  const toast = useToast();
  const { selectedChild } = useParentPortal();
  const [feeStructure, setFeeStructure] = useState<ParentPortalFeeStructureItem[]>([]);
  const [payments, setPayments] = useState<ParentPortalPayment[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState<ParentPortalWalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payProvider, setPayProvider] = useState<"mtn" | "airtel">("mtn");
  const [payPhone, setPayPhone] = useState("");
  const [payStep, setPayStep] = useState<"form" | "sent" | "verifying">("form");
  const [payTxRef, setPayTxRef] = useState("");
  const [payInstructions, setPayInstructions] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  const fetchFees = useCallback(
    async (child: typeof selectedChild) => {
      if (!child) return;
      setLoading(true);

      if (isDemo) {
        setFeeStructure(getDemoFeeStructure(child.id));
        setPayments(getDemoPayments(child.id));
        setWalletBalance(getDemoWalletBalance(child.id));
        setWalletTransactions(getDemoWalletTransactions(child.id));
        setLoading(false);
        return;
      }

      try {
        const [modernFeeTermsRes, modernPaymentsRes, walletRes] = await Promise.all([
          withTimeout(
            supabase
              .from("student_fee_terms")
              .select("id, final_amount, academic_year, fee_terms(name)")
              .eq("student_id", child.id)
              .order("created_at", { ascending: false }),
            12000,
            timeoutFallback(),
          ),
          withTimeout(
            supabase
              .from("fee_payments")
              .select(
                "id, amount, payment_date, payment_method, transaction_reference, student_fee_terms!inner(student_id, fee_terms(name))",
              )
              .eq("student_fee_terms.student_id", child.id)
              .order("payment_date", { ascending: false }),
            12000,
            timeoutFallback(),
          ),
          withTimeout(
            supabase.from("student_wallets").select("id, balance").eq("student_id", child.id).maybeSingle(),
            12000,
            timeoutFallback(),
          ),
        ]);

        const [legacyFeeTermsRes, legacyPaymentsRes] = await Promise.all([
          withTimeout(
            supabase
              .from("fee_structure")
              .select("id, name, amount, term")
              .eq("school_id", child.school_id)
              .is("deleted_at", null)
              .or(`class_id.is.null,class_id.eq.${child.class_id}`),
            12000,
            timeoutFallback(),
          ),
          withTimeout(
            supabase
              .from("fee_payments")
              .select("id, amount_paid, payment_date, payment_method, payment_reference, fee_structure:fee_id(name)")
              .eq("student_id", child.id)
              .is("deleted_at", null)
              .order("payment_date", { ascending: false }),
            12000,
            timeoutFallback(),
          ),
        ]);

        const feeRows = pickPreferredSchemaRows({
          modernRows: normalizeFeeTermItems((modernFeeTermsRes.data || []) as never[]),
          modernError: modernFeeTermsRes.error,
          legacyRows: (legacyFeeTermsRes.data || []) as ParentPortalFeeStructureItem[],
          legacyError: legacyFeeTermsRes.error,
        });

        const modernPaymentRows = normalizePayments((modernPaymentsRes.data || []) as never[]);
        const legacyPaymentRows = normalizePayments((legacyPaymentsRes.data || []) as never[]);

        // Union modern + legacy payment rows (dedupe by id) so mobile money
        // payments recorded without a fee-term link still show on the portal.
        const paymentRows = !modernPaymentsRes.error
          ? [...modernPaymentRows, ...legacyPaymentRows.filter((p) => !modernPaymentRows.some((m) => m.id === p.id))]
          : legacyPaymentRows;

        const walletId = walletRes.data?.id;
        let walletTxData: ParentPortalWalletTransaction[] = [];

        if (walletId) {
          const modernWalletTxRes = await withTimeout(
            supabase
              .from("wallet_transactions")
              .select("id, amount, transaction_type, reference_id, description, created_at")
              .eq("wallet_id", walletId)
              .order("created_at", { ascending: false })
              .limit(8),
            12000,
            timeoutFallback(),
          );

          if (!modernWalletTxRes.error) {
            walletTxData = normalizeWalletTransactions(modernWalletTxRes.data || []);
          } else {
            const legacyWalletTxRes = await withTimeout(
              supabase
                .from("wallet_transactions")
                .select("id, amount, type, reference, description, created_at")
                .eq("student_id", child.id)
                .order("created_at", { ascending: false })
                .limit(8),
              12000,
              timeoutFallback(),
            );

            if (!legacyWalletTxRes.error) {
              walletTxData = normalizeWalletTransactions(legacyWalletTxRes.data || []);
            }
          }
        }

        setFeeStructure(feeRows);
        setPayments(paymentRows);
        setWalletBalance(Number(walletRes.data?.balance || 0));
        setWalletTransactions(walletTxData);
      } finally {
        setLoading(false);
      }
    },
    [isDemo],
  );

  useEffect(() => {
    if (selectedChild) {
      fetchFees(selectedChild);
    }
  }, [selectedChild, fetchFees]);

  const stats = useMemo(() => calculateFeeStats(feeStructure, payments), [feeStructure, payments]);

  const paidPct = stats.totalFee > 0 ? Math.round((stats.totalPaid / stats.totalFee) * 100) : 0;

  const handleTopup = async () => {
    if (!selectedChild) return;
    const amount = Number(topupAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid top-up amount.");
      return;
    }

    setTopupLoading(true);

    if (isDemo) {
      const createdAt = new Date().toISOString();
      setWalletBalance((current) => current + amount);
      setWalletTransactions((current) => [
        {
          id: `demo-wallet-${Date.now()}`,
          amount,
          type: "topup",
          reference: `PAR-${Date.now()}`,
          description: "Pocket money top-up",
          created_at: createdAt,
        },
        ...current,
      ]);
      setTopupAmount("");
      setShowTopup(false);
      setTopupLoading(false);
      toast.success("Pocket money added successfully.");
      return;
    }

    try {
      const { error } = await withTimeout(
        supabase.rpc("topup_student_wallet", {
          p_student_id: selectedChild.id,
          p_amount: amount,
          p_description: "Top-up by Parent via Portal",
          p_ref: `PAR-${Date.now()}`,
        }),
        12000,
        timeoutFallback(),
      );

      if (error) {
        throw error;
      }

      await fetchFees(selectedChild);
      setTopupAmount("");
      setShowTopup(false);
      toast.success("Pocket money added successfully.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Top-up failed");
    } finally {
      setTopupLoading(false);
    }
  };

  const startPay = async () => {
    if (!selectedChild) return;
    const amountValue = Number(payAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Enter a valid amount to pay.");
      return;
    }
    if (!payPhone || payPhone.replace(/\D/g, "").length < 9) {
      toast.error("Enter a valid phone number.");
      return;
    }
    setPayLoading(true);

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 1200));
      setPayTxRef(`DEMO-FEES-${Date.now()}`);
      setPayInstructions(
        `A payment request for UGX ${amountValue.toLocaleString()} has been sent to ${payPhone.replace(/\D/g, "").replace(/^0?/, "256")}. Check your phone and enter your PIN to confirm.`,
      );
      setPayStep("sent");
      setPayLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/parent/fee-payment/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          childId: selectedChild.id,
          amount: amountValue,
          provider: payProvider,
          phoneNumber: payPhone,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Payment could not be started.");
        return;
      }
      setPayTxRef(data.txRef);
      setPayInstructions(data.instructions);
      setPayStep("sent");
    } finally {
      setPayLoading(false);
    }
  };

  const verifyPay = async () => {
    if (!selectedChild || !payTxRef) return;
    setPayLoading(true);
    setPayStep("verifying");

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 1500));
      const amountValue = Number(payAmount || 0);
      const createdAt = new Date().toISOString();
      setPayments((current) => [
        {
          id: `demo-fees-${Date.now()}`,
          amount_paid: amountValue,
          payment_date: createdAt,
          payment_method: payProvider === "airtel" ? "Airtel Money" : "MTN MoMo",
          payment_reference: payTxRef,
          fee_structure: null,
        },
        ...current,
      ]);
      setShowPayModal(false);
      setPayStep("form");
      setPayTxRef("");
      setPayAmount("");
      toast.success(`Payment of UGX ${amountValue.toLocaleString()} confirmed.`);
      setPayLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/parent/fee-payment/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          childId: selectedChild.id,
          reference: payTxRef,
          provider: payProvider,
          amount: Number(payAmount || 0),
        }),
      });
      const data = await res.json();
      if (data.success && data.status === "completed") {
        setShowPayModal(false);
        setPayStep("form");
        setPayTxRef("");
        setPayAmount("");
        toast.success("Payment confirmed and recorded.");
        await fetchFees(selectedChild);
      } else {
        toast.error(data.message || "Payment not yet confirmed. Try again in a moment.");
        setPayStep("sent");
      }
    } catch {
      toast.error("Unable to verify payment. Try again.");
      setPayStep("sent");
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <ParentPortalShell pageTitle="Fees & Receipts">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader
          title="Fees & Receipts"
          subtitle="See what fees are due, what you have paid, and top up your child’s canteen wallet"
          variant="premium"
        />

        <ChildSelector />

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              label: "Total Fee",
              value: `UGX ${stats.totalFee.toLocaleString()}`,
              icon: "receipt_long",
              color: "text-[var(--on-surface)]",
            },
            {
              label: "Paid",
              value: `UGX ${stats.totalPaid.toLocaleString()}`,
              icon: "check_circle",
              color: "text-emerald-600",
            },
            {
              label: "Balance",
              value: `UGX ${stats.balance.toLocaleString()}`,
              icon: stats.balance > 0 ? "warning" : "verified",
              color: stats.balance > 0 ? "text-red-600" : "text-emerald-600",
            },
            {
              label: "Wallet Balance",
              value: `UGX ${walletBalance.toLocaleString()}`,
              icon: "account_balance_wallet",
              color: walletBalance > 0 ? "text-[var(--primary)]" : "text-slate-500",
            },
          ].map((item) => (
            <Card key={item.label}>
              <CardBody className="flex items-center gap-4 bg-[linear-gradient(180deg,var(--portal-surface-tint)_0%,var(--portal-surface)_100%)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--surface-container-low)] border border-[var(--border)]">
                  <MaterialIcon icon={item.icon} className={`text-2xl ${item.color}`} />
                </div>
                <div>
                  <p className={`text-xl font-semibold tracking-[-0.03em] ${item.color}`}>{item.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                    {item.label}
                  </p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        <Card>
          <CardBody className="space-y-4 bg-[linear-gradient(180deg,var(--portal-surface-tint)_0%,var(--portal-surface-gray-2)_100%)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--on-surface)]">Payment Progress</p>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {selectedChild
                    ? `${selectedChild.first_name}'s fee and canteen snapshot`
                    : "Select a learner to view details"}
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setShowTopup(true)} disabled={!selectedChild} variant="secondary">
                  <MaterialIcon icon="add_card" /> Wallet Top-up
                </Button>
                <Button
                  onClick={() => {
                    setPayAmount(stats.balance > 0 ? String(stats.balance) : "");
                    setPayStep("form");
                    setShowPayModal(true);
                  }}
                  disabled={!selectedChild}
                >
                  <MaterialIcon icon="bolt" /> Pay Fees
                </Button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm font-black text-[var(--primary)]">{paidPct}%</p>
              <p className="text-xs text-[var(--on-surface-variant)]">
                {stats.balance > 0
                  ? `UGX ${stats.balance.toLocaleString()} still outstanding`
                  : "Fees are fully cleared"}
              </p>
            </div>
            <div className="h-3 w-full bg-[var(--surface-container-highest)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  paidPct >= 100 ? "bg-emerald-500" : paidPct >= 50 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${paidPct}%` }}
              />
            </div>
          </CardBody>
        </Card>

        <div className="grid xl:grid-cols-3 gap-6">
          <Card>
            <CardBody>
              <h2 className="font-semibold text-[var(--on-surface)] mb-4">Fee Structure</h2>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-10 bg-[var(--surface-container)] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : feeStructure.length === 0 ? (
                <p className="text-sm text-[var(--on-surface-variant)] text-center py-4">No fee structure set</p>
              ) : (
                <div className="space-y-2">
                  {feeStructure.map((fee) => (
                    <div
                      key={fee.id}
                      className="flex justify-between items-center p-3 bg-[var(--surface-container-low)] rounded-[18px] border border-[var(--border)]"
                    >
                      <div>
                        <p className="font-bold text-sm text-[var(--on-surface)]">{fee.name}</p>
                        {fee.term && <p className="text-[10px] text-[var(--on-surface-variant)]">{fee.term}</p>}
                      </div>
                      <p className="font-black text-sm text-[var(--on-surface)]">
                        UGX {Number(fee.amount).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="font-semibold text-[var(--on-surface)] mb-4">Payment History</h2>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-10 bg-[var(--surface-container)] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <p className="text-sm text-[var(--on-surface-variant)] text-center py-4">No payments recorded yet</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="p-3 bg-[var(--surface-container-low)] rounded-[18px] border border-[var(--border)]"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm text-emerald-600">
                            UGX {Number(payment.amount_paid).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-[var(--on-surface-variant)]">
                            {payment.fee_structure?.name || "Payment"} · {payment.payment_method || "Recorded"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-[var(--on-surface-variant)]">
                            {new Date(payment.payment_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          {payment.payment_reference && (
                            <p className="text-[10px] font-mono text-[var(--on-surface-variant)]">
                              {payment.payment_reference}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="font-semibold text-[var(--on-surface)] mb-4">Wallet Activity</h2>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-10 bg-[var(--surface-container)] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : walletTransactions.length === 0 ? (
                <p className="text-sm text-[var(--on-surface-variant)] text-center py-4">
                  No wallet activity recorded yet
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {walletTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="p-3 bg-[var(--surface-container-low)] rounded-[18px] border border-[var(--border)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-sm text-[var(--on-surface)]">
                            UGX {Number(transaction.amount).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-[var(--on-surface-variant)]">
                            {transaction.description || "Wallet entry"}
                          </p>
                          {transaction.reference && (
                            <p className="text-[10px] font-mono text-[var(--on-surface-variant)]">
                              {transaction.reference}
                            </p>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              WALLET_BADGE_STYLES[transaction.type]
                            }`}
                          >
                            {transaction.type}
                          </span>
                          <p className="text-[10px] text-[var(--on-surface-variant)]">
                            {new Date(transaction.created_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {showTopup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div className="bg-[var(--surface)] rounded-3xl w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto shadow-2xl p-8 space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-[var(--on-surface)]">Add Pocket Money</h2>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    {selectedChild ? `Top up ${selectedChild.first_name}'s canteen wallet` : "Select a learner first"}
                  </p>
                </div>
                <button
                  onClick={() => setShowTopup(false)}
                  className="p-2 hover:bg-[var(--surface-container)] rounded-xl"
                >
                  <MaterialIcon icon="close" />
                </button>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
                  Amount (UGX)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={topupAmount}
                  onChange={(event) => setTopupAmount(event.target.value)}
                  placeholder="e.g. 10000"
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {QUICK_TOPUP_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTopupAmount(amount.toString())}
                    className="rounded-xl border border-[var(--border)] py-2 text-[10px] font-black text-[var(--on-surface-variant)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  >
                    {amount.toLocaleString()}
                  </button>
                ))}
              </div>

              <Button
                onClick={handleTopup}
                disabled={!selectedChild || !topupAmount.trim() || topupLoading}
                loading={topupLoading}
                className="w-full"
              >
                <MaterialIcon icon="add_card" /> Confirm Top-up
              </Button>
            </div>
          </div>
        )}

        {showPayModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div className="bg-[var(--surface)] rounded-3xl w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto shadow-2xl p-8 space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-[var(--on-surface)]">Pay Fees by Mobile Money</h2>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    {selectedChild ? `${selectedChild.first_name}'s fee payment` : "Select a learner first"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPayModal(false);
                    setPayStep("form");
                  }}
                  className="p-2 hover:bg-[var(--surface-container)] rounded-xl"
                >
                  <MaterialIcon icon="close" />
                </button>
              </div>

              {payStep === "form" ? (
                <>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
                      Amount (UGX)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={payAmount}
                      onChange={(event) => setPayAmount(event.target.value)}
                      placeholder="e.g. 100000"
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
                      Mobile Money Provider
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["mtn", "airtel"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPayProvider(p)}
                          className={`rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                            payProvider === p
                              ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent"
                              : "border-[var(--border)] text-[var(--on-surface-variant)] hover:border-[var(--primary)]"
                          }`}
                        >
                          {p === "mtn" ? "MTN MoMo" : "Airtel Money"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={payPhone}
                      onChange={(event) => setPayPhone(event.target.value)}
                      placeholder="07XX XXX XXX"
                      className="input w-full"
                    />
                  </div>

                  <Button
                    onClick={startPay}
                    disabled={!selectedChild || !payAmount.trim() || !payPhone.trim() || payLoading}
                    loading={payLoading}
                    className="w-full"
                  >
                    <MaterialIcon icon="bolt" /> Request Payment
                  </Button>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-[var(--surface-container-low)] border border-[var(--border)] p-4 space-y-2">
                    <div className="flex items-center gap-2 text-[var(--primary)]">
                      <MaterialIcon icon={payStep === "verifying" ? "hourglass_top" : "smartphone"} />
                      <p className="text-sm font-black text-[var(--on-surface)]">
                        {payStep === "verifying" ? "Confirming payment…" : "Check your phone"}
                      </p>
                    </div>
                    <p className="text-sm text-[var(--on-surface-variant)]">{payInstructions}</p>
                    <p className="text-xs font-mono text-[var(--t3)]">Ref: {payTxRef}</p>
                  </div>

                  {payStep === "sent" && (
                    <Button onClick={verifyPay} loading={payLoading} className="w-full">
                      <MaterialIcon icon="verified" /> I&apos;ve Entered My PIN
                    </Button>
                  )}
                  {payStep === "verifying" && (
                    <div className="flex items-center justify-center gap-2 text-sm text-[var(--t3)]">
                      <span className="w-4 h-4 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
                      Checking payment status…
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ParentPortalShell>
  );
}
