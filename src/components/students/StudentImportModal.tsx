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
import { useStudentTemplateImport } from "@/lib/hooks/useStudentTemplateImport";

export interface UseStudentImportResult {
  templateStatus: "idle" | "parsing" | "ready";
  templateErrors: string | null;
  templateRowsCount: number;
  templatePreviewRows: Record<string, string>[];
  importingTemplate: boolean;
  importProgress: {
    completed: number;
    total: number;
    success: number;
    failed: number;
    skipped?: number;
  } | null;
  importSummary: {
    success: number;
    failed: number;
    skipped: number;
    total: number;
    errors: string[];
  } | null;
  onTemplateUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSeedTemplate: () => void;
}

export function useStudentImport(
  classes: { id: string; name: string }[],
  createStudent: (data: any) => Promise<any>,
  toast: { error: (msg: string) => void },
  houses: { id: string; name: string }[] = [],
): UseStudentImportResult {
  const hook = useStudentTemplateImport({ classes, houses, createStudent });

  const onSeedTemplate = () => hook.handleSeedStudentsFromTemplate();

  return {
    templateStatus: hook.templateStatus,
    templateErrors: hook.templateErrors,
    templateRowsCount: hook.templateRows.length,
    templatePreviewRows: hook.templatePreviewRows,
    importingTemplate: hook.importingTemplate,
    importProgress: hook.importProgress,
    // Read straight off the hook: this object is rebuilt on every render, so it
    // carries the latest summary. The wrapper used to copy the summary into its
    // own state by reading hook.importSummary immediately after awaiting, which
    // held the render that started the import -- null on the first run -- so the
    // completion line never showed and users could not tell whether anything
    // had been saved.
    importSummary: hook.importSummary,
    onTemplateUpload: hook.handleStudentTemplateUpload,
    onSeedTemplate,
  };
}
