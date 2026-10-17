"use client";

import { useMemo, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/index";
import { useMobileMoneyImport, type MobileMoneyCreatePayment } from "@/lib/hooks/useMobileMoneyImport";
import type { StudentPhoneSource } from "@/lib/import/mobile-money";
import { formatCurrency } from "@/lib/currency";

interface FeeChoice {
  id: string;
  name: string;
  class_name?: string | null;
}

interface MobileMoneyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentPhoneSource[];
  fees: FeeChoice[];
  defaultFeeId?: string;
  createPayment: (payment: MobileMoneyCreatePayment) => Promise<unknown>;
  onComplete?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  matched: "bg-[var(--green-soft)] text-[var(--green)]",
  unmatched: "bg-[var(--amber-soft)] text-[var(--amber)]",
  invalid: "bg-[var(--red-soft)] text-[var(--red)]",
};

export default function MobileMoneyImportModal({
  isOpen,
  onClose,
  students,
  fees,
  defaultFeeId,
  createPayment,
  onComplete,
}: MobileMoneyImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [provider, setProvider] = useState("MTN MoMo");
  const [feeId, setFeeId] = useState(defaultFeeId || "");

  const {
    previewRows,
    templateStatus,
    templateErrors,
    seedableCount,
    importing,
    importProgress,
    importSummary,
    handleStatementUpload,
    handleSeedPayments,
    reset,
  } = useMobileMoneyImport({ students, feeId, source: provider, createPayment });

  const step: "upload" | "preview" | "importing" | "complete" = importSummary
    ? "complete"
    : importing
      ? "importing"
      : templateStatus === "ready"
        ? "preview"
        : "upload";

  const closeAndReset = () => {
    reset();
    onClose();
  };

  const finish = () => {
    onComplete?.();
    closeAndReset();
  };

  const matched = useMemo(() => previewRows.filter((r) => r.status === "matched").length, [previewRows]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !fileInputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInputRef.current.files = transfer.files;
    fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
  };

  return (
    <Modal isOpen={isOpen} onClose={closeAndReset} title="Import Mobile Money Statement" size="lg">
      {step === "upload" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] p-4 text-sm text-[var(--t2)]">
            <p className="font-semibold text-[var(--t1)] mb-1">Record MoMo/Airtel payments in one go.</p>
            <p>
              Export your mobile-money statement as CSV. Each line is matched to a pupil by the parent number that paid,
              so the statement never has to be typed in by hand.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="momo-provider"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--t3)]"
              >
                Statement source
              </label>
              <select
                id="momo-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--t1)]"
              >
                <option value="MTN MoMo">MTN MoMo</option>
                <option value="Airtel Money">Airtel Money</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="momo-fee"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--t3)]"
              >
                Credit these payments to
              </label>
              <select
                id="momo-fee"
                value={feeId}
                onChange={(e) => setFeeId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--t1)]"
              >
                <option value="">Choose a fee…</option>
                {fees.map((fee) => (
                  <option key={fee.id} value={fee.id}>
                    {fee.name}
                    {fee.class_name ? ` — ${fee.class_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Upload mobile money statement"
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer ${
              isDragOver
                ? "border-[var(--primary)] bg-[var(--primary-light,rgba(0,32,69,0.05))]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/60"
            }`}
          >
            <MaterialIcon icon="smartphone" size={40} className="text-[var(--t3)] mb-3" />
            <p className="text-sm font-semibold text-[var(--t1)]">
              {isDragOver ? "Drop your statement here" : "Tap to choose a statement"}
            </p>
            <p className="text-xs text-[var(--t3)] mt-1">CSV, XLSX or TXT · or drag and drop</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.txt,text/csv"
              onChange={handleStatementUpload}
              className="hidden"
            />
          </div>

          {templateErrors && (
            <div className="rounded-xl border border-[var(--red)]/30 bg-[var(--error-container,var(--red-soft))] px-4 py-3 text-sm text-[var(--red)] whitespace-pre-line">
              {templateErrors}
            </div>
          )}
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--green-soft)] px-3 py-1 font-medium text-[var(--green)]">
              <MaterialIcon icon="check_circle" />
              {matched} matched
            </span>
            <span className="text-[var(--t3)]">
              {previewRows.length - matched} line{previewRows.length - matched === 1 ? "" : "s"} will be skipped
            </span>
          </div>

          {!feeId && (
            <div className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft,var(--surface-container))] px-4 py-3 text-sm text-[var(--t2)]">
              Choose which fee these payments settle before importing.
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--surface-container-low)] text-[var(--t2)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold text-right">Amount</th>
                  <th className="px-3 py-2 font-semibold">Payer</th>
                  <th className="px-3 py-2 font-semibold">Reference</th>
                  <th className="px-3 py-2 font-semibold">Pupil</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {previewRows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="text-[var(--t1)]">
                    <td className="px-3 py-2 text-[var(--t2)]">{row.date || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(row.amount))}</td>
                    <td className="px-3 py-2 text-[var(--t2)]">{row.payer || row.phone}</td>
                    <td className="px-3 py-2 text-[var(--t2)] font-mono text-xs">{row.reference || "—"}</td>
                    <td className="px-3 py-2">{row.student || <span className="text-[var(--t4)]">—</span>}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          STATUS_STYLES[row.status]
                        }`}
                        title={row.reason}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {previewRows.length > 100 && (
            <p className="text-xs text-[var(--t3)]">Showing first 100 of {previewRows.length} lines.</p>
          )}

          {templateErrors && (
            <div className="max-h-40 overflow-auto rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft,var(--surface-container))] px-4 py-3 text-sm text-[var(--t2)] whitespace-pre-line">
              {templateErrors}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" size="md" onClick={() => reset()}>
              Choose another file
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={seedableCount === 0 || !feeId}
              onClick={() => void handleSeedPayments()}
            >
              <MaterialIcon icon="cloud_upload" />
              Import {seedableCount} {seedableCount === 1 ? "payment" : "payments"}
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="py-8 text-center">
          {importProgress && (
            <div className="mb-5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                  style={{
                    width: `${Math.round((importProgress.completed / Math.max(importProgress.total, 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-sm text-[var(--t2)]">
                {importProgress.completed}/{importProgress.total} processed
                {importProgress.success > 0 ? `, ${importProgress.success} recorded` : ""}
                {(importProgress.skipped ?? 0) > 0 ? `, ${importProgress.skipped} already recorded` : ""}
                {importProgress.failed > 0 ? `, ${importProgress.failed} failed` : ""}
              </p>
            </div>
          )}
          <MaterialIcon icon="hourglass_top" size={30} className="text-[var(--primary)] animate-pulse" />
          <p className="mt-3 text-sm font-medium text-[var(--t1)]">Recording payments…</p>
        </div>
      )}

      {step === "complete" && importSummary && (
        <div className="space-y-5 text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: importSummary.failed === 0 ? "var(--green-soft)" : "var(--amber-soft)" }}
          >
            <MaterialIcon
              icon={importSummary.failed === 0 ? "check_circle" : "warning"}
              size={30}
              style={{ color: importSummary.failed === 0 ? "var(--green)" : "var(--amber)" }}
            />
          </div>

          <div>
            <h3 className="text-lg font-bold text-[var(--t1)]">Import complete</h3>
            <p className="mt-1 text-sm text-[var(--t2)]">
              {importSummary.success} {importSummary.success === 1 ? "payment" : "payments"} recorded
              {importSummary.skipped > 0 ? `, ${importSummary.skipped} skipped as already recorded` : ""}
              {importSummary.failed > 0 ? `, ${importSummary.failed} failed` : ""}.
            </p>
          </div>

          {importSummary.errors.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-xl border border-[var(--red)]/30 bg-[var(--error-container,var(--red-soft))] p-3 text-left">
              {importSummary.errors.map((error, i) => (
                <p key={i} className="text-xs text-[var(--red)] mb-1">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-center">
            <Button variant="primary" size="md" onClick={finish}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
