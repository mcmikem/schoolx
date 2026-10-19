"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { useOnlineStatus } from "@/lib/offline";
import { logger } from "@/lib/logger";
import { summarizeUnebQuarantine } from "@/lib/uneb-quarantine";

/**
 * Money out and non-fee money in.
 *
 * The app could collect fees but had no home for money leaving the school, so
 * a bursar had no way to answer the two questions they are asked every month:
 * how much came in, how much went out, and what is left.
 *
 * Expenses were already modelled but the category list did not include food,
 * which in many Ugandan schools is the single largest cost. Petty cash is an
 * imprest account rather than a category, and 6% withholding tax applies to
 * supplies above UGX 1,000,000 with the bursar acting as the school's agent.
 */

export type ExpenseStatus = "pending" | "approved" | "paid" | "rejected";

export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "salaries", label: "Salaries & allowances" },
  { value: "food", label: "Food & feeding" },
  { value: "utilities", label: "Utilities (power, water, internet)" },
  { value: "maintenance", label: "Repairs & maintenance" },
  { value: "supplies", label: "Teaching & office supplies" },
  { value: "transport", label: "Transport & fuel" },
  { value: "events", label: "Events & co-curricular" },
  { value: "security", label: "Security" },
  { value: "medical", label: "Medical & sanitation" },
  { value: "sports", label: "Sports" },
  { value: "fees", label: "Fees paid for UPE pupils" },
  { value: "audit", label: "Audit fees" },
  { value: "tax", label: "PAYE & withholding tax" },
  { value: "bank_charges", label: "Bank charges" },
  { value: "petty_cash", label: "Petty cash" },
  { value: "other", label: "Other" },
];

export const OTHER_INCOME_CATEGORIES: { value: string; label: string }[] = [
  { value: "capitation", label: "Capitation grant" },
  { value: "sfg", label: "School facilitation grant" },
  { value: "grant", label: "Grant" },
  { value: "donation", label: "Donation" },
  { value: "alumni", label: "Alumni association" },
  { value: "farm", label: "School farm produce" },
  { value: "rent", label: "Renting school facilities" },
  { value: "uniform_sales", label: "Uniform & book sales" },
  { value: "tuck_shop", label: "Tuck shop" },
  { value: "other", label: "Other" },
];

export interface ExpenseRow {
  id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
  payee: string | null;
  document_ref: string | null;
  receipt_number: string | null;
  status: ExpenseStatus;
  is_petty_cash: boolean;
  wht_applicable: boolean;
  wht_amount: number;
  created_at: string;
}

export interface OtherIncomeRow {
  id: string;
  source: string;
  category: string;
  amount: number;
  received_on: string;
  term: number | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface MoneyPosition {
  feesCollected: number;
  otherIncome: number;
  moneyIn: number;
  moneyOut: number;
  /** Only approved/paid spending counts as gone. Pending is still ours. */
  committedOut: number;
  pendingOut: number;
  /** UNEB exam money collected but not yet remitted — held in trust, not ours. */
  unebHeld: number;
  /** `balance` less the UNEB money held in trust: what the school may actually spend. */
  available: number;
  balance: number;
}

export function useMoney(schoolId?: string) {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [otherIncome, setOtherIncome] = useState<OtherIncomeRow[]>([]);
  const [feesCollected, setFeesCollected] = useState(0);
  const [unebHeld, setUnebHeld] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const load = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [expRes, incRes, payRes, feesRes, remitRes] = await Promise.all([
        withTimeout(
          supabase
            .from("expenses")
            .select(
              "id, category, description, amount, expense_date, vendor, payee, document_ref, receipt_number, status, is_petty_cash, wht_applicable, wht_amount, created_at",
            )
            .eq("school_id", schoolId)
            .order("expense_date", { ascending: false })
            .limit(500),
          15000,
          timeoutFallback<ExpenseRow[]>(),
        ),
        withTimeout(
          supabase
            .from("other_income")
            .select("id, source, category, amount, received_on, term, reference, notes, created_at")
            .eq("school_id", schoolId)
            .is("deleted_at", null)
            .order("received_on", { ascending: false })
            .limit(500),
          15000,
          timeoutFallback<OtherIncomeRow[]>(),
        ),
        withTimeout(
          supabase.from("fee_payments").select("amount_paid, fee_id").eq("school_id", schoolId).is("deleted_at", null),
          15000,
          timeoutFallback<{ amount_paid: number; fee_id: string | null }[]>(),
        ),
        // UNEB exam money is a liability, not income. Read the fee lines and the
        // remittance ledger so the spendable figure can exclude what is held.
        withTimeout(
          supabase.from("fee_structure").select("id, name, category").eq("school_id", schoolId).is("deleted_at", null),
          15000,
          timeoutFallback<{ id: string; name: string | null; category: string | null }[]>(),
        ),
        withTimeout(
          supabase
            .from("uneb_remittances")
            .select("amount_invoiced, amount_collected, amount_remitted, status")
            .eq("school_id", schoolId),
          15000,
          timeoutFallback<
            { amount_invoiced: number; amount_collected: number; amount_remitted: number; status: string }[]
          >(),
        ),
      ]);

      const expErr = (expRes as { error?: unknown }).error;
      if (expErr) throw expErr;
      const incErr = (incRes as { error?: unknown }).error;
      if (incErr) throw incErr;

      setExpenses((expRes as { data?: ExpenseRow[] }).data ?? []);
      setOtherIncome((incRes as { data?: OtherIncomeRow[] }).data ?? []);

      const payRows = (payRes as { data?: { amount_paid: number; fee_id?: string | null }[] }).data ?? [];
      setFeesCollected(payRows.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0));

