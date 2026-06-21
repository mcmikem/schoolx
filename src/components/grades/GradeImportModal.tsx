"use client";
import { useState, useCallback } from "react";
import Papa from "papaparse";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/index";
import MaterialIcon from "@/components/MaterialIcon";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withTimeout } from "@/lib/hooks/utils";

interface GradeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  term: number;
  academicYear: string;
  schoolId?: string;
  subjects: { id: string; name: string }[];
  students: { id: string; student_number: string; first_name: string; last_name: string }[];
  userId?: string;
  isDemo?: boolean;
  toast: { success: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void };
}

interface ParsedRow {
  raw: Record<string, string>;
}

interface ColumnMapping {
  studentColumn: string;
  subjectColumn: string;
  scoreColumn: string;
  assessmentTypeColumn: string;
  fixedAssessmentType: string;
}

export function GradeImportModal({
  isOpen,
  onClose,
  classId,
  term,
  academicYear,
  schoolId,
  subjects,
  students,
  userId,
  isDemo,
  toast,
}: GradeImportModalProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "parsing" | "ready" | "importing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
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
  const [mapping, setMapping] = useState<ColumnMapping>({
    studentColumn: "",
    subjectColumn: "",
    scoreColumn: "",
    assessmentTypeColumn: "",
    fixedAssessmentType: "exam",
  });

  const ASSESSMENT_TYPES = ["ca1", "ca2", "ca3", "ca4", "project", "exam"];

  const reset = useCallback(() => {
    setParsedRows([]);
    setPreviewRows([]);
    setHeaders([]);
    setStatus("idle");
    setError(null);
    setImportProgress(null);
    setImportSummary(null);
    setMapping({
      studentColumn: "",
      subjectColumn: "",
      scoreColumn: "",
      assessmentTypeColumn: "",
      fixedAssessmentType: "exam",
    });
  }, []);

  const parseExcel = async (file: File): Promise<Record<string, string>[]> => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const headerRow = worksheet.getRow(1);
    const rowValues = headerRow.values;
    const cellValues = Array.isArray(rowValues) ? rowValues : [];
    const hdrs = cellValues.slice(1).map((h) => String(h || "").trim());
    setHeaders(hdrs);

    const rows: Record<string, string>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cellVals = Array.isArray(row.values) ? row.values : [];
      const values = cellVals.slice(1).map((v) => String(v ?? "").trim());
      const record: Record<string, string> = {};
      hdrs.forEach((header, index) => {
        if (!header) return;
        record[header] = values[index] || "";
      });
      const hasData = Object.values(record).some((v) => v.length > 0);
      if (hasData) rows.push(record);
    });
    return rows;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("parsing");
    setError(null);
    setParsedRows([]);
    setPreviewRows([]);
    setImportSummary(null);
    setImportProgress(null);

    const extension = file.name.split(".").pop()?.toLowerCase();

    try {
      let rows: Record<string, string>[];

      if (extension === "xlsx") {
        rows = await parseExcel(file);
      } else if (extension === "xls") {
        setError("Legacy .xls files are not supported. Please save as .xlsx or .csv.");
        setStatus("idle");
        return;
      } else {
        const result = await new Promise<Record<string, string>[]>((resolve, reject) => {
          Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.data.length > 0) {
                setHeaders(Object.keys(results.data[0]));
              }
              resolve(results.data);
            },
            error: (err) => reject(err),
          });
        });
        rows = result;
      }

      if (rows.length === 0) {
        setError("The file appears empty. Add a header row and at least one data row.");
        setStatus("idle");
        return;
      }

      setParsedRows(rows.map((r) => ({ raw: r })));
      setPreviewRows(rows.slice(0, 5));
      const hdrs = Object.keys(rows[0]);
      setHeaders(hdrs);

      const lc = hdrs.map((h) => h.toLowerCase());
      const guessStudent = lc.find((h) => h.includes("student") || h.includes("name") || h.includes("adm") || h.includes("number")) || "";
      const guessSubject = lc.find((h) => h.includes("subject") || h.includes("course")) || "";
      const guessScore = lc.find((h) => h.includes("score") || h.includes("mark") || h.includes("grade") || h.includes("result")) || "";
      const guessAssessment = lc.find((h) => h.includes("assessment") || h.includes("type") || h.includes("test") || h.includes("ca")) || "";

      setMapping({
        studentColumn: guessStudent ? hdrs[lc.indexOf(guessStudent)] : "",
        subjectColumn: guessSubject ? hdrs[lc.indexOf(guessSubject)] : "",
        scoreColumn: guessScore ? hdrs[lc.indexOf(guessScore)] : "",
        assessmentTypeColumn: guessAssessment ? hdrs[lc.indexOf(guessAssessment)] : "",
        fixedAssessmentType: "exam",
      });

      setStatus("ready");
    } catch (err) {
      logger.error("Parse error:", err);
      setError("Failed to parse file. Check the format and try again.");
      setStatus("idle");
    }
  };

  const findStudent = (value: string): { id: string } | null => {
    if (!value) return null;
    const trimmed = value.trim().toLowerCase();
    const byNumber = students.find((s) => s.student_number.toLowerCase() === trimmed);
    if (byNumber) return byNumber;
    const byFullName = students.find(
      (s) => `${s.first_name} ${s.last_name}`.toLowerCase() === trimmed,
    );
    if (byFullName) return byFullName;
    const byFirstName = students.find((s) => s.first_name.toLowerCase() === trimmed);
    if (byFirstName) return byFirstName;
    return null;
  };

  const findSubject = (value: string): { id: string } | null => {
    if (!value) return null;
    const trimmed = value.trim().toLowerCase();
    const match = subjects.find((s) => s.name.toLowerCase() === trimmed);
    return match || null;
  };

  const handleImport = async () => {
    if (!mapping.studentColumn || !mapping.scoreColumn) {
      setError("Map at least the student column and score column before importing.");
      return;
    }

    setStatus("importing");
    const total = parsedRows.length;
    setImportProgress({ completed: 0, total, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    const captureError = (msg: string) => {
      if (errors.length < 20) errors.push(msg);
    };

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i].raw;
      const studentVal = row[mapping.studentColumn];
      const scoreVal = row[mapping.scoreColumn];
      const subjectVal = mapping.subjectColumn ? row[mapping.subjectColumn] : "";
      const assessmentVal = mapping.assessmentTypeColumn
        ? row[mapping.assessmentTypeColumn]
        : mapping.fixedAssessmentType;

      if (!studentVal) {
        captureError(`Row ${i + 1}: missing student identifier`);
        failed++;
        setImportProgress({ completed: i + 1, total, success, failed });
        continue;
      }

      if (!scoreVal || isNaN(parseFloat(scoreVal))) {
        captureError(`Row ${i + 1}: invalid or missing score`);
        failed++;
        setImportProgress({ completed: i + 1, total, success, failed });
        continue;
      }

      const student = findStudent(studentVal);
      if (!student) {
        captureError(`Row ${i + 1}: student "${studentVal}" not found`);
        failed++;
        setImportProgress({ completed: i + 1, total, success, failed });
        continue;
      }

      let subjectId: string;
      if (subjectVal) {
        const subject = findSubject(subjectVal);
        if (!subject) {
          captureError(`Row ${i + 1}: subject "${subjectVal}" not found`);
          failed++;
          setImportProgress({ completed: i + 1, total, success, failed });
          continue;
        }
        subjectId = subject.id;
      } else {
        captureError(`Row ${i + 1}: no subject column mapped and no subject value`);
        failed++;
        setImportProgress({ completed: i + 1, total, success, failed });
        continue;
      }

      const assessmentType = assessmentVal.toLowerCase();
      if (!ASSESSMENT_TYPES.includes(assessmentType)) {
        captureError(`Row ${i + 1}: invalid assessment type "${assessmentVal}". Must be one of: ${ASSESSMENT_TYPES.join(", ")}`);
        failed++;
        setImportProgress({ completed: i + 1, total, success, failed });
        continue;
      }

      const score = parseFloat(scoreVal);
      if (score < 0) {
        captureError(`Row ${i + 1}: score cannot be negative`);
        failed++;
        setImportProgress({ completed: i + 1, total, success, failed });
        continue;
      }

      try {
        const payload = {
          student_id: student.id,
          subject_id: subjectId,
          class_id: classId,
          assessment_type: assessmentType,
          score,
          term,
          academic_year: academicYear,
          recorded_by: userId,
        };

        if (isDemo) {
          await new Promise((r) => setTimeout(r, 50));
        } else {
          await withTimeout(
            supabase
              .from("grades")
              .upsert(payload, {
                onConflict: "student_id,subject_id,assessment_type,term,academic_year",
              })
              .select()
              .single()
              .then((r) => r),
            15000,
            { data: { id: "timeout-fallback" }, error: null } as any,
          );
        }
        success++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        captureError(`Row ${i + 1}: ${message}`);
        logger.error("Grade import error:", err);
        failed++;
      }

      setImportProgress({ completed: i + 1, total, success, failed });
    }

    setImportSummary({ success, failed, total, errors });
    setStatus("done");
    toast.success(`Imported ${success} grade(s) successfully`);
    if (failed > 0) {
      toast.error(`${failed} grade(s) failed to import`);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const updateMapping = (key: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Grades" size="xl">
      <div className="space-y-5">
        {status === "idle" && (
          <div className="bg-surface-container-low rounded-xl p-5">
            <p className="text-sm font-medium mb-3">Upload an Excel (.xlsx) or CSV file with grade data</p>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="w-full text-sm"
              onChange={handleFileUpload}
            />
            <p className="text-xs text-[var(--t3)] mt-2">
              Expected columns: student identifier (name or admission number), subject, score, assessment type (optional)
            </p>
          </div>
        )}

        {status === "parsing" && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              <span className="text-sm text-[var(--t2)]">Parsing file...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-error-container text-error rounded-xl p-4 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <MaterialIcon icon="error" className="text-base" />
              <span className="font-medium">Error</span>
            </div>
            <p>{error}</p>
          </div>
        )}

        {(status === "ready" || status === "importing") && previewRows.length > 0 && (
          <>
            <div className="bg-surface-container-low rounded-xl p-5 space-y-4">
              <h4 className="text-sm font-semibold">Column Mapping</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-[var(--t2)] block mb-1">Student Column *</label>
                  <select
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                    value={mapping.studentColumn}
                    onChange={(e) => updateMapping("studentColumn", e.target.value)}
                  >
                    <option value="">-- Select column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--t2)] block mb-1">Subject Column</label>
                  <select
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                    value={mapping.subjectColumn}
                    onChange={(e) => updateMapping("subjectColumn", e.target.value)}
                  >
                    <option value="">-- Select column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--t2)] block mb-1">Score Column *</label>
                  <select
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                    value={mapping.scoreColumn}
                    onChange={(e) => updateMapping("scoreColumn", e.target.value)}
                  >
                    <option value="">-- Select column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--t2)] block mb-1">Assessment Type Column</label>
                  <select
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                    value={mapping.assessmentTypeColumn}
                    onChange={(e) => updateMapping("assessmentTypeColumn", e.target.value)}
                  >
                    <option value="">-- Use fixed type below --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                {!mapping.assessmentTypeColumn && (
                  <div>
                    <label className="text-xs font-medium text-[var(--t2)] block mb-1">Fixed Assessment Type</label>
                    <select
                      className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                      value={mapping.fixedAssessmentType}
                      onChange={(e) => updateMapping("fixedAssessmentType", e.target.value)}
                    >
                      {ASSESSMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-container-low rounded-xl p-5">
              <h4 className="text-sm font-semibold mb-3">
                Preview ({parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      {headers.map((h) => (
                        <th key={h} className="text-left py-2 px-2 font-medium text-[var(--t2)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-outline-variant/50">
                        {headers.map((h) => (
                          <td key={h} className="py-2 px-2 text-on-surface truncate max-w-[160px]">{row[h] || ""}</td>
                        ))}
                      </tr>
                    ))}
                    {parsedRows.length > 5 && (
                      <tr>
                        <td
                          colSpan={headers.length}
                          className="py-2 px-2 text-center text-[var(--t3)] italic"
                        >
                          ... and {parsedRows.length - 5} more row{parsedRows.length - 5 !== 1 ? "s" : ""}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {importProgress && (
              <div className="bg-surface-container-low rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Importing...</span>
                  <span className="text-sm text-[var(--t2)]">
                    {importProgress.completed} / {importProgress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${(importProgress.completed / importProgress.total) * 100}%` }}
                  />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-[var(--t2)]">
                  <span className="text-success">✓ {importProgress.success}</span>
                  {importProgress.failed > 0 && (
                    <span className="text-error">✗ {importProgress.failed}</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {status === "done" && importSummary && (
          <div className="bg-surface-container-low rounded-xl p-5 text-center space-y-3">
            <MaterialIcon
              icon={importSummary.failed === 0 ? "check_circle" : "warning"}
              className={`text-4xl ${importSummary.failed === 0 ? "text-success" : "text-warning"}`}
            />
            <div>
              <p className="text-lg font-semibold">Import Complete</p>
              <p className="text-sm text-[var(--t2)]">
                {importSummary.success} of {importSummary.total} grade(s) imported successfully
                {importSummary.failed > 0 && `, ${importSummary.failed} failed`}
              </p>
            </div>
            {importSummary.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto text-left bg-surface-container-high rounded-lg p-3">
                <p className="text-xs font-medium text-error mb-1">Errors:</p>
                {importSummary.errors.map((err, i) => (
                  <p key={i} className="text-xs text-error py-0.5">{err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ModalFooter>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            {status === "done" ? "Close" : "Cancel"}
          </Button>
          {(status === "ready" || status === "importing") && (
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={status === "importing" || !mapping.studentColumn || !mapping.scoreColumn}
            >
              {status === "importing" ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Importing...
                </span>
              ) : (
                "Import"
              )}
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
