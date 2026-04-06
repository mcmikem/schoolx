"use client";
import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card as UICard } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function ImportPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<
    "students" | "fees" | "grades" | "ai_paste"
  >("students");

  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawText, setRawText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const [preview, setPreview] = useState<any[]>([]);
  const [mappedData, setMappedData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setRawText("");

    try {
      const ExcelJS = (await import("exceljs")).default;
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("No worksheet found");

      const headers: string[] = [];
      const allStudents: any[] = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            headers[colNumber - 1] = String(cell.value);
          });
        } else {
          const obj: any = {};
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            obj[headers[colNumber - 1]] = cell.value;
          });
          allStudents.push(obj);
        }
      });

      const mapped = allStudents.map((row: any) => ({
        first_name: row["First Name"] || row["first_name"] || "",
        last_name: row["Last Name"] || row["last_name"] || "",
        gender: row["Gender"] || row["gender"] || "",
        date_of_birth:
          row["Date of Birth"] || row["date_of_birth"] || row["DOB"] || "",
        parent_name:
          row["Parent Name"] ||
          row["parent_name"] ||
          row["Parent/Guardian Name"] ||
          "",
        parent_phone:
          row["Parent Phone"] || row["parent_phone"] || row["Phone"] || "",
        parent_phone2:
          row["Parent Phone 2"] || row["parent_phone2"] || row["Phone 2"] || "",
        class_name: row["Class"] || row["class_name"] || "",
        student_number:
          row["Student Number"] || row["student_number"] || row["ID"] || "",
        ple_index_number:
          row["PLE Index"] || row["ple_index_number"] || row["PLE"] || "",
      }));

      setMappedData(mapped);
      setPreview(mapped.slice(0, 10));
    } catch (err) {
      toast.error("Failed to read file");
    }
  };

  const handleAIAnalysis = async () => {
    if (!rawText.trim()) {
      toast.error("Please paste some text first");
      return;
    }

    setAnalyzing(true);
    setResult(null);
    setFile(null);

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
      setMappedData(students);
      setPreview(students.slice(0, 10));
      toast.success(`Successfully extracted ${students.length} students`);
    } catch (error: any) {
      toast.error(error.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (mappedData.length === 0) return;

    setImporting(true);
    try {
      if (!user?.school_id) {
        throw new Error("No school associated with your account");
      }

      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students: mappedData,
          schoolId: user.school_id,
        }),
      });

      const importResult = await response.json();
      setResult(importResult);

      if (importResult.success > 0) {
        toast.success(`Imported ${importResult.success} students`);
      }
    } catch (error: any) {
      setResult({ success: 0, failed: 0, errors: [error.message] });
      toast.error(error.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Students");
    worksheet.columns = [
      { header: "First Name", key: "firstName", width: 15 },
      { header: "Last Name", key: "lastName", width: 15 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "Date of Birth", key: "dob", width: 15 },
      { header: "Parent Name", key: "parentName", width: 20 },
      { header: "Parent Phone", key: "parentPhone", width: 15 },
      { header: "Parent Phone 2", key: "parentPhone2", width: 15 },
      { header: "Class", key: "class", width: 10 },
      { header: "Student Number", key: "studentNumber", width: 15 },
      { header: "PLE Index", key: "pleIndex", width: 15 },
    ];
    worksheet.addRow({
      firstName: "Sarah",
      lastName: "Nakato",
      gender: "F",
      dob: "2015-03-15",
      parentName: "James Nakato",
      parentPhone: "0701234567",
      parentPhone2: "0702345678",
      class: "P.5",
      studentNumber: "",
      pleIndex: "",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SkulMateOS_Student_Template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Import Students"
        subtitle="Add students using AI smart paste or file upload"
      />

      <UICard className="mb-6 p-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => {
              setActiveTab("students");
              setPreview([]);
              setMappedData([]);
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "students"
                ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-md"
                : "text-[var(--t3)] hover:bg-[var(--surface-container)]"
            }`}
          >
            <MaterialIcon icon="group" className="text-lg" />
            Students
          </button>
          <button
            onClick={() => {
              setActiveTab("fees");
              setPreview([]);
              setMappedData([]);
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "fees"
                ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-md"
                : "text-[var(--t3)] hover:bg-[var(--surface-container)]"
            }`}
          >
            <MaterialIcon icon="payments" className="text-lg" />
            Fee Balances
          </button>
          <button
            onClick={() => {
              setActiveTab("grades");
              setPreview([]);
              setMappedData([]);
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "grades"
                ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-md"
                : "text-[var(--t3)] hover:bg-[var(--surface-container)]"
            }`}
          >
            <MaterialIcon icon="menu_book" className="text-lg" />
            Grades
          </button>
          <button
            onClick={() => {
              setActiveTab("ai_paste");
              setPreview([]);
              setMappedData([]);
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "ai_paste"
                ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-md"
                : "text-[var(--t3)] hover:bg-[var(--surface-container)]"
            }`}
          >
            <MaterialIcon icon="smart_toys" className="text-lg" />
            AI Smart Paste
          </button>
        </div>
      </UICard>

      {activeTab === "ai_paste" ? (
        <UICard className="mb-6 p-6">
          <div className="mb-4">
            <h2 className="font-semibold text-[var(--on-surface)] flex items-center gap-2">
              <MaterialIcon
                icon="auto_awesome"
                className="text-[var(--primary)]"
              />
              Paste Data Automatically
            </h2>
            <p className="text-sm text-[var(--t3)] mt-1">
              Copied a messy table from Excel, Word, or an email? Paste it here
              and our AI will automatically structure it into valid student
              records.
            </p>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full h-48 p-4 bg-[var(--surface-container)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none resize-none mb-4"
            placeholder="John Doe M P.3 0701234567\nJane Smith Female S.4 0771234567..."
          />
          <Button
            onClick={handleAIAnalysis}
            disabled={analyzing || !rawText.trim()}
            loading={analyzing}
          >
            <MaterialIcon icon="psychology" className="text-lg" />
            {analyzing ? "Analyzing with AI..." : "Analyze Data"}
          </Button>
        </UICard>
      ) : (
        <div className="space-y-6">
          <UICard className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-[var(--on-surface)]">
                  Download Template
                </h2>
                <p className="text-sm text-[var(--t3)] mt-1">
                  Use our template for best results when importing students
                </p>
              </div>
              <Button onClick={downloadTemplate} variant="secondary">
                <MaterialIcon icon="download" className="text-lg" />
                Template
              </Button>
            </div>
          </UICard>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="bg-[var(--surface)] rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] cursor-pointer transition-all p-8 text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="w-16 h-16 bg-[var(--navy-soft)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MaterialIcon
                icon="upload_file"
                className="text-3xl text-[var(--primary)]"
              />
            </div>
            <p className="text-[var(--on-surface)] font-medium mb-2">
              {file ? file.name : "Click to upload or drag and drop"}
            </p>
            <p className="text-sm text-[var(--t3)]">Excel or CSV file</p>
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <UICard className="mb-6 mt-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--on-surface)]">
              Review Data Preview
            </h2>
            <span className="px-3 py-1 bg-[var(--navy-soft)] text-[var(--navy)] text-sm font-medium rounded-lg">
              {mappedData.length} records ready
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--surface-container)]">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--on-surface)]">
                    First Name
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--on-surface)]">
                    Last Name
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--on-surface)]">
                    Gender
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--on-surface)]">
                    Class
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--on-surface)]">
                    Parent Phone
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row: any, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="p-3 font-medium text-[var(--on-surface)]">
                      {row.first_name || ""}
                    </td>
                    <td className="p-3 font-medium text-[var(--on-surface)]">
                      {row.last_name || ""}
                    </td>
                    <td className="p-3 text-[var(--t3)]">{row.gender || ""}</td>
                    <td className="p-3 text-[var(--t3)] font-medium">
                      {row.class_name || ""}
                    </td>
                    <td className="p-3 text-[var(--t3)]">
                      {row.parent_phone || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[var(--t3)] mt-4">
            Showing first {preview.length} of {mappedData.length} rows to
            import.
          </p>
        </UICard>
      )}

      {mappedData.length > 0 && (
        <Button
          onClick={handleImport}
          disabled={importing}
          loading={importing}
          className="w-full mb-6"
          size="lg"
        >
          <MaterialIcon icon="database" className="text-xl" />
          {importing
            ? "Saving to Database..."
            : `Confirm & Import ${mappedData.length} Students`}
        </Button>
      )}

      {result && (
        <UICard className="p-6">
          <h2 className="font-semibold text-[var(--on-surface)] mb-4">
            Import Results
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 bg-[var(--green-soft)] rounded-xl">
              <div className="text-2xl font-bold text-[var(--green)]">
                {result.success}
              </div>
              <div className="text-sm text-[var(--t3)]">Successful Inserts</div>
            </div>
            <div className="text-center p-4 bg-[var(--red-soft)] rounded-xl">
              <div className="text-2xl font-bold text-[var(--red)]">
                {result.failed}
              </div>
              <div className="text-sm text-[var(--t3)]">Failed Inserts</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="p-4 bg-[var(--red-soft)] rounded-xl">
              <p className="text-sm font-medium text-[var(--red)] mb-2">
                Errors details (check class names exist):
              </p>
              <ul className="text-sm text-[var(--t3)] space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </UICard>
      )}
    </div>
  );
}