      const unebFees =
        (feesRes as { data?: { id: string; name: string | null; category: string | null }[] }).data ?? [];
      const unebRows =
        (
          remitRes as {
            data?: { amount_invoiced: number; amount_collected: number; amount_remitted: number; status: string }[];
          }
        ).data ?? [];
      const quarantine = summarizeUnebQuarantine({
        fees: unebFees,
        payments: payRows,
        remittances: unebRows,
      });
      setUnebHeld(quarantine.held);
    } catch (err) {
      // Keep whatever loaded rather than blanking the screen — a bursar on a
      // weak connection should still see the last known position.
      logger.warn("[useMoney] load failed:", err);
      setError("Could not refresh money figures. Showing the last known position.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (isOnline) void load();
    else setLoading(false);
  }, [load, isOnline]);

  const addExpense = useCallback(
    async (input: {
      category: string;
      description: string;
      amount: number;
      expense_date: string;
      vendor?: string;
      payee?: string;
      document_ref?: string;
      is_petty_cash?: boolean;
      wht_applicable?: boolean;
    }) => {
      if (!schoolId) throw new Error("No school selected");
      // 6% withholding applies to supplies above UGX 1,000,000.
      const whtApplicable = Boolean(input.wht_applicable) && input.amount > 1_000_000;
      const whtAmount = whtApplicable ? Math.round(input.amount * 0.06 * 100) / 100 : 0;
      const row = {
        school_id: schoolId,
        category: input.category,
        description: input.description,
        amount: input.amount,
        expense_date: input.expense_date,
        vendor: input.vendor ?? null,
        payee: input.payee ?? null,
        document_ref: input.document_ref ?? null,
        is_petty_cash: Boolean(input.is_petty_cash),
        wht_applicable: whtApplicable,
        wht_amount: whtAmount,
        status: "pending" as ExpenseStatus,
      };
      const { data, error } = await withTimeout(
        supabase.from("expenses").insert(row).select().single(),
        15000,
        timeoutFallback(),
      );
      if (error) throw error;
      setExpenses((prev) => [{ ...row, ...data, created_at: new Date().toISOString() } as ExpenseRow, ...prev]);
      return data;
    },
    [schoolId],
  );

  const setExpenseStatus = useCallback(async (id: string, status: ExpenseStatus) => {
    const { error } = await withTimeout(
      supabase.from("expenses").update({ status }).eq("id", id),
      15000,
      timeoutFallback(),
    );
    if (error) throw error;
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  }, []);

  const addOtherIncome = useCallback(
    async (input: {
      source: string;
      category: string;
      amount: number;
      received_on: string;
      reference?: string;
      notes?: string;
    }) => {
      if (!schoolId) throw new Error("No school selected");
      const row = { school_id: schoolId, ...input, reference: input.reference ?? null, notes: input.notes ?? null };
      const { data, error } = await withTimeout(
        supabase.from("other_income").insert(row).select().single(),
        15000,
        timeoutFallback(),
      );
      if (error) throw error;
      setOtherIncome((prev) => [{ ...row, ...data, created_at: new Date().toISOString() } as OtherIncomeRow, ...prev]);
      return data;
    },
    [schoolId],
  );

  const position: MoneyPosition = useMemo(() => {
    const otherIn = otherIncome.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const committed = expenses
      .filter((e) => e.status === "approved" || e.status === "paid")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const pending = expenses.filter((e) => e.status === "pending").reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const moneyIn = feesCollected + otherIn;
    const balance = moneyIn - committed;
    return {
      feesCollected,
      otherIncome: otherIn,
      moneyIn,
      moneyOut: committed,
      committedOut: committed,
      pendingOut: pending,
      unebHeld,
      available: balance - unebHeld,
      balance,
    };
  }, [expenses, otherIncome, feesCollected, unebHeld]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      if (e.status === "rejected") continue;
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount || 0));
    }
    return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  return {
    expenses,
    otherIncome,
    loading,
    error,
    position,
    byCategory,
    refresh: load,
    addExpense,
    setExpenseStatus,
    addOtherIncome,
  };
}
