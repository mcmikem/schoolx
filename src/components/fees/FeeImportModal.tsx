"use client";

import { useMemo, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/index";
import { buildFeeTemplateCsv } from "@/lib/import/fees";
import { useFeeTemplateImport, type FeeCreateInput } from "@/lib/hooks/useFeeTemplateImport";
import { formatCurrency } from "@/lib/currency";
import type { FeeStructure } from "@/types";

interface FeeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: Array<{ id: string; name: string }>;
  academicYear: string;
  defaultTerm: number;
  existingFees: FeeStructure[];
  createFeeStructure: (fee: FeeCreateInput) => Promise<unknown>;
  onComplete?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  tuition: "Tuition",
  boarding: "Boarding",
  meals: "Meals",
  transport: "Transport",
  uniform: "Uniform",
  registration: "Registration",
  functional: "Functional",
  pta: "PTA",
  development: "Development",
  library: "Library",
  sports: "Sports",
  ict: "ICT",
  medical: "Medical",
  exam: "Exam",
  uneb: "UNEB",
  bank_charges: "Bank Charges",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  day: "Day",
  boarding: "Boarding",
  both: "Both",
};

const FREQUENCY_LABELS: Record<string, string> = {
  per_term: "Per term",
  one_off: "One-off",
  per_year: "Per year",
};

export default function FeeImportModal({
  isOpen,
  onClose,
  classes,
  academicYear,
  defaultTerm,
  existingFees,
  createFeeStructure,
  onComplete,
}: FeeImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const {
    templateRows,
    templateStatus,
    templateErrors,
    importingTemplate,
    importProgress,
    importSummary,
    handleFeeTemplateUpload,
    handleSeedFeesFromTemplate,
    resetTemplate,
  } = useFeeTemplateImport({
    classes,
    academicYear,
    defaultTerm,
    existingFees,
    createFeeStructure,
  });

  const step: "upload" | "preview" | "importing" | "complete" = importSummary
    ? "complete"
    : importingTemplate
      ? "importing"
      : templateStatus === "ready"
        ? "preview"
        : "upload";

  const completedCount = templateRows.length;

  const closeAndReset = () => {
    resetTemplate();
    onClose();
  };

  const finish = () => {
    onComplete?.();
    closeAndReset();
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF", buildFeeTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fee_structure_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

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

  const firstFive = useMemo(() => templateRows.slice(0, 50), [templateRows]);

  return (
    <Modal isOpen={isOpen} onClose={closeAndReset} title="Import Fee Structure" size="lg">
      {step === "upload" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] p-4 text-sm text-[var(--t2)]">
            <p className="font-semibold text-[var(--t1)] mb-1">One row per fee item per class.</p>
            <p>
              Upload a CSV or Excel file of your fee list — Tuition, Development, Lunch, Transport and so on. Each line
              bills the class named in it (or every class when it is blank) for the term and year you are working on.
            </p>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Upload fee structure file"
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer ${
              isDragOver
                ? "border-[var(--primary)] bg-[var(--primary-light,rgba(0,32,69,0.05))]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/60"
            }`}
          >
            <MaterialIcon icon="upload_file" size={40} className="text-[var(--t3)] mb-3" />
            <p className="text-sm font-semibold text-[var(--t1)]">
              {isDragOver ? "Drop your file here" : "Tap to choose a file"}
            </p>
            <p className="text-xs text-[var(--t3)] mt-1">CSV, XLSX or TXT · or drag and drop</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.txt,text/csv"
              onChange={handleFeeTemplateUpload}
              className="hidden"
            />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] underline underline-offset-2"
            >
              <MaterialIcon icon="download" />
              Download CSV template
            </button>
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-container)] px-3 py-1 font-medium text-[var(--t1)]">
              <MaterialIcon icon="fact_check" />
              {completedCount} ready to import
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--surface-container-low)] text-[var(--t2)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Fee</th>
                  <th className="px-3 py-2 font-semibold">Class</th>
                  <th className="px-3 py-2 font-semibold text-right">Amount</th>
                  <th className="px-3 py-2 font-semibold">Term</th>
                  <th className="px-3 py-2 font-semibold">Applies to</th>
                  <th className="px-3 py-2 font-semibold">Frequency</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {firstFive.map((row, i) => (
                  <tr key={i} className="text-[var(--t1)]">
                    <td className="px-3 py-2 font-medium">{row.preview.name}</td>
                    <td className="px-3 py-2 text-[var(--t2)]">{row.preview.resolved_class}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(row.data.amount))}</td>
                    <td className="px-3 py-2 text-[var(--t2)]">{row.preview.term || "—"}</td>
                    <td className="px-3 py-2 text-[var(--t2)]">
                      {STATUS_LABELS[row.data.boarding_status] || row.data.boarding_status}
                    </td>
                    <td className="px-3 py-2 text-[var(--t2)]">
                      {FREQUENCY_LABELS[row.data.frequency] || row.data.frequency}
                    </td>
                    <td className="px-3 py-2 text-[var(--t2)]">
                      {CATEGORY_LABELS[row.data.category] || row.data.category}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {templateRows.length > firstFive.length && (
            <p className="text-xs text-[var(--t3)]">
              Showing first {firstFive.length} of {templateRows.length} rows.
            </p>
          )}

          {templateErrors && (
            <div className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft,var(--surface-container))] px-4 py-3 text-sm text-[var(--t2)] whitespace-pre-line">
              {templateErrors}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" size="md" onClick={() => resetTemplate()}>
              Choose another file
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={completedCount === 0}
              onClick={() => void handleSeedFeesFromTemplate()}
            >
              <MaterialIcon icon="cloud_upload" />
              Import {completedCount} {completedCount === 1 ? "fee" : "fees"}
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
                {importProgress.success > 0 ? `, ${importProgress.success} added` : ""}
                {(importProgress.skipped ?? 0) > 0 ? `, ${importProgress.skipped} already on file` : ""}
                {importProgress.failed > 0 ? `, ${importProgress.failed} failed` : ""}
              </p>
            </div>
          )}
          <MaterialIcon icon="hourglass_top" size={30} className="text-[var(--primary)] animate-pulse" />
          <p className="mt-3 text-sm font-medium text-[var(--t1)]">Adding fees to the fee structure…</p>
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
              {importSummary.success} {importSummary.success === 1 ? "fee" : "fees"} added
              {importSummary.skipped > 0 ? `, ${importSummary.skipped} skipped as already billed` : ""}
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
