"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { splitBalance } from "@/lib/fee-triage";
import { loadSchoolSetting } from "@/lib/school-settings";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, StatStrip } from "@/components/ui/index";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import { ChildSelector } from "@/components/parent-portal/ChildSelector";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";
import {
  calculateFeeStats,
  groupFeesByTerm,
  nextDueDate,
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
  // Clearance comes from the same engine the bursar's screen uses. It gates
  // report-card release only -- never exams or class placement.
  const [clearance, setClearance] = useState<{ isCleared: boolean; balance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"mobile_money" | "cash" | "bank" | "in_kind">("mobile_money");
  const [payReference, setPayReference] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payStep, setPayStep] = useState<"form" | "sent">("form");
  // Where the parent should actually send the money. Schools set these in
  // Settings; when empty we fall back to "pay at the school office".
  const [payDetails, setPayDetails] = useState<{
    momo: string;
    airtel: string;
    instructions: string;
  }>({ momo: "", airtel: "", instructions: "" });
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
                "id, amount_paid, payment_date, payment_method, payment_reference, student_fee_terms!inner(student_id, fee_terms(name))",
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
              .select("id, name, amount, term, due_date")
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

  useEffect(() => {
    if (!selectedChild || isDemo) {
      setClearance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/parent/fee-clearance/?studentId=${encodeURIComponent(selectedChild.id)}`);
        const json = await res.json();
        if (!cancelled && res.ok && json?.success) {
          setClearance({
            isCleared: Boolean(json.data?.isCleared),
            balance: Number(json.data?.balance || 0),
          });
        }
      } catch {
        // Clearance is advisory here; a failed check must not hide the balance.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChild, isDemo]);

  // Where this school wants parents to send money. Read once on mount so the
  // pay sheet always shows the school's real numbers, never a guess.
  useEffect(() => {
    if (isDemo) {
      setPayDetails({ momo: "0772 000 111", airtel: "0700 000 222", instructions: "" });
      return;
    }
    const schoolId = selectedChild?.school_id;
    if (!schoolId) return;
    let cancelled = false;
    (async () => {
      try {
        const momo = await loadSchoolSetting<string>(schoolId, "payment_momo_number", "");
        const airtel = await loadSchoolSetting<string>(schoolId, "payment_airtel_number", "");
        const instructions = await loadSchoolSetting<string>(schoolId, "payment_instructions", "");
        if (cancelled) return;
        setPayDetails({ momo, airtel, instructions });
      } catch {
        // Fall back to the generic "pay at the office" copy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemo, selectedChild?.school_id]);

  const stats = useMemo(() => calculateFeeStats(feeStructure, payments), [feeStructure, payments]);

  const paidPct = stats.totalFee > 0 ? Math.round((stats.totalPaid / stats.totalFee) * 100) : 0;

  const feeGroups = useMemo(() => groupFeesByTerm(feeStructure), [feeStructure]);

  const nextDue = useMemo(() => nextDueDate(feeStructure), [feeStructure]);

  // In demo mode there is no server clearance row; mirror the balance shown.
  const effectiveClearance = isDemo ? { isCleared: stats.balance <= 0, balance: stats.balance } : clearance;

  const openPaySheet = () => {
    setPayAmount(stats.balance > 0 ? String(stats.balance) : "");
    setPayStep("form");
    setShowPayModal(true);
  };

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
          // Deliberately null: recorded_by is a staff column, and this is the
          // parent paying. The description already says who acted, so the row
          // explains itself instead of carrying an unattributed gap.
          p_recorded_by: null,
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

  // Manual payment flow. The parent pays the school directly (Momo/Airtel/cash)
  // and tells us about it here; the bursar confirms once the money lands. This
  // replaces the in-app mobile-money push, which is deferred.
  const submitPaymentClaim = async () => {
    if (!selectedChild) return;
    const amountValue = Number(payAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Enter the amount you paid.");
      return;
    }
    setPayLoading(true);

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 700));
      setPayStep("sent");
      setPayLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/parent/fee-payment-claims/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          studentId: selectedChild.id,
          amount: amountValue,
          method: payMethod,
          reference: payReference.trim() || undefined,
          note: payNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data?.error || "Could not send your payment details. Please try again.");
        return;
      }
      setPayStep("sent");
      toast.success("Sent. The school will confirm your payment.");
      await fetchFees(selectedChild);
    } catch {
      toast.error("Network problem. Please try again.");
    } finally {
      setPayLoading(false);
    }
  };

  const closePayModal = () => {
    setShowPayModal(false);
    setPayStep("form");
    setPayAmount("");
    setPayReference("");
    setPayNote("");
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

        <StatStrip
          columns={4}
          items={[
            {
              label: "Outstanding",
              value: `UGX ${stats.balance.toLocaleString()}`,
              tone: stats.balance > 0 ? "negative" : "positive",
              hint: stats.balance > 0 ? "still to pay" : "fully cleared",
            },
            {
              label: "Paid so far",
              value: `UGX ${stats.totalPaid.toLocaleString()}`,
              tone: "positive",
              hint: `${paidPct}% of billed fees`,
            },
            {
              label: "Total billed",
              value: `UGX ${stats.totalFee.toLocaleString()}`,
              tone: "default",
              hint: `${feeStructure.length} fee line${feeStructure.length === 1 ? "" : "s"}`,
            },
            {
              label: "Next due",
              value: nextDue ? nextDue.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—",
              tone: nextDue ? "warning" : "default",
              hint: nextDue ? "term due date" : "no due date set",
            },
          ]}
        />

        {effectiveClearance && !effectiveClearance.isCleared && effectiveClearance.balance > 0 && (
          <Card className="border-[var(--amber)]/40 bg-[var(--amber-soft)]/40">
            <CardBody className="flex items-start gap-3">
              <MaterialIcon icon="lock_clock" className="mt-0.5 text-2xl text-[var(--amber)]" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-[var(--t1)]">Report card withheld</p>
                <p className="text-sm text-[var(--t2)]">
                  UGX {effectiveClearance.balance.toLocaleString()} is still outstanding, so the school is holding{" "}
                  {selectedChild ? `${selectedChild.first_name}'s` : "the"} report card.
                </p>
                <p className="text-xs text-[var(--t3)]">
                  Exams and class placement are not affected. Pay the school, then ask the bursar to release the card.
                </p>
                <Button size="sm" className="mt-2" onClick={openPaySheet} disabled={!selectedChild}>
                  <MaterialIcon icon="bolt" /> Pay now
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="space-y-4 bg-[var(--portal-surface-tint)]">
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
                <Button onClick={openPaySheet} disabled={!selectedChild}>
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
                <div className="space-y-4">
                  {feeGroups.map((group) => (
                    <div key={group.key} className="space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                          {group.label}
                        </p>
                        <p className="text-xs font-semibold tabular-nums text-[var(--on-surface-variant)]">
                          UGX {group.total.toLocaleString()}
                        </p>
                      </div>
                      {group.items.map((fee) => (
                        <div
                          key={fee.id}
                          className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface-container-low)] p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[var(--on-surface)]">{fee.name}</p>
                            {fee.due_date && (
                              <p className="text-xs text-[var(--on-surface-variant)]">
                                Due{" "}
                                {new Date(fee.due_date).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                            )}
                          </div>
                          <p className="shrink-0 text-sm font-black tabular-nums text-[var(--on-surface)]">
                            UGX {Number(fee.amount).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <p className="text-sm font-semibold text-[var(--on-surface)]">Total billed</p>
                    <p className="text-sm font-black tabular-nums text-[var(--on-surface)]">
                      UGX {stats.totalFee.toLocaleString()}
                    </p>
                  </div>
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
                          <p className="text-xs text-[var(--on-surface-variant)]">
                            {payment.fee_structure?.name || "Payment"} · {payment.payment_method || "Recorded"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[var(--on-surface-variant)]">
                            {new Date(payment.payment_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          {payment.payment_reference && (
                            <p className="text-xs font-mono text-[var(--on-surface-variant)]">
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
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-[var(--on-surface)]">Wallet Activity</h2>
                <span className="text-xs font-bold tabular-nums text-[var(--primary)]">
                  UGX {walletBalance.toLocaleString()}
                </span>
              </div>
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
                          <p className="text-xs text-[var(--on-surface-variant)]">
                            {transaction.description || "Wallet entry"}
                          </p>
                          {transaction.reference && (
                            <p className="text-xs font-mono text-[var(--on-surface-variant)]">
                              {transaction.reference}
                            </p>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                              WALLET_BADGE_STYLES[transaction.type]
                            }`}
                          >
                            {transaction.type}
                          </span>
                          <p className="text-xs text-[var(--on-surface-variant)]">
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
            <div className="relative bg-[var(--surface)] rounded-3xl w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto shadow-2xl p-8 space-y-5">
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
                <label className="text-xs font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
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
                    className="rounded-xl border border-[var(--border)] py-2 text-xs font-black text-[var(--on-surface-variant)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div className="bg-[var(--surface)] rounded-3xl w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto shadow-2xl p-6 space-y-5">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h2 className="text-xl font-black text-[var(--on-surface)]">Pay School Fees</h2>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    {selectedChild ? `${selectedChild.first_name}'s fee payment` : "Select a learner first"}
                  </p>
                </div>
                <button
                  onClick={closePayModal}
                  className="tap-44 p-2 hover:bg-[var(--surface-container)] rounded-xl shrink-0"
                >
                  <MaterialIcon icon="close" />
                </button>
              </div>

              {payStep === "form" ? (
                <>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-container-low)] p-4 space-y-3">
                    <p className="text-xs font-black uppercase tracking-widest text-[var(--t3)]">
                      Send your payment to
                    </p>
                    {payDetails.momo ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[var(--on-surface)] flex items-center gap-2">
                          <MaterialIcon icon="smartphone" className="text-[var(--primary)]" /> MTN MoMo
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(payDetails.momo.replace(/\s/g, ""));
                            toast.success("Number copied");
                          }}
                          className="font-mono text-sm font-bold text-[var(--primary)] underline underline-offset-2 shrink-0"
                        >
                          {payDetails.momo}
                        </button>
                      </div>
                    ) : null}
                    {payDetails.airtel ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[var(--on-surface)] flex items-center gap-2">
                          <MaterialIcon icon="smartphone" className="text-[var(--error)]" /> Airtel Money
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(payDetails.airtel.replace(/\s/g, ""));
                            toast.success("Number copied");
                          }}
                          className="font-mono text-sm font-bold text-[var(--error)] underline underline-offset-2 shrink-0"
                        >
                          {payDetails.airtel}
                        </button>
                      </div>
                    ) : null}
                    {!payDetails.momo && !payDetails.airtel ? (
                      <p className="text-sm text-[var(--on-surface-variant)]">
                        Please pay at the school office, or use the number the school gave you.
                      </p>
                    ) : null}
                    {payDetails.instructions ? (
                      <p className="text-sm text-[var(--on-surface-variant)]">{payDetails.instructions}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
                      Amount you paid (UGX)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={payAmount}
                      onChange={(event) => setPayAmount(event.target.value)}
                      placeholder="e.g. 100000"
                      className="input w-full"
                    />
                    {stats.balance > 0 && (
                      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-[var(--on-surface-variant)]">
                          Can&apos;t clear UGX {stats.balance.toLocaleString()} at once? Split it
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {[2, 3, 4].map((n) => {
                            const part = splitBalance(stats.balance, n);
                            const picked = payAmount.trim() === String(part);
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setPayAmount(String(part))}
                                aria-pressed={picked}
                                className={`min-h-[44px] rounded-xl border px-2 py-2 text-center transition-colors ${
                                  picked
                                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--t2)] hover:border-[var(--primary)]/40"
                                }`}
                              >
                                <span className="block text-sm font-bold tabular-nums">
                                  {n} × {part.toLocaleString()}
                                </span>
                                <span className="block text-xs opacity-70">per payment</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-xs text-[var(--t3)]">
                          Tap a split to fill the amount, then pay it the same way each time.
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
                      How did you pay?
                    </label>
                    <select
                      value={payMethod}
                      onChange={(event) =>
                        setPayMethod(event.target.value as "mobile_money" | "cash" | "bank" | "in_kind")
                      }
                      className="input w-full"
                    >
                      <option value="mobile_money">Mobile Money</option>
                      <option value="cash">Cash at the office</option>
                      <option value="bank">Bank transfer</option>
                      <option value="in_kind">In kind</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
                      Reference (optional)
                    </label>
                    <input
                      type="text"
                      value={payReference}
                      onChange={(event) => setPayReference(event.target.value)}
                      placeholder="Momo/Airtel confirmation code"
                      className="input w-full"
                    />
                    <p className="text-xs text-[var(--t3)] mt-1.5">
                      If you have one, add the code from your Momo/Airtel receipt so the school can match it quickly.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-2">
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      value={payNote}
                      onChange={(event) => setPayNote(event.target.value)}
                      placeholder="Anything the school should know"
                      className="input w-full"
                    />
                  </div>

                  <Button
                    onClick={submitPaymentClaim}
                    loading={payLoading}
                    disabled={!selectedChild || !payAmount.trim()}
                    className="w-full"
                  >
                    <MaterialIcon icon="check_circle" />{" "}
                    {payAmount.trim()
                      ? `I've paid UGX ${Number(payAmount).toLocaleString()} — send to school`
                      : "I've paid — send to school"}
                  </Button>

                  <p className="text-xs text-[var(--t3)] text-center leading-relaxed">
                    Your balance updates once the school confirms they received the money.
                  </p>

                  <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-container-low)] p-3">
                    <p className="text-xs text-[var(--t3)] flex items-start gap-2">
                      <MaterialIcon icon="schedule" className="text-sm shrink-0" />
                      <span>
                        <span className="font-bold text-[var(--t2)]">Coming soon:</span> paying straight from this
                        portal without leaving the app. For now, pay the school directly and tell us here.
                      </span>
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center gap-4 py-6">
                  <div className="w-14 h-14 rounded-full bg-[var(--green-soft)] flex items-center justify-center">
                    <MaterialIcon icon="check_circle" className="text-3xl text-[var(--green)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--on-surface)]">Sent to the school</h3>
                    <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                      The school will confirm your payment once they receive the money. Your balance updates then.
                    </p>
                  </div>
                  <Button onClick={closePayModal} className="w-full">
                    Done
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ParentPortalShell>
  );
}
