"use client";

import { useCallback, useState } from "react";
import { buildClassAliasMap, formatSpreadsheetCell, resolveClassId } from "@/lib/import/students";
import { feeStructureKey, parseFeeRows, type ParsedFeeRow } from "@/lib/import/fees";
import type { FeeStructure } from "@/types";

export type FeeTemplateRow = Record<string, string>;

export interface FeeCreateInput {
  name: string;
  class_id?: string;
  amount: number;
  term: number | null;
  academic_year: string;
  due_date?: string;
  category?: string;
  boarding_status?: "day" | "boarding" | "both" | null;
  frequency?: "per_term" | "one_off" | "per_year";
  transport_zone?: string;
}

interface ImportSummary {
  success: number;
  failed: number;
  /** Rows already on the fee list -- skipped rather than duplicated. */
  skipped: number;
  total: number;
  errors: string[];
}

interface SeedableFee {
  preview: FeeTemplateRow;
  data: ParsedFeeRow;
  classId: string;
  classLabel: string;
  term: number | null;
}

interface UseFeeTemplateImportParams {
  classes: Array<{ id: string; name: string }>;
  /** Year a row without an Academic Year column belongs to. */
  academicYear: string;
  /** Term a per-term row without a Term column belongs to. */
  defaultTerm: number;
  /** The school's live fee list, used to skip rows that are already billed. */
  existingFees: FeeStructure[];
  createFeeStructure: (fee: FeeCreateInput) => Promise<unknown>;
}

const PREVIEW_COLUMNS: Array<keyof ParsedFeeRow> = [
  "name",
  "class_name",
  "amount",
  "term",
  "category",
  "boarding_status",
  "frequency",
  "transport_zone",
  "due_date",
  "academic_year",
];

