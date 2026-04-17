"use client";
import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useClasses } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

interface StudentRow {
  student_number?: string;
  first_name: string;
  last_name: string;
  gender: "M" | "F" | string;
  date_of_birth?: string;
  parent_name?: string;
  parent_phone?: string;
  class_id?: string;
  status?: string;
}

interface ValidatedRow {
  data: StudentRow;
  isValid: boolean;
  errors: string[];
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function BulkImport({ onComplete }: { onComplete: () => void }) {
  const { school } = useAuth();
  const { classes } = useClasses(school?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<
    "upload" | "preview" | "importing" | "complete"
  >("upload");
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [error, setError] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const parseCSV = (text: string): ValidatedRow[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2)
      throw new Error(
        "CSV file must have at least a header row and one data row",
      );

    const headers = lines[0]
      .toLowerCase()
      .split(",")
      .map((h) => h.trim().replace(/['"]/g, ""));
    const requiredFields = ["first_name", "last_name", "gender"];

    // Check if required headers even exist in the document
    const missingHeaders = requiredFields.filter((f) => !headers.includes(f));
    if (missingHeaders.length > 0) {
      throw new Error(
        `CSV is missing required columns: ${missingHeaders.join(", ")}`,
      );
    }

    const processedRows: ValidatedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Handle commas inside quotes properly (basic CSV parsing)
      const values = line
        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
      if (values.length === 0 || values.every((v) => !v)) continue;

      const student: any = {};
      headers.forEach((header, idx) => {
        student[header] = values[idx] || "";
      });

      const rowErrors: string[] = [];
      let isValid = true;

      // Validate required fields
      if (!student.first_name) {
        rowErrors.push("Missing first_name");
        isValid = false;
      }
      if (!student.last_name) {
        rowErrors.push("Missing last_name");
        isValid = false;
      }

      const rawGender = student.gender?.toString().toUpperCase();
      let normalizedGender = rawGender;
      if (!rawGender) {
        rowErrors.push("Missing gender");
        isValid = false;
      } else if (
        rawGender !== "M" &&
        rawGender !== "F" &&
        rawGender !== "MALE" &&
        rawGender !== "FEMALE"
      ) {
        rowErrors.push(`Invalid gender '${rawGender}'`);
        isValid = false;
      } else {
        normalizedGender = (
          rawGender === "MALE" ? "M" : rawGender === "FEMALE" ? "F" : rawGender
        ) as "M" | "F";
      }

      // Format mobile numbers to ensure they look okay (basic validation)
      let phone =
        student.parent_phone || student.guardian_phone || student.phone || "";
      if (phone && phone.length < 9) {
        rowErrors.push("Phone number looks too short");
        isValid = false;
      }

      processedRows.push({
        data: {
          student_number: student.student_number || "",
          first_name: student.first_name || "",
          last_name: student.last_name || "",
          gender: normalizedGender,
          date_of_birth: student.date_of_birth || student.dob || "",
          parent_name: student.parent_name || student.guardian_name || "",
          parent_phone: phone,
        },
        isValid,
        errors: rowErrors,
      });
    }

    if (processedRows.length === 0) {
      throw new Error("No valid data rows found in file.");
    }

    return processedRows;
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
    const isCurrentlyDemo =
      typeof window !== "undefined" &&
      localStorage.getItem("skoolmate_demo_v1") !== null;

    if (!school?.id || (!supabase && !isCurrentlyDemo)) {
      setError("Cannot import - no school or database connection");
      return;
    }

    setStep("importing");
    setError("");

    const results: ImportResult = { success: 0, failed: 0, errors: [] };
    const batchSize = 10; // Smaller batches for demo feel

    const validStudents = validatedRows
      .filter((r) => r.isValid)
      .map((r) => r.data);
    if (validStudents.length === 0) {
      setError("No valid rows to import.");
      setStep("preview");
      return;
    }

    if (isCurrentlyDemo) {
      // Simulate slow import
      await new Promise((r) => setTimeout(r, 1500));
      setResult({ success: validStudents.length, failed: 0, errors: [] });
      setStep("complete");
      return;
    }

    // Process in batches
    for (let i = 0; i < validStudents.length; i += batchSize) {
      const batch = validStudents.slice(i, i + batchSize).map((s) => ({
        school_id: school.id,
        student_number: s.student_number || `STD-${Date.now()}-${i}`,
        first_name: s.first_name,
        last_name: s.last_name,
        gender: s.gender,
        date_of_birth: s.date_of_birth || null,
        parent_name: s.parent_name || null,
        parent_phone: s.parent_phone || null,
        class_id: selectedClass || null,
        status: "active",
        admission_date: new Date().toISOString().split("T")[0],
      }));

      try {
        const { data, error: insertError } = await supabase
          .from("students")
          .insert(batch)
          .select();

        if (insertError) {
          results.failed += batch.length;
          results.errors.push(
            `Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`,
          );
        } else {
          results.success += data?.length || batch.length;
        }
      } catch (err: any) {
        results.failed += batch.length;
        results.errors.push(
          `Batch ${Math.floor(i / batchSize) + 1}: ${err.message}`,
        );
      }
    }

    setResult(results);
    setStep("complete");
  };

  const downloadTemplate = () => {
    const template = `student_number,first_name,last_name,gender,date_of_birth,parent_name,parent_phone
001,John,Doe,M,2015-01-15,Jane Doe,0700000001
002,Mary,Smith,F,2015-03-20,John Smith,0700000002
003,Peter,Jones,M,2014-07-10,Sarah Jones,0700000003`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
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
            <p style={{ fontSize: 13, color: "var(--t3)" }}>
              Or drag and drop your file here
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
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
        </div>
      )}

      {step === "preview" && (
        <div className="animate-fade-in">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-[var(--t1)] flex items-center gap-2">
                Data Validation Preview
              </h3>
              <p className="text-sm text-[var(--t3)] mt-1">
                Found{" "}
                <strong className="text-[var(--t1)]">
                  {validatedRows.length}
                </strong>{" "}
                total rows.{" "}
                <span className="text-emerald-600 font-bold">
                  {validatedRows.filter((r) => r.isValid).length} ready
                </span>
                ,{" "}
                <span className="text-red-600 font-bold">
                  {validatedRows.filter((r) => !r.isValid).length} invalid
                </span>
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
                  <th className="px-4 py-3 font-semibold text-[var(--t2)] w-12 text-center">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--t2)]">
                    Name
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--t2)]">
                    Gender
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--t2)]">
                    Parent Phone
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--t2)]">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-white">
                {validatedRows.slice(0, 50).map((row, i) => (
                  <tr
                    key={i}
                    className={
                      row.isValid ? "hover:bg-slate-50" : "bg-red-50/50"
                    }
                  >
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`material-symbols-outlined text-[18px] ${row.isValid ? "text-emerald-500" : "text-red-500"}`}
                      >
                        {row.isValid ? "check_circle" : "error"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--t1)]">
                      {row.data.first_name}{" "}
                      {row.data.last_name || (
                        <span className="text-red-400 italic">Empty</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--t2)]">
                      {row.data.gender || (
                        <span className="text-red-400 italic">Empty</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--t2)] font-mono text-xs">
                      {row.data.parent_phone || (
                        <span className="text-[var(--t4)] italic">None</span>
                      )}
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
            <span className="material-symbols-outlined text-blue-500 shrink-0">
              info
            </span>
            <p>
              Only valid records will be imported.{" "}
              <strong className="font-bold">
                {validatedRows.filter((r) => !r.isValid).length} invalid rows
              </strong>{" "}
              will be skipped entirely.
            </p>
          </div>

          <button
            onClick={handleImport}
            disabled={validatedRows.filter((r) => r.isValid).length === 0}
            className="w-full flex justify-center items-center gap-2 px-4 py-3.5 bg-[var(--primary)] text-white font-bold rounded-xl shadow-[var(--sh2)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span className="material-symbols-outlined">cloud_upload</span>
            Import {validatedRows.filter((r) => r.isValid).length} Valid
            Students
          </button>
        </div>
      )}

      {step === "importing" && (
        <div style={{ textAlign: "center", padding: 40 }}>
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
          <p style={{ fontSize: 16, color: "var(--t1)" }}>
            Importing students...
          </p>
        </div>
      )}

      {step === "complete" && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background:
                result?.failed === 0
                  ? "var(--green-soft)"
                  : "var(--amber-soft)",
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
            {(result?.failed ?? 0) > 0 && `, ${result?.failed} failed`}
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
                <p
                  key={i}
                  style={{ fontSize: 12, color: "var(--red)", marginBottom: 4 }}
                >
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
