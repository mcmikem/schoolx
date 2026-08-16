"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card as UICard } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { parseDelimitedText, parseStudentRows, type ValidatedStudentRow } from "@/lib/import/students";
import { logger } from "@/lib/logger";

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

type AddMethod = "upload" | "paste" | "sheets";

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value);
}

export default function ImportPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [method, setMethod] = useState<AddMethod>("upload");
  const [fileName, setFileName] = useState<string>("");

  const [rawText, setRawText] = useState("");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [sheetsLoading, setSheetsLoading] = useState(false);

  const [validatedRows, setValidatedRows] = useState<ValidatedStudentRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const invalidCount = validatedRows.length - validCount;

  const startPreview = useCallback(
    (rawRows: Array<Record<string, unknown>>) => {
      const parsed = parseStudentRows(rawRows);
      if (parsed.length === 0) {
        toast.error("No student rows found. Check that the first row has column headers.");
        return;
      }
      setValidatedRows(parsed);
      setResult(null);
    },
    [toast],
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFileName(selectedFile.name);
    setResult(null);
    setValidatedRows([]);

    const extension = selectedFile.name.split(".").pop()?.toLowerCase() || "";

    try {
      if (extension === "docx") {
        const mammoth = (await import("mammoth")).default;
        const arrayBuffer = await selectedFile.arrayBuffer();
        const { value: text } = await mammoth.extractRawText({ arrayBuffer });
        if (!text.trim()) {
          toast.error("That Word document appears to be empty");
          return;
        }
        const rows = parseDelimitedText(text);
        if (rows.length === 0) {
          setRawText(text);
          setMethod("paste");
          toast.info("No table detected — pasted the document text so AI can read it");
          return;
        }
        startPreview(rows);
      } else if (extension === "xlsx" || extension === "xls") {
        const ExcelJS = (await import("exceljs")).default;
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) throw new Error("No worksheet found");

        const headers: string[] = [];
        const rawRows: Array<Record<string, unknown>> = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) {
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              headers[colNumber - 1] = String(cell.value ?? "");
            });
          } else {
            const obj: Record<string, unknown> = {};
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              obj[headers[colNumber - 1]] = formatCell(cell.value);
            });
            if (Object.keys(obj).length > 0) rawRows.push(obj);
          }
        });
        startPreview(rawRows);
      } else if (extension === "csv" || extension === "txt") {
        const text = await selectedFile.text();
        const rows = parseDelimitedText(text);
        if (rows.length === 0) {
          setRawText(text);
          setMethod("paste");
          toast.info("Could not find a table — pasted the text so AI can read it");
          return;
        }
        startPreview(rows);
      } else {
        toast.error("Unsupported file type. Use Word (.docx), Excel (.xlsx/.xls) or CSV.");
      }
    } catch (err) {
      logger.warn("readFile failed:", err);
      toast.error("Failed to read that file. Try a different one.");
    } finally {
      e.target.value = "";
    }
  };

  const handleAIAnalysis = async () => {
    if (!rawText.trim()) {
      toast.error("Please paste some text first");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const response = await fetch("/api/parse-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to parse text");
      }
      const students = data.data?.students || [];
      if (students.length === 0) {
        throw new Error("No students were found in that text");
      }
      startPreview(students);
      toast.success(`Found ${students.length} students`);
    } catch (error: any) {
      toast.error(error.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSheetsImport = async () => {
    if (!sheetsUrl.trim()) {
      toast.error("Please paste a Google Sheets URL");
      return;
    }
    setSheetsLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/import-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetsUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to import sheet");
      }
      startPreview(data.data?.rows || []);
      toast.success("Sheet loaded successfully");
    } catch (error: any) {
      toast.error(error.message || "Sheet import failed");
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleImport = async () => {
    if (validCount === 0) return;
    setImporting(true);
    try {
      if (!user?.school_id) {
        throw new Error("No school associated with your account");
      }
      const students = validatedRows.filter((r) => r.isValid).map((r) => r.data);
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students, schoolId: user.school_id }),
      });
      const importResult = await response.json();
      if (!response.ok) {
        throw new Error(importResult.error || "Import failed");
      }
      setResult(importResult);
      if (importResult.success > 0) {
        toast.success(`Imported ${importResult.success} students`);
      }
    } catch (error: any) {
      setResult({ success: 0, failed: validCount, errors: [error.message] });
      toast.error(error.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async (format: "xlsx" | "docx") => {
    try {
      if (format === "xlsx") {
        const ExcelJS = (await import("exceljs")).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Students");
        worksheet.columns = [
          { header: "First Name", key: "firstName", width: 15 },
          { header: "Last Name", key: "lastName", width: 15 },
          { header: "Gender", key: "gender", width: 10 },
          { header: "Date of Birth", key: "dob", width: 15 },
          { header: "Class", key: "class", width: 10 },
          { header: "Parent Name", key: "parentName", width: 20 },
          { header: "Parent Phone", key: "parentPhone", width: 15 },
          { header: "Student Number", key: "studentNumber", width: 15 },
        ];
        worksheet.addRow({
          firstName: "Sarah",
          lastName: "Nakato",
          gender: "F",
          dob: "2015-03-15",
          class: "P.5",
          parentName: "James Nakato",
          parentPhone: "0701234567",
          studentNumber: "",
        });
        worksheet.addRow({
          firstName: "John",
          lastName: "Mukasa",
          gender: "M",
          dob: "2014-06-20",
          class: "P.5",
          parentName: "Betty Mukasa",
          parentPhone: "0702345678",
          studentNumber: "",
        });
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "SkoolMateOS_Student_Template.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const response = await fetch("/api/import-template", { method: "GET" });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "Template download failed");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "SkoolMateOS_Student_Template.docx";
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success("Template downloaded");
    } catch (err: any) {
      toast.error(err.message || "Template download failed");
    }
  };

  const reset = () => {
    setValidatedRows([]);
    setResult(null);
    setFileName("");
    setRawText("");
    setSheetsUrl("");
  };

  const methodCard = (m: AddMethod, icon: string, title: string, description: string) => (
    <button
      onClick={() => {
        setMethod(m);
        reset();
      }}
      className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 text-center transition-all cursor-pointer ${
        method === m
          ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/50"
      }`}
    >
      <div className="w-12 h-12 rounded-xl bg-[var(--navy-soft)] flex items-center justify-center">
        <MaterialIcon icon={icon} className="text-2xl text-[var(--primary)]" />
      </div>
      <span className="font-semibold text-sm text-[var(--on-surface)]">{title}</span>
      <span className="text-xs text-[var(--t3)]">{description}</span>
    </button>
  );

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Import Students"
          subtitle="Add students without typing — upload a Word or Excel file, paste a list, or link Google Sheets."
        />

        {validatedRows.length === 0 && result === null && (
          <>
            <UICard className="mb-6 p-6">
              <h2 className="font-semibold text-[var(--on-surface)] mb-1">Step 1 — Get a template (optional)</h2>
              <p className="text-sm text-[var(--t3)] mb-4">
                Already have a student list? Skip this and go to Step 2. Otherwise download a template to fill in.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => downloadTemplate("xlsx")} variant="secondary">
                  <MaterialIcon icon="download" className="text-lg" />
                  Excel Template
                </Button>
                <Button onClick={() => downloadTemplate("docx")} variant="secondary">
                  <MaterialIcon icon="download" className="text-lg" />
                  Word Template
                </Button>
              </div>
            </UICard>

            <UICard className="mb-6 p-6">
              <h2 className="font-semibold text-[var(--on-surface)] mb-1">Step 2 — Add your students</h2>
              <p className="text-sm text-[var(--t3)] mb-4">Choose the way that works best for you.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {methodCard("upload", "upload_file", "Upload a file", "Word, Excel or CSV")}
                {methodCard("paste", "smart_toy", "Paste a list", "AI reads messy text for you")}
                {methodCard("sheets", "table_chart", "Google Sheets", "Paste a shared link")}
              </div>

              <div className="mt-6">
                {method === "upload" && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[var(--surface)] rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] cursor-pointer transition-all p-8 text-center"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.docx,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="w-16 h-16 bg-[var(--navy-soft)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <MaterialIcon icon="upload_file" className="text-3xl text-[var(--primary)]" />
                    </div>
                    <p className="text-[var(--on-surface)] font-medium mb-2">
                      {fileName || "Click to upload or drag and drop"}
                    </p>
                    <p className="text-sm text-[var(--t3)]">Word (.docx) · Excel (.xlsx, .xls) · CSV · Text</p>
                  </div>
                )}

                {method === "paste" && (
                  <div>
                    <p className="text-sm text-[var(--t3)] mb-3">
                      Copied a list from Word, an email, or an old spreadsheet? Paste it here and the AI will turn it
                      into students.
                    </p>
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      className="w-full h-44 p-4 bg-[var(--surface-container)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none resize-none mb-4"
                      placeholder={"Example:\nJohn Mukasa  M  P.5  0701234567\nSarah Nakato  F  P.4  0702345678"}
                    />
                    <Button onClick={handleAIAnalysis} disabled={analyzing || !rawText.trim()} loading={analyzing}>
                      <MaterialIcon icon="psychology" className="text-lg" />
                      {analyzing ? "Reading with AI..." : "Read my list"}
                    </Button>
                  </div>
                )}

                {method === "sheets" && (
                  <div>
                    <p className="text-sm text-[var(--t3)] mb-3">
                      Share your Google Sheet with "Anyone with the link can view", then paste its link here.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="url"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        value={sheetsUrl}
                        onChange={(e) => setSheetsUrl(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                      />
                      <Button
                        onClick={handleSheetsImport}
                        disabled={sheetsLoading || !sheetsUrl.trim()}
                        loading={sheetsLoading}
                      >
                        <MaterialIcon icon="table_chart" className="text-lg" />
                        {sheetsLoading ? "Loading..." : "Load Sheet"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </UICard>
          </>
        )}

        {validatedRows.length > 0 && result === null && (
          <UICard className="mb-6 p-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-4">
              <div>
                <h2 className="font-semibold text-[var(--on-surface)]">Review your students</h2>
                <p className="text-sm text-[var(--t3)] mt-1">
                  <strong className="text-[var(--on-surface)]">{validCount}</strong> ready
                  {invalidCount > 0 && (
                    <>
                      {" "}
                      · <strong className="text-[var(--red)]">{invalidCount} need fixing</strong> (will be skipped)
                    </>
                  )}
                </p>
              </div>
              <Button variant="ghost" onClick={reset}>
                <MaterialIcon icon="arrow_back" className="text-lg" />
                Start over
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface-container)]">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--on-surface)]">Name</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--on-surface)]">Gender</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--on-surface)]">Class</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--on-surface)]">Parent Phone</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--on-surface)]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validatedRows.slice(0, 50).map((row, i) => (
                    <tr
                      key={i}
                      className={`border-t border-[var(--border)] ${row.isValid ? "" : "bg-[var(--red-soft)]/40"}`}
                    >
                      <td className="p-3 font-medium text-[var(--on-surface)]">
                        {row.data.first_name} {row.data.last_name || ""}
                      </td>
                      <td className="p-3 text-[var(--t3)]">{row.data.gender}</td>
                      <td className="p-3 text-[var(--t3)]">{row.data.class_name || "—"}</td>
                      <td className="p-3 text-[var(--t3)]">{row.data.parent_phone || "—"}</td>
                      <td className="p-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                            <MaterialIcon icon="check_circle" className="text-sm" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex flex-wrap gap-1">
                            {row.errors.map((err, errIdx) => (
                              <span
                                key={errIdx}
                                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-[var(--red)] bg-[var(--red-soft)] border border-[var(--red)]/20"
                              >
                                {err}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validatedRows.length > 50 && (
                <p className="p-3 text-sm text-[var(--t3)] italic border-t border-[var(--border)]">
                  ... plus {validatedRows.length - 50} more rows
                </p>
              )}
            </div>

            <Button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              loading={importing}
              size="lg"
              className="w-full mt-6"
            >
              <MaterialIcon icon="database" className="text-xl" />
              {importing ? "Saving to Database..." : `Confirm & Import ${validCount} Students`}
            </Button>
          </UICard>
        )}

        {result && (
          <UICard className="p-6">
            <h2 className="font-semibold text-[var(--on-surface)] mb-4">Import Results</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-4 bg-[var(--green-soft)] rounded-xl">
                <div className="text-2xl font-bold text-[var(--green)]">{result.success}</div>
                <div className="text-sm text-[var(--t3)]">Successful</div>
              </div>
              <div className="text-center p-4 bg-[var(--red-soft)] rounded-xl">
                <div className="text-2xl font-bold text-[var(--red)]">{result.failed}</div>
                <div className="text-sm text-[var(--t3)]">Failed</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="p-4 bg-[var(--red-soft)] rounded-xl mb-4">
                <p className="text-sm font-medium text-[var(--red)] mb-2">Errors:</p>
                <ul className="text-sm text-[var(--t3)] space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 20).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button variant="secondary" onClick={reset} className="w-full">
              <MaterialIcon icon="add" className="text-lg" />
              Import more students
            </Button>
          </UICard>
        )}
      </div>
    </PageErrorBoundary>
  );
}
