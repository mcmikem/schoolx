"use client";
import { useState } from "react";
import Papa from "papaparse";
import { logger } from "@/lib/logger";
import ExcelJS from "exceljs";

export interface UseStudentImportResult {
  templateStatus: "idle" | "parsing" | "ready";
  templateErrors: string | null;
  templateRowsCount: number;
  templatePreviewRows: Record<string, string>[];
  importingTemplate: boolean;
  importProgress: { completed: number; total: number; success: number; failed: number } | null;
  importSummary: { success: number; failed: number; total: number; errors: string[] } | null;
  onTemplateUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSeedTemplate: () => void;
}

export function useStudentImport(
  classes: { id: string; name: string }[],
  createStudent: (data: any) => Promise<any>,
  toast: { error: (msg: string) => void },
): UseStudentImportResult {
  const [templateRows, setTemplateRows] = useState<Record<string, string>[]>([]);
  const [templatePreviewRows, setTemplatePreviewRows] = useState<Record<string, string>[]>([]);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "parsing" | "ready">("idle");
  const [templateErrors, setTemplateErrors] = useState<string | null>(null);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    completed: number;
    total: number;
    success: number;
    failed: number;
  } | null>(null);
  const [importSummary, setImportSummary] = useState<{
    success: number;
    failed: number;
    total: number;
    errors: string[];
  } | null>(null);

  const resolveClassId = (row: Record<string, string>) => {
    if (row.class_id) return row.class_id;
    if (!row.class_name) return "";
    const match = classes.find(
      (c) => c.name.toLowerCase() === row.class_name?.toLowerCase(),
    );
    return match?.id || "";
  };

  const normalizeTemplateRows = (rows: Record<string, string>[]) =>
    rows.map((row) => ({
      student_number: row.student_number?.trim() || "",
      first_name: row.first_name?.trim() || "",
      last_name: row.last_name?.trim() || "",
      gender: row.gender?.trim().toUpperCase() === "F" ? "F" : "M",
      class_name: row.class_name?.trim() || "",
      class_id: row.class_id?.trim() || "",
      ple_index_number: row.ple_index_number?.trim() || "",
      parent_name: row.parent_name?.trim() || "",
      parent_phone: row.parent_phone?.trim() || "",
      parent_phone2: row.parent_phone2?.trim() || "",
      opening_balance: row.opening_balance?.trim() || "0",
    }));

  const parseExcelTemplate = async (file: File) => {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [] as Record<string, string>[];

    const headerRow = worksheet.getRow(1);
    const rowValues = headerRow.values;
    const cellValues = Array.isArray(rowValues) ? rowValues : [];
    const headers = cellValues
      .slice(1)
      .map((header) =>
        String(header || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_")
      );

    const parsedRows: Record<string, string>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const rowCellValues = row.values;
      const cellVals = Array.isArray(rowCellValues) ? rowCellValues : [];
      const values = cellVals.slice(1).map((value) =>
        String(value ?? "").trim(),
      );

      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (!header) return;
        record[header] = values[index] || "";
      });

      const hasData = Object.values(record).some((value) => value.length > 0);
      if (hasData) {
        parsedRows.push(record);
      }
    });

    return parsedRows;
  };

  const handleTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTemplateStatus("parsing");
    setTemplateErrors(null);
    setTemplateRows([]);
    setTemplatePreviewRows([]);
    setImportSummary(null);
    setImportProgress(null);

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "xlsx") {
      parseExcelTemplate(file)
        .then((rows) => {
          const normalized = normalizeTemplateRows(rows);
          setTemplateRows(normalized);
          setTemplatePreviewRows(normalized.slice(0, 5));
          setTemplateStatus("ready");
        })
        .catch((error: unknown) => {
          setTemplateErrors(
            error instanceof Error
              ? error.message
              : "Failed to parse Excel file",
          );
          setTemplateStatus("idle");
        });
      return;
    }

    if (extension === "xls") {
      setTemplateErrors(
        "Legacy .xls files are not supported yet. Please save as .xlsx or .csv and upload again.",
      );
      setTemplateStatus("idle");
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const normalized = normalizeTemplateRows(results.data);
        setTemplateRows(normalized);
        setTemplatePreviewRows(normalized.slice(0, 5));
        setTemplateStatus("ready");
      },
      error: (error) => {
        setTemplateErrors(error.message);
        setTemplateStatus("idle");
      },
    });
  };

  const handleSeedFromTemplate = async () => {
    if (!templateRows.length) {
      setTemplateErrors("Upload a template before seeding.");
      return;
    }
    setImportingTemplate(true);
    setImportProgress({ completed: 0, total: templateRows.length, success: 0, failed: 0 });
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    const captureError = (message: string) => {
      if (errors.length < 10) errors.push(message);
    };

    for (const [index, row] of templateRows.entries()) {
      const classId = resolveClassId(row);
      if (!row.first_name || !row.last_name || !classId) {
        captureError(
          `Row ${index + 1}: missing ${!row.first_name ? "first name" : !row.last_name ? "last name" : "class"}`,
        );
        failed++;
        setImportProgress({ completed: index + 1, total: templateRows.length, success, failed });
        continue;
      }
      try {
        await createStudent({
          first_name: row.first_name,
          last_name: row.last_name,
          gender: row.gender === "F" ? "F" : "M",
          class_id: classId,
          student_number: row.student_number || undefined,
          ple_index_number: row.ple_index_number || undefined,
          parent_name: row.parent_name || "",
          parent_phone: row.parent_phone || "",
          parent_phone2: row.parent_phone2 || undefined,
          opening_balance: parseFloat(row.opening_balance || "0"),
          status: "active",
        });
        success++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        captureError(`Row ${index + 1} (${row.first_name} ${row.last_name}): ${message}`);
        logger.error("Bulk student import error:", error);
        failed++;
      }
      setImportProgress({ completed: index + 1, total: templateRows.length, success, failed });
    }
    setImportSummary({ success, failed, total: templateRows.length, errors });
    setImportingTemplate(false);
  };

  return {
    templateStatus,
    templateErrors,
    templateRowsCount: templateRows.length,
    templatePreviewRows,
    importingTemplate,
    importProgress,
    importSummary,
    onTemplateUpload: handleTemplateUpload,
    onSeedTemplate: handleSeedFromTemplate,
  };
}
