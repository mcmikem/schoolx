"use client";

/**
 * DEPRECATED — use useStudentTemplateImport from "@/lib/hooks/useStudentTemplateImport" instead.
 *
 * This file is kept for backward compatibility. All new code should use the hook-based
 * implementation which is the canonical CSV import solution. See:
 *   src/lib/hooks/useStudentTemplateImport.ts
 *
 * The useStudentImport hook below is a thin wrapper that delegates to the
 * canonical hook implementation.
 */
import { useState } from "react";
import { useStudentTemplateImport } from "@/lib/hooks/useStudentTemplateImport";

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
  const hook = useStudentTemplateImport({ classes, createStudent });
  const [importSummary, setImportSummary] = useState<{
    success: number;
    failed: number;
    total: number;
    errors: string[];
  } | null>(null);

  const onSeedTemplate = async () => {
    await hook.handleSeedStudentsFromTemplate();
    if (hook.importSummary) {
      setImportSummary(hook.importSummary);
    }
  };

  return {
    templateStatus: hook.templateStatus,
    templateErrors: hook.templateErrors,
    templateRowsCount: hook.templateRows.length,
    templatePreviewRows: hook.templatePreviewRows,
    importingTemplate: hook.importingTemplate,
    importProgress: null,
    importSummary,
    onTemplateUpload: hook.handleStudentTemplateUpload,
    onSeedTemplate,
  };
}
