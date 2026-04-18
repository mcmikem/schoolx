"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";
import {
  calculateFeeStats,
  mapParentStudentLinks,
  ParentPortalChild,
  ParentPortalFeeStructureItem,
  ParentPortalPayment,
  ParentPortalWalletTransaction,
  normalizeFeeTermItems,
  normalizePayments,
  normalizeWalletTransactions,
  pickPreferredSchemaRows,
  resolveSelectedChild,
} from "@/lib/parent-portal";
import {
  getDemoChildren,
  getDemoFeeStructure,
  getDemoPayments,
  getDemoWalletBalance,
  getDemoWalletTransactions,
} from "@/lib/parent-portal-demo";

const WALLET_BADGE_STYLES: Record<
  ParentPortalWalletTransaction["type"],
  string
> = {
  topup: "bg-emerald-50 text-emerald-700 border-emerald-200",
  spend: "bg-amber-50 text-amber-700 border-amber-200",
  refund: "bg-blue-50 text-blue-700 border-blue-200",
  adjustment: "bg-slate-100 text-slate-700 border-slate-200",
};

const QUICK_TOPUP_AMOUNTS = [5000, 10000, 20000, 50000] as const;

export default function ParentFeesPage() {
  const { user, isDemo } = useAuth();
  const { isAuthorized, isChecking } = useParentPortalGuard();
  const toast = useToast();
  const [children, setChildren] = useState<ParentPortalChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentPortalChild | null>(
    null,
  );
  const [feeStructure, setFeeStructure] = useState<
    ParentPortalFeeStructureItem[]
  >([]);
  const [payments, setPayments] = useState<ParentPortalPayment[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState<
    ParentPortalWalletTransaction[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  const fetchChildren = useCallback(async () => {
    if (isDemo) {
      setChildren(getDemoChildren());
      return;
    }
    const parentId = user?.id;
    if (!parentId) return;
    const { data } = await supabase
      .from("parent_students")
      .select(
        "student:students(id, first_name, last_name, school_id, class_id, class:classes(name))",
      )
      .eq("parent_id", parentId);
    setChildren(mapParentStudentLinks(data || []));
  }, [user?.id, isDemo]);

  useEffect(() => {
    setSelectedChild((current) => resolveSelectedChild(children, current?.id));
  }, [children]);

  const fetchFees = useCallback(
    async (child: ParentPortalChild | null) => {
      const scopedChild = resolveSelectedChild(children, child?.id);
      if (!scopedChild) return;
      setLoading(true);

      if (isDemo) {
        setFeeStructure(getDemoFeeStructure(scopedChild.id));
        setPayments(getDemoPayments(scopedChild.id));
        setWalletBalance(getDemoWalletBalance(scopedChild.id));
        setWalletTransactions(getDemoWalletTransactions(scopedChild.id));
        setLoading(false);
        return;
      }

      try {
        const [modernFeeTermsRes, modernPaymentsRes, walletRes] =
          await Promise.all([
            supabase
              .from("student_fee_terms")
              .select("id, final_amount, academic_year, fee_terms(name)")
              .eq("student_id", scopedChild.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("fee_payments")
              .select(
                "id, amount, payment_date, payment_method, transaction_reference, student_fee_terms!inner(student_id, fee_terms(name))",
              )
              .eq("student_fee_terms.student_id", scopedChild.id)
              .order("payment_date", { ascending: false }),
            supabase
              .from("student_wallets")
              .select("id, balance")
              .eq("student_id", scopedChild.id)
              .maybeSingle(),
          ]);

        const [legacyFeeTermsRes, legacyPaymentsRes] = await Promise.all([
          supabase
            .from("fee_structure")
            .select("id, name, amount, term")
            .eq("school_id", scopedChild.school_id)
            .is("deleted_at", null)
            .or(`class_id.is.null,class_id.eq.${scopedChild.class_id}`),
          supabase
            .from("fee_payments")
            .select(
              "id, amount_paid, payment_date, payment_method, payment_reference, fee_structure:fee_id(name)",
            )
            .eq("student_id", scopedChild.id)
            .is("deleted_at", null)
            .order("payment_date", { ascending: false }),
        ]);

        const feeRows = pickPreferredSchemaRows({
          modernRows: normalizeFeeTermItems(
            (modernFeeTermsRes.data || []) as never[],
          ),
          modernError: modernFeeTermsRes.error,
          legacyRows:
            (legacyFeeTermsRes.data || []) as ParentPortalFeeStructureItem[],
          legacyError: legacyFeeTermsRes.error,
        });

        const paymentRows = pickPreferredSchemaRows({
          modernRows: normalizePayments((modernPaymentsRes.data || []) as never[]),
          modernError: modernPaymentsRes.error,
          legacyRows: normalizePayments((legacyPaymentsRes.data || []) as never[]),
          legacyError: legacyPaymentsRes.error,
        });

        const walletId = walletRes.data?.id;
        let walletTxData: ParentPortalWalletTransaction[] = [];

        if (walletId) {
          const modernWalletTxRes = await supabase
            .from("wallet_transactions")
            .select(
              "id, amount, transaction_type, reference_id, description, created_at",
            )
            .eq("wallet_id", walletId)
            .order("created_at", { ascending: false })
            .limit(8);

          if (!modernWalletTxRes.error) {
            walletTxData = normalizeWalletTransactions(
              modernWalletTxRes.data || [],
            );
          } else {
            const legacyWalletTxRes = await supabase
              .from("wallet_transactions")
              .select("id, amount, type, reference, description, created_at")
              .eq("student_id", scopedChild.id)
              .order("created_at", { ascending: false })
              .limit(8);

            if (!legacyWalletTxRes.error) {
              walletTxData = normalizeWalletTransactions(
                legacyWalletTxRes.data || [],
              );
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
    [isDemo, children],
  );

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    if (selectedChild) {
      fetchFees(selectedChild);
    }
  }, [selectedChild, fetchFees]);

  const stats = useMemo(
    () => calculateFeeStats(feeStructure, payments),
    [feeStructure, payments],
  );

  const paidPct =
    stats.totalFee > 0 ? Math.round((stats.totalPaid / stats.totalFee) * 100) : 0;

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
      const { error } = await supabase.rpc("topup_student_wallet", {
        p_student_id: selectedChild.id,
        p_amount: amount,
        p_description: "Top-up by Parent via Portal",
        p_ref: `PAR-${Date.now()}`,
      });

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

  if (isChecking || !isAuthorized) {
    return null;
  }

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader
          title="Fees & Receipts"
          subtitle="Track fee obligations, receipts, and student wallet activity"
        />

        {children.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
                  selectedChild?.id === child.id
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                }`}
              >
                {child.first_name} {child.last_name}
              </button>
            ))}
          </div>
        )}

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
              <CardBody className="flex items-center gap-4">
                <MaterialIcon icon={item.icon} className={`text-3xl ${item.color}`} />
                <div>
                  <p className={`text-xl font-black ${item.color}`}>{item.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                    {item.label}
                  </p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--on-surface)]">
                  Payment Progress
                </p>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {selectedChild
                    ? `${selectedChild.first_name}'s fee and canteen snapshot`
                    : "Select a learner to view details"}
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowTopup(true)}
                  disabled={!selectedChild}
                  variant="secondary"
                >
                  <MaterialIcon icon="add_card" /> Wallet Top-up
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
                  paidPct >= 100
                    ? "bg-emerald-500"
                    : paidPct >= 50
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${paidPct}%` }}
              />
            </div>
          </CardBody>
        </Card>

        <div className="grid xl:grid-cols-3 gap-6">
          <Card>
            <CardBody>
              <h2 className="font-bold text-[var(--on-surface)] mb-4">
                Fee Structure
              </h2>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-10 bg-[var(--surface-container)] rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : feeStructure.length === 0 ? (
                <p className="text-sm text-[var(--on-surface-variant)] text-center py-4">
                  No fee structure set
                </p>
              ) : (
                <div className="space-y-2">
                  {feeStructure.map((fee) => (
                    <div
                      key={fee.id}
                      className="flex justify-between items-center p-3 bg-[var(--surface-container-low)] rounded-2xl"
                    >
                      <div>
                        <p className="font-bold text-sm text-[var(--on-surface)]">
                          {fee.name}
                        </p>
                        {fee.term && (
                          <p className="text-[10px] text-[var(--on-surface-variant)]">
                            {fee.term}
                          </p>
                        )}
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
              <h2 className="font-bold text-[var(--on-surface)] mb-4">
                Payment History
              </h2>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-10 bg-[var(--surface-container)] rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <p className="text-sm text-[var(--on-surface-variant)] text-center py-4">
                  No payments recorded yet
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="p-3 bg-[var(--surface-container-low)] rounded-2xl"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm text-emerald-600">
                            UGX {Number(payment.amount_paid).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-[var(--on-surface-variant)]">
                            {payment.fee_structure?.name || "Payment"} ·{" "}
                            {payment.payment_method || "Recorded"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-[var(--on-surface-variant)]">
                            {new Date(payment.payment_date).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
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
              <h2 className="font-bold text-[var(--on-surface)] mb-4">
                Wallet Activity
              </h2>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-10 bg-[var(--surface-container)] rounded-xl animate-pulse"
                    />
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
                      className="p-3 bg-[var(--surface-container-low)] rounded-2xl"
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
                            {new Date(transaction.created_at).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-[var(--surface)] rounded-3xl w-full max-w-md shadow-2xl p-8 space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-[var(--on-surface)]">
                    Add Pocket Money
                  </h2>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    {selectedChild
                      ? `Top up ${selectedChild.first_name}'s canteen wallet`
                      : "Select a learner first"}
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
      </div>
    </PageErrorBoundary>
  );
}
