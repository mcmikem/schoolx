"use client";
import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useClasses } from "@/lib/hooks";
import { buildRosterKeys, loadExistingStudents, type RosterKeys } from "@/lib/import/existing-roster";
import {
  type BoardingStatus,
  buildClassAliasMap,
  buildHouseAliasMap,
  buildStudentTemplateCsv,
  parseDelimitedText,
  parseStudentRows,
  resolveClassId,
  resolveHouseId,
  studentIdentityKey,
  type ValidatedStudentRow,
} from "@/lib/import/students";
import { supabase } from "@/lib/supabase";
import type { CreateStudentInput } from "@/types";

interface ImportResult {
  success: number;
  failed: number;
  /** Rows the school already had, skipped rather than duplicated. */
  skipped: number;
  errors: string[];
}

interface BulkImportProps {
  onComplete: () => void;
  /**
   * The Students page hands over the same creator the registry's own import
   * uses. This component used to insert rows directly, which meant it wrote 11
   * of the 29 fields its own template asked for, took the class from a single
   * dropdown instead of the file, and had no plan limit, no uniqueness check
   * and no parent portal account.
   */
  createStudent: (student: CreateStudentInput) => Promise<unknown>;
  houses?: Array<{ id: string; name: string }>;
}

export default function BulkImport({ onComplete, createStudent, houses = [] }: BulkImportProps) {
  const { school } = useAuth();
  const { classes } = useClasses(school?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [validatedRows, setValidatedRows] = useState<ValidatedStudentRow[]>([]);
  const [error, setError] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    success: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const parseCSV = (text: string): ValidatedStudentRow[] => {
    const rows = parseDelimitedText(text);
    if (rows.length === 0) {
      throw new Error("No data rows found in file. Check that the first row has column headers.");
    }
    return parseStudentRows(rows);
  };

  const processFile = (file: File) => {
    setError("");
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setError("Please upload a CSV file (.csv)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        setValidatedRows(parsed);
        setStep("preview");
      } catch (err: any) {
        setError(err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
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
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (!school?.id) {
      setError("Cannot import - no school connection");
      return;
    }

    setStep("importing");
    setError("");
    setProgress(null);

    const validStudents = validatedRows.filter((r) => r.isValid).map((r) => r.data);
    if (validStudents.length === 0) {
      setError("No valid rows to import.");
      setStep("preview");
      return;
    }

    if (typeof window !== "undefined" && localStorage.getItem("skoolmate_demo_v1") !== null) {
      await new Promise((r) => setTimeout(r, 1500));
      setResult({ success: validStudents.length, failed: 0, skipped: 0, errors: [] });
      setStep("complete");
      return;
    }

    // A class from the file wins; the dropdown is only the fallback for a
    // roster that has no Class column. Previously the dropdown was the sole
    // source, so every learner in the file landed in whatever was selected.
    const classMap = buildClassAliasMap(classes);
    const houseMap = buildHouseAliasMap(houses);

    let roster: RosterKeys;
    try {
      roster = buildRosterKeys(await loadExistingStudents(school.id));
    } catch (err) {
      // Failing open here is how duplicates are made: an unreadable roster
      // would be treated as an empty one.
      setError(`${err instanceof Error ? err.message : "Could not check existing students"}. Nothing was imported.`);
      setStep("preview");
      return;
    }

    const errors: string[] = [];
    const captureError = (message: string) => {
      if (errors.length < 10) errors.push(message);
    };

    let success = 0;
    let skipped = 0;
    let failed = 0;
    const total = validStudents.length;

    for (const [index, s] of validStudents.entries()) {
      const label = `${s.first_name} ${s.last_name}`;
      const number = String(s.student_number || "").trim();

      if (
        (number && roster.numbers.has(number)) ||
        roster.people.has(studentIdentityKey(s.first_name, s.last_name, s.gender, s.date_of_birth))
      ) {
        skipped++;
        setProgress({ completed: index + 1, total, success, skipped, failed });
        continue;
      }

      const classId = resolveClassId(classMap, s.class_name) || selectedClass || "";
      if (!classId) {
        captureError(
          `Row ${index + 1} (${label}): no class matches "${
            s.class_name || "(none)"
          }". Classes in this school: ${classes.map((c) => c.name).join(", ") || "none yet"}`,
        );
        failed++;
        setProgress({ completed: index + 1, total, success, skipped, failed });
        continue;
      }

      try {
        await createStudent({
          first_name: s.first_name,
          last_name: s.last_name,
          gender: s.gender as "M" | "F",
          date_of_birth: s.date_of_birth || undefined,
          class_id: classId,
          student_number: number || undefined,
          ple_index_number: s.ple_index_number || undefined,
          parent_name: s.parent_name,
          parent_phone: s.parent_phone,
          parent_phone2: s.parent_phone2 || undefined,
          parent_email: s.parent_email || undefined,
          address: s.address || undefined,
          village: s.village || undefined,
          parish: s.parish || undefined,
          sub_county: s.sub_county || undefined,
          district_origin: s.district_origin || undefined,
          boarding_status: (s.boarding_status || "day") as BoardingStatus,
          house_id: resolveHouseId(houseMap, s.house_name) || undefined,
          previous_school: s.previous_school || undefined,
          blood_type: s.blood_type || undefined,
          religion: s.religion || undefined,
          nationality: s.nationality || undefined,
          nin: s.nin || undefined,
          opening_balance: s.opening_balance ? Number(s.opening_balance) : 0,
          is_class_monitor: s.is_class_monitor,
          prefect_role: s.prefect_role || undefined,
          student_council_role: s.student_council_role || undefined,
          games_house: s.games_house || undefined,
          uneab_number: s.uneab_number || undefined,
          status: "active",
        });
        success++;
      } catch (err) {
        captureError(`Row ${index + 1} (${label}): ${err instanceof Error ? err.message : "Unknown error"}`);
        failed++;
      }

      setProgress({ completed: index + 1, total, success, skipped, failed });
    }

    setResult({ success, failed, skipped, errors });
    setStep("complete");
  };

  /**
   * Header row only, and the same 29 headings every other screen hands out.
   *
   * This button used to emit a 7-column file with three sample learners in it.
   * The importer accepted 29 columns, so anything the school had beyond those
   * seven had nowhere to go -- and anyone who uploaded the file unedited added
   * John Doe, Mary Smith and Peter Jones to their register.
   */
  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF", buildStudentTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGoogleSheetsImport = async () => {
    if (!sheetsUrl.trim()) {
      setError("Please enter a Google Sheets URL");
      return;
    }
    // Extract sheet ID and gid from URL
    const sheetIdMatch = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      setError("Invalid Google Sheets URL. Copy the URL from your browser's address bar.");
      return;
    }
    const sheetId = sheetIdMatch[1];
    const gidMatch = sheetsUrl.match(/gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    setSheetsLoading(true);
    setError("");
    try {
      const res = await fetch(csvExportUrl);
      if (!res.ok)
        throw new Error("Could not fetch the sheet. Make sure it is set to 'Anyone with the link can view'.");
      const text = await res.text();
      const parsed = parseCSV(text);
      setValidatedRows(parsed);
      setStep("preview");
    } catch (err: any) {
      setError(err.message || "Failed to import from Google Sheets");
    } finally {
      setSheetsLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 16,
          color: "var(--t1)",
        }}
      >
        Bulk Import Students
      </h2>

      {error && (
        <div
          style={{
            padding: 12,
            background: "var(--red-soft)",
            color: "var(--red)",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {step === "upload" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="class-assign"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--t2)",
                display: "block",
                marginBottom: 8,
              }}
            >
              Assign to Class (optional)
            </label>
            <select
              id="class-assign"
              aria-label="Assign to Class"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
            aria-label="Upload CSV file"
            style={{
              border: `2px dashed ${isDragOver ? "var(--primary)" : "var(--border)"}`,
              borderRadius: 12,
              padding: 40,
              textAlign: "center",
              cursor: "pointer",
              background: isDragOver ? "var(--primary-light, rgba(0,32,69,0.05))" : "var(--bg)",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 48,
                color: "var(--t4)",
                display: "block",
                marginBottom: 16,
              }}
            >
              upload_file
            </span>
            <p
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--t1)",
                marginBottom: 8,
              }}
            >
              {isDragOver ? "Drop your CSV file here" : "Click to upload CSV file"}
            </p>
            <p style={{ fontSize: 13, color: "var(--t3)" }}>Or drag and drop your file here</p>
            <p style={{ fontSize: 12, color: "var(--t4)", marginTop: 6 }}>
              CSV only. For Excel (.xlsx), use Import on the Students page.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,text/csv"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </div>

          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button
              onClick={downloadTemplate}
              style={{
                background: "none",
                border: "none",
                color: "var(--navy)",
                cursor: "pointer",
                fontSize: 14,
                textDecoration: "underline",
              }}
            >
              Download CSV template
            </button>
          </div>

          {/* Google Sheets Import */}
          <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", marginBottom: 10, textAlign: "center" }}>
              — or import directly from Google Sheets —
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                placeholder="Paste Google Sheets URL here…"
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                onClick={handleGoogleSheetsImport}
                disabled={sheetsLoading || !sheetsUrl.trim()}
                style={{
                  padding: "10px 18px",
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: sheetsLoading || !sheetsUrl.trim() ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {sheetsLoading ? "Importing…" : "Import Sheet"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--t4)", marginTop: 6 }}>
              The sheet must be shared as "Anyone with the link can view". Columns must match the CSV template.
            </p>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="animate-fade-in">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-[var(--t1)] flex items-center gap-2">Data Validation Preview</h3>
              <p className="text-sm text-[var(--t3)] mt-1">
                Found <strong className="text-[var(--t1)]">{validatedRows.length}</strong> total rows.{" "}
                <span className="text-emerald-600 font-bold">
                  {validatedRows.filter((r) => r.isValid).length} ready
                </span>
                ,{" "}
                <span className="text-red-600 font-bold">{validatedRows.filter((r) => !r.isValid).length} invalid</span>
                .
              </p>
            </div>
            <button
              onClick={() => {
                setStep("upload");
                setValidatedRows([]);
              }}
              className="px-4 py-2 text-sm font-medium text-[var(--t2)] bg-[var(--surface-container)] hover:bg-[var(--border)] rounded-lg transition-colors border border-[var(--border)] shadow-sm"
            >
              Cancel & Upload New File
            </button>
          </div>

          <div
            className="border border-[var(--border)] rounded-xl overflow-hidden mb-6 shadow-sm"
            style={{ maxHeight: 400, overflowY: "auto" }}
          >
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-[var(--surface-container-low)] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[var(--t2)] w-12 text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-[var(--t2)]">Name</th>
                  <th className="px-4 py-3 font-semibold text-[var(--t2)]">Gender</th>
                  <th className="px-4 py-3 font-semibold text-[var(--t2)]">Parent Phone</th>
                  <th className="px-4 py-3 font-semibold text-[var(--t2)]">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-white">
                {validatedRows.slice(0, 50).map((row, i) => (
                  <tr key={i} className={row.isValid ? "hover:bg-slate-50" : "bg-red-50/50"}>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`material-symbols-outlined text-[18px] ${row.isValid ? "text-emerald-500" : "text-red-500"}`}
                      >
                        {row.isValid ? "check_circle" : "error"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--t1)]">
                      {row.data.first_name} {row.data.last_name || <span className="text-red-400 italic">Empty</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--t2)]">
                      {row.data.gender || <span className="text-red-400 italic">Empty</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--t2)] font-mono text-xs">
                      {row.data.parent_phone || <span className="text-[var(--t4)] italic">None</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.errors.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.errors.map((err, errIdx) => (
                            <span
                              key={errIdx}
                              className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-red-100 text-red-700 border border-red-200"
                            >
                              {err}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {validatedRows.length > 50 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-4 text-center text-[var(--t3)] italic bg-[var(--surface-container-low)]"
                    >
                      ... plus {validatedRows.length - 50} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-xl p-4 mb-6 text-sm flex gap-3">
            <span className="material-symbols-outlined text-blue-500 shrink-0">info</span>
            <p>
              Only valid records will be imported.{" "}
              <strong className="font-bold">{validatedRows.filter((r) => !r.isValid).length} invalid rows</strong> will
              be skipped entirely.
            </p>
          </div>

          <button
            onClick={handleImport}
            disabled={validatedRows.filter((r) => r.isValid).length === 0}
            className="w-full flex justify-center items-center gap-2 px-4 py-3.5 bg-[var(--primary)] text-white font-bold rounded-xl shadow-[var(--sh2)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span className="material-symbols-outlined">cloud_upload</span>
            Import {validatedRows.filter((r) => r.isValid).length} Valid Students
          </button>
        </div>
      )}

      {step === "importing" && (
        <div style={{ textAlign: "center", padding: 40 }}>
          {progress && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  height: 8,
                  background: "var(--border)",
                  borderRadius: 999,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round((progress.completed / Math.max(progress.total, 1)) * 100)}%`,
                    background: "var(--primary)",
                    transition: "width 0.3s",
                  }}
                />
              </div>
              <p style={{ fontSize: 13, color: "var(--t2)" }}>
                {progress.completed}/{progress.total} processed
                {progress.success > 0 ? `, ${progress.success} saved` : ""}
                {progress.skipped > 0 ? `, ${progress.skipped} already on file` : ""}
                {progress.failed > 0 ? `, ${progress.failed} failed` : ""}
              </p>
            </div>
          )}
          <div
            className="animate-spin"
            style={{
              width: 48,
              height: 48,
              border: "3px solid var(--border)",
              borderTopColor: "var(--navy)",
              borderRadius: "50%",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ fontSize: 16, color: "var(--t1)" }}>Importing students...</p>
        </div>
      )}

      {step === "complete" && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: result?.failed === 0 ? "var(--green-soft)" : "var(--amber-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 32,
                color: result?.failed === 0 ? "var(--green)" : "var(--amber)",
              }}
            >
              {result?.failed === 0 ? "check_circle" : "warning"}
            </span>
          </div>

          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--t1)",
              marginBottom: 8,
            }}
          >
            Import Complete
          </h3>

          <p style={{ fontSize: 14, color: "var(--t2)", marginBottom: 16 }}>
            {result?.success} students imported successfully
            {(result?.skipped ?? 0) > 0 && `, ${result?.skipped ?? 0} skipped because they are already on file`}
            {(result?.failed ?? 0) > 0 && `, ${result?.failed ?? 0} failed`}
          </p>

          {(result?.errors.length ?? 0) > 0 && (
            <div
              style={{
                maxHeight: 150,
                overflow: "auto",
                background: "var(--red-soft)",
                borderRadius: 8,
                padding: 12,
                textAlign: "left",
                marginBottom: 16,
              }}
            >
              {result?.errors.slice(0, 10).map((err: string, i: number) => (
                <p key={i} style={{ fontSize: 12, color: "var(--red)", marginBottom: 4 }}>
                  {err}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={onComplete}
            style={{
              padding: "12px 24px",
              background: "var(--navy)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
