"use client";

import { useCallback, useState } from "react";
import {
  buildPhoneIndex,
  matchStudentByPhone,
  parseMobileTransactions,
  type ParsedMobileTransaction,
  type StudentPhoneSource,
} from "@/lib/import/mobile-money";
import { readTabularRows } from "@/lib/import/read-tabular";

export interface MobileMoneyCreatePayment {
  student_id: string;
  fee_id?: string;
  amount_paid: number;
  payment_method: "mobile_money";
  payment_reference?: string;
  paid_by?: string;
  payment_date?: string;
  notes?: string;
}

export type MobileRowStatus = "matched" | "unmatched" | "invalid";

export interface MobilePreviewRow {
  date: string;
  amount: string;
  phone: string;
  payer: string;
  reference: string;
  student: string;
  status: MobileRowStatus;
  reason: string;
}

interface SeedableTransaction {
  data: ParsedMobileTransaction;
  studentId: string;
  studentLabel: string;
}

interface ImportSummary {
  success: number;
  failed: number;
  /** Matched rows that were already recorded (same reference) -- skipped. */
  skipped: number;
  total: number;
  errors: string[];
}

interface UseMobileMoneyImportParams {
  students: StudentPhoneSource[];
  feeId: string;
  /** Shown on the payment notes, e.g. "MTN MoMo". */
  source: string;
  createPayment: (payment: MobileMoneyCreatePayment) => Promise<unknown>;
}

export function useMobileMoneyImport(params: UseMobileMoneyImportParams) {
  const { students, feeId, source, createPayment } = params;
  const [seedableRows, setSeedableRows] = useState<SeedableTransaction[]>([]);
  const [previewRows, setPreviewRows] = useState<MobilePreviewRow[]>([]);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "parsing" | "ready">("idle");
  const [templateErrors, setTemplateErrors] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    completed: number;
    total: number;
    success: number;
    failed: number;
    skipped?: number;
  } | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const reset = useCallback(() => {
    setSeedableRows([]);
    setPreviewRows([]);
    setTemplateStatus("idle");
    setTemplateErrors(null);
    setImporting(false);
    setImportProgress(null);
    setImportSummary(null);
  }, []);

  const handleStatementUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setTemplateStatus("parsing");
      setTemplateErrors(null);
      setSeedableRows([]);
      setPreviewRows([]);
      setImportSummary(null);
      setImportProgress(null);

      try {
        const rawRows = await readTabularRows(file);
        if (rawRows.length === 0) {
          setTemplateErrors(
            "That file has no transactions. Export the statement as CSV from MTN MoMo or Airtel Money and try again.",
          );
          setTemplateStatus("idle");
          return;
        }

        const index = buildPhoneIndex(students);
        const byId = new Map(students.map((s) => [s.id, s]));
        const usable: SeedableTransaction[] = [];
        const preview: MobilePreviewRow[] = [];
        const problems: string[] = [];

        for (const [position, raw] of rawRows.entries()) {
          const validated = parseMobileTransactions([raw])[0];
          const data = validated.data;
          const common = {
            date: data.date,
            amount: data.amount,
            phone: data.phone,
            payer: data.payer,
            reference: data.reference,
          };

          if (!validated.isValid) {
            preview.push({ ...common, student: "", status: "invalid", reason: validated.errors.join("; ") });
            problems.push(`Row ${position + 1}: ${validated.errors.join("; ")}`);
            continue;
          }

          const studentId = matchStudentByPhone(index, data.phone);
          if (!studentId) {
            preview.push({
              ...common,
              student: "",
              status: "unmatched",
              reason: `No pupil has parent number ${data.phone}`,
            });
            problems.push(`Row ${position + 1} (${data.phone}): no pupil has this parent number`);
            continue;
          }

          const student = byId.get(studentId);
          const studentLabel = student
            ? `${student.first_name} ${student.last_name}${student.classes?.name ? ` (${student.classes.name})` : ""}`
            : "";
          preview.push({ ...common, student: studentLabel, status: "matched", reason: "" });
          usable.push({ data, studentId, studentLabel });
        }

        setSeedableRows(usable);
        setPreviewRows(preview);
        setTemplateStatus("ready");

        if (problems.length) {
          setTemplateErrors(
            `${problems.length} of ${rawRows.length} lines will be skipped:\n` +
              problems.slice(0, 8).join("\n") +
              (problems.length > 8 ? `\n…and ${problems.length - 8} more.` : ""),
          );
        }
      } catch (error: unknown) {
        setTemplateErrors(error instanceof Error ? error.message : "Could not read that file");
        setTemplateStatus("idle");
      }
    },
    [students],
  );

  const handleSeedPayments = useCallback(async (): Promise<ImportSummary | null> => {
    if (!seedableRows.length) {
      setTemplateErrors("Upload a statement before importing.");
      return null;
    }
    if (!feeId) {
      setTemplateErrors("Choose which fee these payments settle first.");
      return null;
    }

    setImporting(true);
    setImportProgress({ completed: 0, total: seedableRows.length, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];
    const captureError = (message: string) => {
      if (errors.length < 10) errors.push(message);
    };

    for (const [index, row] of seedableRows.entries()) {
      try {
        await createPayment({
          student_id: row.studentId,
          fee_id: feeId,
          amount_paid: Number(row.data.amount),
          payment_method: "mobile_money",
          payment_reference: row.data.reference || undefined,
          paid_by: row.data.payer || undefined,
          payment_date: row.data.date || undefined,
          notes: `Imported from ${source} statement`,
        });
        success++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (/already on a payment|duplicate|already exists|already recorded/i.test(message)) {
          skipped++;
        } else {
          captureError(`Row ${index + 1} (${row.studentLabel}, ${row.data.amount}): ${message}`);
          failed++;
        }
      }

      setImportProgress({ completed: index + 1, total: seedableRows.length, success, failed, skipped });
    }

    const summary: ImportSummary = { success, failed, skipped, total: seedableRows.length, errors };
    setImportSummary(summary);
    setImporting(false);
    return summary;
  }, [createPayment, feeId, seedableRows, source]);

  return {
    previewRows,
    templateStatus,
    templateErrors,
    seedableCount: seedableRows.length,
    importing,
    importProgress,
    importSummary,
    handleStatementUpload,
    handleSeedPayments,
    reset,
  };
}
