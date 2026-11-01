"use client";
// Super-admin: confirm or reject manual (cash/bank) subscription payments
// submitted by schools from Billing & Plans. Confirms activate the exact
// intent stored on the payment (renew / upgrade / module add-ons).

import { useCallback, useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";

interface ManualPaymentRow {
  id: string;
  school_id: string;
  plan: string;
  amount: number;
  currency: string;
  provider: string;
  transaction_id: string;
  payment_status: string;
  phone_number: string | null;
  description: string | null;
  payment_method_detail: string | null;
  intent: {
    type?: string;
    plan?: string;
    cycle?: string;
    moduleKeys?: string[];
    months?: number;
  } | null;
  created_at: string;
  schools: { name: string; school_code: string } | null;
}

export default function ManualPaymentsSection() {
  const toast = useToast();
  const [rows, setRows] = useState<ManualPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/manual-payment/?scope=pending");
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Failed to load");
      setRows(body.data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load manual payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (row: ManualPaymentRow, decision: "confirm" | "reject") => {
    let reason = "";
    if (decision === "reject") {
      reason = window.prompt(`Reason for rejecting ${row.transaction_id}?`) || "";
      if (!reason.trim()) return;
    }
    setActingOn(row.id);
    try {
      const res = await fetch("/api/billing/manual-payment/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: row.id, decision, reason }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || `${decision} failed`);
      toast.success(
        decision === "confirm"
          ? `Payment confirmed — ${row.schools?.name || "school"} activated`
          : "Payment marked as failed",
      );
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingOn(null);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-['Sora'] text-[14px] font-bold text-[var(--t1)]">Manual Payment Confirmations</h3>
          <p className="text-[12px] text-[var(--t3)] mt-0.5">
            Cash / bank payments submitted by schools. Confirm after verifying the reference against your account or
            statement.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] text-[var(--t2)] text-[12px] font-semibold transition-colors disabled:opacity-40"
        >
          <MaterialIcon icon="refresh" style={{ fontSize: 15 }} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <span className="text-[13px] text-[var(--t3)]">Loading…</span>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <MaterialIcon icon="verified" style={{ fontSize: 30, color: "var(--t3)" }} />
          <p className="text-[13px] text-[var(--t3)] mt-2">No manual payments awaiting confirmation.</p>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-['Sora'] text-[13px] font-bold text-[var(--t1)] truncate">
                  {row.schools?.name || "Unknown school"}
                </span>
                <span className="text-xs text-[var(--t3)]">{row.schools?.school_code}</span>
                <span className="px-2 py-0.5 rounded-full bg-[var(--surface-container-low)] text-[10px] font-bold uppercase text-[var(--t2)]">
                  {row.provider}
                </span>
              </div>
              <p className="text-[12px] text-[var(--t2)] mt-1">
                {row.description || "Subscription payment"} ·{" "}
                <span className="font-semibold">UGX {Number(row.amount || 0).toLocaleString()}</span>
              </p>
              {row.payment_method_detail && (
                <p className="text-[11px] text-[var(--t3)] mt-0.5 truncate">{row.payment_method_detail}</p>
              )}
              <p className="text-[11px] text-[var(--t3)] mt-0.5">
                Ref <span className="font-mono">{row.transaction_id}</span> ·{" "}
                {new Date(row.created_at).toLocaleDateString()}
                {row.intent?.type === "module" && row.intent.moduleKeys?.length
                  ? ` · modules: ${row.intent.moduleKeys.join(", ")}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => act(row, "confirm")}
                disabled={actingOn === row.id}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors disabled:opacity-40"
              >
                {actingOn === row.id ? "Confirming…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => act(row, "reject")}
                disabled={actingOn === row.id}
                className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
