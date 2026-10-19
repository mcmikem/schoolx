"use client";

import { useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";
import { Card, CardBody } from "@/components/ui/Card";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/currency";
import { useFeePayments, useFeeStructure } from "@/lib/hooks";
import { useUnebRemittances, type UnebRemittanceInput } from "@/lib/hooks/useUnebRemittances";
import { summarizeUnebQuarantine } from "@/lib/uneb-quarantine";

/**
 * The UNEB money the school is holding.
 *
 * A headteacher who spends registration money on a bus gets arrested. This shows
 * exactly how much is held and how much is still to be sent, separate from the
 * general fund. It is never an exam gate.
 */
export default function UnebQuarantinePanel() {
  const { school } = useAuth();
  const { academicYear } = useAcademic();
  const { feeStructure } = useFeeStructure(school?.id);
  const { payments } = useFeePayments(school?.id, 1, 50, true);
  const { remittances, loading, error, addRemittance } = useUnebRemittances(school?.id);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    level: "S.6",
    amount_invoiced: "",
    amount_collected: "",
    amount_remitted: "",
    bank_reference: "",
  });

  const summary = useMemo(
    () => summarizeUnebQuarantine({ fees: feeStructure, payments, remittances }),
    [feeStructure, payments, remittances],
  );

  const handleSave = async () => {
    const input: UnebRemittanceInput = {
      academic_year: academicYear,
      level: form.level.trim() || "Unknown",
      amount_invoiced: Number(form.amount_invoiced || 0),
      amount_collected: Number(form.amount_collected || 0),
      amount_remitted: Number(form.amount_remitted || 0),
      bank_reference: form.bank_reference.trim() || null,
    };
    if (!input.amount_invoiced && !input.amount_collected && !input.amount_remitted) {
      setFormError("Enter at least an invoiced, collected or remitted amount.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await addRemittance(input);
      setForm({ level: "S.6", amount_invoiced: "", amount_collected: "", amount_remitted: "", bank_reference: "" });
      setFormOpen(false);
    } catch {
      setFormError("Could not save the record. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm";

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--t1)]">UNEB exam fees held</h2>
            <p className="mt-1 text-xs text-[var(--t3)]">
              Money collected for UNEB registration is owed to UNEB, not the school. It is not free to spend.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setFormOpen((v) => !v)}>
            <MaterialIcon className="text-base mr-1">add</MaterialIcon> Record
          </Button>
        </div>

        {error && <p className="mt-3 text-xs text-[var(--amber)]">{error}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div>
            <div className="text-xs font-semibold text-[var(--t3)]">Collected</div>
            <div className="text-lg font-bold tabular-nums text-[var(--t1)]">{formatCurrency(summary.collected)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--t3)]">Remitted</div>
            <div className="text-lg font-bold tabular-nums text-[var(--green)]">{formatCurrency(summary.remitted)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--t3)]">Held for UNEB</div>
            <div className="text-lg font-bold tabular-nums text-[var(--red)]">{formatCurrency(summary.held)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--t3)]">Still to collect</div>
            <div className="text-lg font-bold tabular-nums text-[var(--t1)]">
              {formatCurrency(summary.outstandingToCollect)}
            </div>
          </div>
        </div>

        {formOpen && (
          <div className="mt-4 space-y-3 rounded-xl border border-[var(--border)] p-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-[var(--t2)]">
                Level
                <input
                  className={`${field} mt-1`}
                  value={form.level}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  placeholder="S.6"
                />
              </label>
              <label className="text-xs font-semibold text-[var(--t2)]">
                Bank reference
                <input
                  className={`${field} mt-1`}
                  value={form.bank_reference}
                  onChange={(e) => setForm((f) => ({ ...f, bank_reference: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-[var(--t2)]">
                Invoiced
                <input
                  type="number"
                  inputMode="numeric"
                  className={`${field} mt-1`}
                  value={form.amount_invoiced}
                  onChange={(e) => setForm((f) => ({ ...f, amount_invoiced: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-[var(--t2)]">
                Collected
                <input
                  type="number"
                  inputMode="numeric"
                  className={`${field} mt-1`}
                  value={form.amount_collected}
                  onChange={(e) => setForm((f) => ({ ...f, amount_collected: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-[var(--t2)]">
                Remitted
                <input
                  type="number"
                  inputMode="numeric"
                  className={`${field} mt-1`}
                  value={form.amount_remitted}
                  onChange={(e) => setForm((f) => ({ ...f, amount_remitted: e.target.value }))}
                />
              </label>
            </div>
            {formError && <p className="text-xs text-[var(--red)]">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => void handleSave()} loading={saving}>
                Save record
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-[var(--t3)]">Loading…</p>
          ) : remittances.length === 0 ? (
            <p className="text-sm text-[var(--t3)]">No UNEB remittances recorded yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {remittances.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[var(--t1)]">
                      {row.level} · {row.academic_year}
                      {row.invoice_number ? ` · Inv ${row.invoice_number}` : ""}
                    </div>
                    <div className="truncate text-xs text-[var(--t3)]">
                      Invoiced {formatCurrency(row.amount_invoiced)} · Collected {formatCurrency(row.amount_collected)}{" "}
                      · Remitted {formatCurrency(row.amount_remitted)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface-container)] px-2 py-0.5 text-xs font-semibold text-[var(--t2)]">
                    {row.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
