"use client";

import { useCallback, useState } from "react";
import Papa from "papaparse";
import type { CreateStudentInput } from "@/types";
import { resolveClassIdForImport } from "@/lib/student-hub";

export type TemplateRow = Record<string, string>;

interface ImportSummary {
  success: number;
  failed: number;
  total: number;
}

interface UseStudentTemplateImportParams {
  classes: Array<{ id: string; name: string }>;
  createStudent: (student: CreateStudentInput) => Promise<unknown>;
}

export function useStudentTemplateImport(
  params: UseStudentTemplateImportParams,
) {
  const { classes, createStudent } = params;
  const [templateRows, setTemplateRows] = useState<TemplateRow[]>([]);
  const [templatePreviewRows, setTemplatePreviewRows] = useState<TemplateRow[]>(
    [],
  );
  const [templateStatus, setTemplateStatus] = useState<
    "idle" | "parsing" | "ready"
  >("idle");
  const [templateErrors, setTemplateErrors] = useState<string | null>(null);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(
    null,
  );

  const handleStudentTemplateUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setTemplateStatus("parsing");
      setTemplateErrors(null);
      setTemplateRows([]);
      setTemplatePreviewRows([]);
      setImportSummary(null);

      Papa.parse<TemplateRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const normalized: TemplateRow[] = results.data.map((row) => ({
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

          setTemplateRows(normalized);
          setTemplatePreviewRows(normalized.slice(0, 5));
          setTemplateStatus("ready");
        },
        error: (error) => {
          setTemplateErrors(error.message);
          setTemplateStatus("idle");
        },
      });
    },
    [],
  );

  const handleSeedStudentsFromTemplate = useCallback(async () => {
    if (!templateRows.length) {
      setTemplateErrors("Upload a template before seeding.");
      return;
    }

    setImportingTemplate(true);
    let success = 0;
    let failed = 0;

    for (const row of templateRows) {
      const classId = resolveClassIdForImport(row, classes);
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
      } catch {
        failed++;
      }
    }

    setImportSummary({ success, failed, total: templateRows.length });
    setImportingTemplate(false);
  }, [classes, createStudent, templateRows]);

  return {
    templateRows,
    templatePreviewRows,
    templateStatus,
    templateErrors,
    importingTemplate,
    importSummary,
    handleStudentTemplateUpload,
    handleSeedStudentsFromTemplate,
  };
}