export function useFeeTemplateImport(params: UseFeeTemplateImportParams) {
  const { classes, academicYear, defaultTerm, existingFees, createFeeStructure } = params;
  const [seedableRows, setSeedableRows] = useState<SeedableFee[]>([]);
  const [templatePreviewRows, setTemplatePreviewRows] = useState<FeeTemplateRow[]>([]);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "parsing" | "ready">("idle");
  const [templateErrors, setTemplateErrors] = useState<string | null>(null);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    completed: number;
    total: number;
    success: number;
    failed: number;
    skipped?: number;
  } | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const resetTemplate = useCallback(() => {
    setSeedableRows([]);
    setTemplatePreviewRows([]);
    setTemplateStatus("idle");
    setTemplateErrors(null);
    setImportingTemplate(false);
    setImportProgress(null);
    setImportSummary(null);
  }, []);

  /**
   * Reads the raw file into plain objects keyed by the original header text.
   * No column is interpreted here -- aliases, categories and dates are all
   * handled by validateFeeRow.
   */
  const readTabularRows = useCallback(async (file: File): Promise<FeeTemplateRow[]> => {
    const extension = (file.name.split(".").pop() || "").toLowerCase();

    if (extension === "xls") {
      throw new Error("Legacy .xls files are not supported. Save the file as .xlsx or .csv and upload it again.");
    }

    if (extension === "xlsx") {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.worksheets[0];
      if (!worksheet) return [];

      const firstRow = worksheet.getRow(1).values;
      const headers = (Array.isArray(firstRow) ? firstRow : []).slice(1).map((header) => String(header ?? "").trim());

      const rows: FeeTemplateRow[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = (Array.isArray(row.values) ? row.values : []).slice(1);
        const record: FeeTemplateRow = {};
        headers.forEach((header, index) => {
          if (header) record[header] = formatSpreadsheetCell(values[index]);
        });
        if (Object.values(record).some((value) => value.length > 0)) rows.push(record);
      });
      return rows;
    }

    const Papa = (await import("papaparse")).default;
    return await new Promise<FeeTemplateRow[]>((resolve, reject) => {
      Papa.parse<FeeTemplateRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const problems = (results.errors || []).slice(0, 3).map((e) => e.message);
          if (problems.length) {
            reject(new Error(`Could not read the file: ${problems.join("; ")}`));
            return;
          }
          resolve(
            (results.data || []).filter((row) =>
              Object.values(row || {}).some((value) => String(value ?? "").trim().length > 0),
            ),
          );
        },
        error: (error) => reject(new Error(error.message)),
      });
    });
  }, []);

  const handleFeeTemplateUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setTemplateStatus("parsing");
      setTemplateErrors(null);
      setSeedableRows([]);
      setTemplatePreviewRows([]);
      setImportSummary(null);
      setImportProgress(null);

      try {
        const rawRows = await readTabularRows(file);
        if (rawRows.length === 0) {
          setTemplateErrors(
            "That file has no fee rows. The first line must be a header row, such as: Fee Name, Class, Amount (UGX), Term",
          );
          setTemplateStatus("idle");
          return;
        }

        const classMap = buildClassAliasMap(classes);
        const usable: SeedableFee[] = [];
        const problems: string[] = [];

        rawRows.forEach((raw, index) => {
          const validated = parseFeeRows([raw])[0];
          const data = validated.data;

          // A row is usable when it names a fee and carries a positive amount.
          // validateFeeRow reports anything else, and the row is skipped rather
          // than seeded half-formed.
          if (validated.errors.length) {
            problems.push(`Row ${index + 1} (${data.name || "unnamed fee"}): ${validated.errors.join("; ")}`);
            return;
          }

          let classId = "";
          if (data.class_name) {
            classId = resolveClassId(classMap, data.class_name) || "";
            if (!classId) {
              const known = classes.map((c) => c.name).join(", ");
              problems.push(
                `Row ${index + 1} (${data.name}): no class matches "${data.class_name}". Classes in this school: ${known || "none yet"}`,
              );
              return;
            }
          }

          const term = data.frequency === "per_term" ? (data.term ? Number(data.term) : defaultTerm) : null;

          const preview: FeeTemplateRow = {};
          for (const column of PREVIEW_COLUMNS) preview[column] = String(data[column] ?? "");
          preview.resolved_class = classId
            ? classes.find((c) => c.id === classId)?.name || data.class_name
            : "All classes";
          preview.academic_year = data.academic_year || academicYear;
          preview.term = term === null ? "" : String(term);

          usable.push({
            preview,
            data,
            classId,
            classLabel: preview.resolved_class,
            term,
          });
        });

        setSeedableRows(usable);
        setTemplatePreviewRows(usable.slice(0, 5).map((row) => row.preview));
        setTemplateStatus("ready");

        if (problems.length) {
          setTemplateErrors(
            `${problems.length} of ${rawRows.length} rows cannot be imported and will be skipped:\n` +
              problems.slice(0, 8).join("\n") +
              (problems.length > 8 ? `\n…and ${problems.length - 8} more.` : ""),
          );
        }
      } catch (error: unknown) {
        setTemplateErrors(error instanceof Error ? error.message : "Could not read that file");
        setTemplateStatus("idle");
      }
    },
    [classes, academicYear, defaultTerm, readTabularRows],
  );

  const handleSeedFeesFromTemplate = useCallback(async (): Promise<ImportSummary | null> => {
    if (!seedableRows.length) {
      setTemplateErrors("Upload a template before importing.");
      return null;
    }

    setImportingTemplate(true);
    setImportProgress({ completed: 0, total: seedableRows.length, success: 0, failed: 0 });

    // Key the live list once. A school that re-uploads last term's sheet, or
    // retries after a partial failure, skips what is already billed instead of
    // creating a second line for the same fee.
    const existingKeys = new Set(
      existingFees.map((fee) => feeStructureKey(fee.name, fee.class_id || "", fee.term ?? null, fee.academic_year)),
    );

    let success = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];
    const captureError = (message: string) => {
      if (errors.length < 10) errors.push(message);
    };

    // Sequential: createFeeStructure checks for and, if needed, revives a
    // soft-deleted row, so concurrent writes would race on the same key.
    for (const [index, row] of seedableRows.entries()) {
      const year = row.data.academic_year || academicYear;
      const key = feeStructureKey(row.data.name, row.classId, row.term, year);

      if (existingKeys.has(key)) {
        skipped++;
        setImportProgress({ completed: index + 1, total: seedableRows.length, success, failed, skipped });
        continue;
      }

      try {
        await createFeeStructure({
          name: row.data.name,
          class_id: row.classId || undefined,
          amount: Number(row.data.amount),
          term: row.term,
          academic_year: year,
          due_date: row.data.due_date || undefined,
          category: row.data.category,
          boarding_status: row.data.boarding_status,
          frequency: row.data.frequency,
          transport_zone: row.data.transport_zone || undefined,
        });
        existingKeys.add(key);
        success++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (/already exists/i.test(message)) {
          skipped++;
        } else {
          captureError(`Row ${index + 1} (${row.data.name}, ${row.classLabel}): ${message}`);
          failed++;
        }
      }

      setImportProgress({ completed: index + 1, total: seedableRows.length, success, failed, skipped });
    }

    const summary: ImportSummary = { success, failed, skipped, total: seedableRows.length, errors };
    setImportSummary(summary);
    setImportingTemplate(false);
    return summary;
  }, [academicYear, createFeeStructure, existingFees, seedableRows]);

  return {
    templateRows: seedableRows,
    templatePreviewRows,
    templateStatus,
    templateErrors,
    importingTemplate,
    importProgress,
    importSummary,
    handleFeeTemplateUpload,
    handleSeedFeesFromTemplate,
    resetTemplate,
  };
}
