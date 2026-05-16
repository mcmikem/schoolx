"use client";
import { useState } from "react";
import Papa from "papaparse";
import { logger } from "@/lib/logger";

export interface UseStudentImportResult {
  templateStatus: "idle" | "parsing" | "ready";
  templateErrors: string | null;
  templateRowsCount: number;
  templatePreviewRows: Record<string, string>[];
  importingTemplate: boolean;
  importSummary: { success: number; failed: number; total: number } | null;
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
  const [importSummary, setImportSummary] = useState<{
    success: number;
    failed: number;
    total: number;
  } | null>(null);

  const resolveClassId = (row: Record<string, string>) => {
    if (row.class_id) return row.class_id;
    if (!row.class_name) return "";
    const match = classes.find(
      (c) => c.name.toLowerCase() === row.class_name?.toLowerCase(),
    );
    return match?.id || "";
  };

  const handleTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTemplateStatus("parsing");
    setTemplateErrors(null);
    setTemplateRows([]);
    setTemplatePreviewRows([]);
    setImportSummary(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const normalized: Record<string, string>[] = results.data.map(
          (row) => ({
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
          }),
        );
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
    let success = 0;
    let failed = 0;
    for (const row of templateRows) {
      const classId = resolveClassId(row);
      if (!row.first_name || !row.last_name || !classId) {
        failed++;
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
        logger.error("Bulk student import error:", error);
        failed++;
      }
    }
    setImportSummary({ success, failed, total: templateRows.length });
    setImportingTemplate(false);
  };

  return {
    templateStatus,
    templateErrors,
    templateRowsCount: templateRows.length,
    templatePreviewRows,
    importingTemplate,
    importSummary,
    onTemplateUpload: handleTemplateUpload,
    onSeedTemplate: handleSeedFromTemplate,
  };
}
