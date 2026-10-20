"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Button, Modal, ModalFooter } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { EXPENSE_CATEGORIES, OTHER_INCOME_CATEGORIES, useMoney, type ExpenseStatus } from "@/lib/hooks/money";
import { getLocalDateString } from "@/lib/hooks/utils";
import { formatCurrency } from "@/lib/currency";
import UnebQuarantinePanel from "@/components/fees/UnebQuarantinePanel";

/**
 * Money out, and the money in that is not fees.
 *
 * A bursar is asked two things every month: how much came in, and how much
 * went out. Before this the app only knew about fees going in, so the second
 * question had no answer anywhere in it.
 *
 * Built mobile-first: this is opened on a phone at a counter, often on a poor
 * connection, so figures are shown even when a refresh fails rather than
 * blanking the screen.
 */

type Tab = "position" | "expenses" | "income";

const STATUS_TONE: Record<ExpenseStatus, string> = {
  pending: "bg-[var(--amber-soft)] text-[var(--amber-ink)]",
  approved: "bg-blue-50 text-blue-700",
  paid: "bg-[var(--green-soft)] text-[var(--green-ink)]",
  rejected: "bg-red-50 text-red-700",
};

export default function MoneyPage() {
  const { school } = useAuth();
  const { currentTerm, academicYear } = useAcademic();
  const toast = useToast();
  const {
    expenses,
    otherIncome,
    loading,
    error,
    position,
    byCategory,
    refresh,
    addExpense,
    setExpenseStatus,
    addOtherIncome,
  } = useMoney(school?.id);

  const [tab, setTab] = useState<Tab>("position");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    category: "supplies",
    description: "",
    amount: "",
    expense_date: getLocalDateString(),
    payee: "",
    document_ref: "",
    is_petty_cash: false,
    wht_applicable: false,
  });
  const [incomeForm, setIncomeForm] = useState({
    source: "",
    category: "grant",
    amount: "",
    received_on: getLocalDateString(),
    reference: "",
  });

  const maxSpend = useMemo(() => Math.max(...byCategory.map((c) => c.amount), 1), [byCategory]);

  const submitExpense = async () => {
    const amount = Number(expenseForm.amount);
    if (!expenseForm.description.trim()) return toast.error("Say what the money was for");
    if (!amount || amount <= 0) return toast.error("Enter the amount spent");
    setSaving(true);
    try {
      await addExpense({
        category: expenseForm.category,
        description: expenseForm.description.trim(),
        amount,
        expense_date: expenseForm.expense_date,
        payee: expenseForm.payee.trim() || undefined,
        document_ref: expenseForm.document_ref.trim() || undefined,
        is_petty_cash: expenseForm.is_petty_cash,
        wht_applicable: expenseForm.wht_applicable,
      });
      toast.success("Expense recorded and sent for approval");
      setExpenseOpen(false);
      setExpenseForm((f) => ({ ...f, description: "", amount: "", payee: "", document_ref: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record the expense");
    } finally {
      setSaving(false);
    }
  };

  const submitIncome = async () => {
    const amount = Number(incomeForm.amount);
    if (!incomeForm.source.trim()) return toast.error("Say where the money came from");
    if (!amount || amount <= 0) return toast.error("Enter the amount received");
    setSaving(true);
    try {
      await addOtherIncome({
        source: incomeForm.source.trim(),
        category: incomeForm.category,
        amount,
        received_on: incomeForm.received_on,
        reference: incomeForm.reference.trim() || undefined,
      });
      toast.success("Other income recorded");
      setIncomeOpen(false);
      setIncomeForm((f) => ({ ...f, source: "", amount: "", reference: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record the income");
    } finally {
      setSaving(false);
    }
  };

  const label = (value: string) =>
    EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ??
    OTHER_INCOME_CATEGORIES.find((c) => c.value === value)?.label ??
    value;

  return (
    <div className="space-y-5 pb-28">
      <PageHeader
        title="Money in and out"
        subtitle={`Term ${currentTerm} · ${academicYear}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIncomeOpen(true)}>
              <MaterialIcon className="text-base mr-1">add</MaterialIcon> Income
            </Button>
            <Button variant="primary" size="sm" onClick={() => setExpenseOpen(true)}>
              <MaterialIcon className="text-base mr-1">remove</MaterialIcon> Expense
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-4 py-3 text-sm text-[var(--t2)]">
          {error}{" "}
          <button className="font-semibold underline" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}

      {/* Position first — it is the answer bursars are asked for. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Money in"
          value={position.moneyIn}
          tone="green"
          hint={`Fees ${formatCurrency(position.feesCollected)}`}
        />
        <Stat
          label="Money out"
          value={position.moneyOut}
          tone="red"
          hint={`${formatCurrency(position.pendingOut)} pending`}
        />
        <Stat label="Balance" value={position.balance} tone={position.balance >= 0 ? "green" : "red"} />
        <Stat
          label="Available"
          value={position.available}
          tone={position.available >= 0 ? "green" : "red"}
          hint={position.unebHeld > 0 ? `UNEB held ${formatCurrency(position.unebHeld)}` : "Excludes UNEB money held"}
        />
        <Stat label="Other income" value={position.otherIncome} tone="navy" hint="Not school fees" />
      </div>

      <div className="flex gap-2 border-b border-[var(--border)]">
        {(
          [
            ["position", "Position"],
            ["expenses", "Expenses"],
            ["income", "Other income"],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`min-h-[44px] px-4 text-sm font-semibold border-b-2 -mb-px ${
              tab === id ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--t3)]"
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      {tab === "position" && (
        <div className="space-y-5">
          <UnebQuarantinePanel />
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-bold text-[var(--t1)]">Where the money went</h2>
            <p className="mt-1 text-xs text-[var(--t3)]">Approved and paid spending this period.</p>
            {byCategory.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--t3)]">No spending recorded yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {byCategory.map((row) => (
                  <li key={row.category}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] text-[var(--t2)]">{label(row.category)}</span>
                      <span className="text-[13px] font-bold tabular-nums text-[var(--t1)]">
                        {formatCurrency(row.amount)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${Math.round((row.amount / maxSpend) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-bold text-[var(--t1)]">Spending waiting for approval</h2>
            <p className="mt-1 text-xs text-[var(--t3)]">
              Not yet counted as gone. Approve it once the head teacher has seen it.
            </p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-[var(--amber)]">
              {formatCurrency(position.pendingOut)}
            </p>
            <Link
              href="/dashboard/expense-approvals"
              className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-[var(--primary)] underline"
            >
              Go to approvals
            </Link>
          </section>
        </div>
      )}

      {tab === "expenses" && (
        <div className="space-y-2">
          {expenses.length === 0 ? (
            <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--t3)]">
              Nothing spent yet. Record the first expense with the Expense button above.
            </p>
          ) : (
            expenses.map((e) => (
              <article key={e.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--t1)]">{e.description}</p>
                    <p className="mt-0.5 text-xs text-[var(--t3)]">
                      {label(e.category)} · {e.expense_date}
                      {e.payee ? ` · ${e.payee}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] font-bold tabular-nums text-[var(--t1)]">{formatCurrency(e.amount)}</p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONE[e.status]}`}
                    >
                      {e.status}
                    </span>
                  </div>
                </div>
                {e.is_petty_cash && (
                  <p className="mt-2 text-xs font-semibold text-[var(--t3)]">Petty cash · needs a voucher</p>
                )}
                {e.wht_amount > 0 && (
                  <p className="mt-1 text-xs text-[var(--t3)]">
                    Withholding tax {formatCurrency(e.wht_amount)} (6%, above UGX 1,000,000)
                  </p>
                )}
                {e.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => void setExpenseStatus(e.id, "approved")}
                      className="min-h-[44px] flex-1 rounded-xl bg-[var(--primary)] px-3 text-[13px] font-semibold text-[var(--on-primary)]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => void setExpenseStatus(e.id, "rejected")}
                      className="min-h-[44px] rounded-xl border border-[var(--border)] px-4 text-[13px] font-semibold text-[var(--t2)]"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}

      {tab === "income" && (
        <div className="space-y-2">
          {otherIncome.length === 0 ? (
            <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--t3)]">
              Nothing yet. Capitation, grants, donations and farm income belong here.
            </p>
          ) : (
            otherIncome.map((r) => (
              <article
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--t1)]">{r.source}</p>
                  <p className="mt-0.5 text-xs text-[var(--t3)]">
                    {label(r.category)} · {r.received_on}
                    {r.reference ? ` · ${r.reference}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--green)]">
                  {formatCurrency(r.amount)}
                </p>
              </article>
            ))
          )}
        </div>
      )}

      <Modal isOpen={expenseOpen} onClose={() => setExpenseOpen(false)} title="Record an expense">
        <div className="space-y-4">
          <div className="space-y-3">
            <Field label="What was it for">
              <input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
                placeholder="e.g. Bought 20 exercise books"
              />
            </Field>
            <Field label="Category">
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (UGX)">
              <input
                type="number"
                inputMode="numeric"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={expenseForm.expense_date}
                onChange={(e) => setExpenseForm((f) => ({ ...f, expense_date: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              />
            </Field>
            <Field label="Paid to (optional)">
              <input
                value={expenseForm.payee}
                onChange={(e) => setExpenseForm((f) => ({ ...f, payee: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              />
            </Field>
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-[var(--t2)]">
              <input
                type="checkbox"
                checked={expenseForm.is_petty_cash}
                onChange={(e) => setExpenseForm((f) => ({ ...f, is_petty_cash: e.target.checked }))}
                className="h-5 w-5"
              />
              Paid from petty cash (needs a voucher)
            </label>
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-[var(--t2)]">
              <input
                type="checkbox"
                checked={expenseForm.wht_applicable}
                onChange={(e) => setExpenseForm((f) => ({ ...f, wht_applicable: e.target.checked }))}
                className="h-5 w-5"
              />
              Withholding tax applies (6% above UGX 1,000,000)
            </label>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setExpenseOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submitExpense} loading={saving}>
            Save expense
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={incomeOpen} onClose={() => setIncomeOpen(false)} title="Record other income">
        <div className="space-y-4">
          <div className="space-y-3">
            <Field label="Where did it come from?">
              <input
                value={incomeForm.source}
                onChange={(e) => setIncomeForm((f) => ({ ...f, source: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
                placeholder="e.g. Capitation Term 2"
              />
            </Field>
            <Field label="Type">
              <select
                value={incomeForm.category}
                onChange={(e) => setIncomeForm((f) => ({ ...f, category: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              >
                {OTHER_INCOME_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (UGX)">
              <input
                type="number"
                inputMode="numeric"
                value={incomeForm.amount}
                onChange={(e) => setIncomeForm((f) => ({ ...f, amount: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              />
            </Field>
            <Field label="Date received">
              <input
                type="date"
                value={incomeForm.received_on}
                onChange={(e) => setIncomeForm((f) => ({ ...f, received_on: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              />
            </Field>
            <Field label="Reference (optional)">
              <input
                value={incomeForm.reference}
                onChange={(e) => setIncomeForm((f) => ({ ...f, reference: e.target.value }))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
                placeholder="Receipt or transfer number"
              />
            </Field>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setIncomeOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submitIncome} loading={saving}>
            Save income
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "navy";
  hint?: string;
}) {
  const colour = tone === "green" ? "text-[var(--green)]" : tone === "red" ? "text-[var(--red)]" : "text-[var(--navy)]";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--t3)]">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${colour}`}>{formatCurrency(value)}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-[var(--t3)]">{hint}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--t2)]">{label}</span>
      {children}
    </label>
  );
}
