"use client";

import type { ChangeEvent, MutableRefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import OnboardingTips from "@/components/OnboardingTips";
import MaterialIcon from "@/components/MaterialIcon";
import { TableSkeleton } from "@/components/ui/Skeleton";
import PersonInitials from "@/components/ui/PersonInitials";

interface StudentClassInfo {
  id: string;
  name: string;
  stream?: string | null;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  gender: "M" | "F" | string;
  class_id: string;
  student_number?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  opening_balance?: string | number | null;
  photo_url?: string | null;
  classes?: {
    name?: string | null;
    stream?: string | null;
  } | null;
  boarding_status?: string | null;
}

interface ClassOption {
  id: string;
  name: string;
  stream?: string | null;
}

interface ImportSummary {
  success: number;
  failed: number;
  total: number;
}

interface StudentRegistryPanelProps {
  schoolId?: string;
  totalStudents: number;
  boysCount: number;
  girlsCount: number;
  classesCount: number;
  classes: ClassOption[];
  templateStatus: "idle" | "parsing" | "ready";
  templateErrors: string | null;
  templateRowsCount: number;
  templatePreviewRows: Record<string, string>[];
  importingTemplate: boolean;
  importSummary: ImportSummary | null;
  onTemplateUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onSeedTemplate: () => void;
  searchInputRef: MutableRefObject<HTMLInputElement | null>;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  selectedClass: string;
  onSelectedClassChange: (value: string) => void;
  filterGender: "all" | "M" | "F";
  onFilterGenderChange: (value: "all" | "M" | "F") => void;
  filterPosition: string;
  onFilterPositionChange: (value: string) => void;
  filterDefaulters: boolean;
  onFilterDefaultersChange: (value: boolean) => void;
  sortBy: "name" | "number" | "class";
  onSortByChange: (value: "name" | "number" | "class") => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  loading: boolean;
  filteredCount: number;
  filteredTotal: number;
  paginatedStudents: StudentRow[];
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onAddStudent: () => void;
  onSmsParent: (student: StudentRow) => void;
  onEditStudent: (student: StudentRow) => void;
  onDeleteStudent: (studentId: string) => void;
}

export default function StudentRegistryPanel({
  schoolId,
  totalStudents,
  boysCount,
  girlsCount,
  classesCount,
  classes,
  templateStatus,
  templateErrors,
  templateRowsCount,
  templatePreviewRows,
  importingTemplate,
  importSummary,
  onTemplateUpload,
  onSeedTemplate,
  searchInputRef,
  searchTerm,
  onSearchTermChange,
  selectedClass,
  onSelectedClassChange,
  filterGender,
  onFilterGenderChange,
  filterPosition,
  onFilterPositionChange,
  filterDefaulters,
  onFilterDefaultersChange,
  sortBy,
  onSortByChange,
  pageSize,
  onPageSizeChange,
  loading,
  filteredCount,
  filteredTotal,
  paginatedStudents,
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
  onAddStudent,
  onSmsParent,
  onEditStudent,
  onDeleteStudent,
}: StudentRegistryPanelProps) {
  return (
    <>
      {totalStudents === 0 && <OnboardingTips schoolId={schoolId} />}

      <div className="dashboard-surface p-5 sm:p-6 mb-5">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--navy)] mb-2">
          Quick import
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-[var(--t3)]">
          <p className="flex-1 min-w-[220px]">
            Download the structured templates, drop your data, and we&apos;ll auto-map columns to fields. Preview before confirming.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="/templates/classes-template.csv" download target="_blank" className="btn btn-ghost btn-sm">
              Class template
            </a>
            <a href="/templates/staff-template.csv" download target="_blank" className="btn btn-ghost btn-sm">
              Staff template
            </a>
            <a href="/templates/students-template.csv" download target="_blank" className="btn btn-ghost btn-sm">
              Student template
            </a>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <div className="space-y-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)]/60 p-4">
            <div className="text-sm font-semibold text-[var(--t1)]">Upload student list</div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onTemplateUpload}
              className="w-full text-sm text-slate-600"
              disabled={templateStatus === "parsing"}
            />
            <p className="text-xs text-[var(--t3)]">
              We auto-map Excel columns using simple heuristics; add headers exactly as shown.
            </p>
            {templateStatus === "parsing" && <p className="text-xs text-[var(--green)]">Parsing file...</p>}
            {templateErrors && <p className="text-xs text-[var(--amber)]">{templateErrors}</p>}
            {templateStatus === "ready" && (
              <button onClick={onSeedTemplate} className="btn btn-primary btn-sm" disabled={importingTemplate}>
                {importingTemplate ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Seeding {templateRowsCount} students...
                  </span>
                ) : (
                  "Seed students from template"
                )}
              </button>
            )}
            {importingTemplate && (
              <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[var(--primary)] h-full transition-all duration-300"
                  style={{
                    width: `${((importSummary?.success || 0) / Math.max(templateRowsCount, 1)) * 100}%`,
                  }}
                />
              </div>
            )}
            {importSummary && (
              <p className="text-xs text-[var(--navy)]">
                Imported {importSummary.success}/{importSummary.total} students ({importSummary.failed} failed).
              </p>
            )}
          </div>
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--navy-soft)] p-4 space-y-3">
            <div className="text-sm font-semibold text-[var(--t1)]">Preview & AI hints</div>
            {templatePreviewRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {Object.keys(templatePreviewRows[0]).map((col) => (
                        <th key={col} className="px-2 py-1 text-left text-[11px] uppercase tracking-[0.2em] text-[var(--t3)]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {templatePreviewRows.map((row, index) => (
                      <tr key={index} className="border-t border-[var(--border)]">
                        {Object.values(row).map((value, idx) => (
                          <td key={`${index}-${idx}`} className="px-2 py-1 truncate max-w-[120px]">
                            {value || "\u2014"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[var(--t3)]">Upload a file to preview the parsed rows.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        <div className="card p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--navy-soft)] flex items-center justify-center">
              <MaterialIcon style={{ fontSize: 18, color: "var(--navy)" }}>group</MaterialIcon>
            </div>
            <span className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--t3)]">Total</span>
          </div>
          <div style={{ fontFamily: "Sora", fontSize: 28, fontWeight: 800, color: "var(--navy)" }}>{totalStudents}</div>
        </div>
        <div className="card p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-[rgba(23,50,95,.1)] flex items-center justify-center">
              <MaterialIcon style={{ fontSize: 18, color: "var(--navy)" }}>male</MaterialIcon>
            </div>
            <span className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--t3)]">Boys</span>
          </div>
          <div style={{ fontFamily: "Sora", fontSize: 28, fontWeight: 800, color: "var(--navy)" }}>{boysCount}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-[rgba(192,57,43,.1)] flex items-center justify-center">
              <MaterialIcon style={{ fontSize: 18, color: "var(--red)" }}>female</MaterialIcon>
            </div>
            <span className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--t3)]">Girls</span>
          </div>
          <div style={{ fontFamily: "Sora", fontSize: 28, fontWeight: 800, color: "var(--navy)" }}>{girlsCount}</div>
        </div>
        <div className="card p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--green-soft)] flex items-center justify-center">
              <MaterialIcon style={{ fontSize: 18, color: "var(--green)" }}>school</MaterialIcon>
            </div>
            <span className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--t3)]">Classes</span>
          </div>
          <div style={{ fontFamily: "Sora", fontSize: 28, fontWeight: 800, color: "var(--navy)" }}>{classesCount}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <MaterialIcon
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 16,
                color: "var(--t3)",
              }}
            >
              search
            </MaterialIcon>
            <input
              type="text"
              ref={searchInputRef}
              placeholder="Search by name, parent, or student number..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px 10px 38px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
                background: "var(--bg)",
                color: "var(--t1)",
              }}
            />
          </div>
          <select
            value={selectedClass}
            onChange={(e) => onSelectedClassChange(e.target.value)}
            style={{
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "var(--surface)",
              color: "var(--t1)",
              minWidth: 140,
              cursor: "pointer",
            }}
          >
            <option value="all">All Classes</option>
            {classes.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name}
                {classItem.stream ? ` ${classItem.stream}` : ""}
              </option>
            ))}
          </select>
          <select
            value={filterGender}
            onChange={(e) => onFilterGenderChange(e.target.value as "all" | "M" | "F")}
            style={{
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "var(--surface)",
              color: "var(--t1)",
              cursor: "pointer",
            }}
          >
            <option value="all">All Genders</option>
            <option value="M">Boys only</option>
            <option value="F">Girls only</option>
          </select>
          <select
            value={filterPosition}
            onChange={(e) => onFilterPositionChange(e.target.value)}
            style={{
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "var(--surface)",
              color: "var(--t1)",
              cursor: "pointer",
            }}
          >
            <option value="all">All Positions</option>
            <option value="monitor">Class Monitors</option>
            <option value="prefect">Prefects</option>
          </select>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--t1)",
            }}
          >
            <input type="checkbox" checked={filterDefaulters} onChange={(e) => onFilterDefaultersChange(e.target.checked)} />
            Defaulters
          </label>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as "name" | "number" | "class")}
            style={{
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "var(--surface)",
              color: "var(--t1)",
              cursor: "pointer",
            }}
          >
            <option value="name">Sort by Name</option>
            <option value="number">Sort by Number</option>
            <option value="class">Sort by Class</option>
          </select>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
            style={{
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "var(--surface)",
              color: "var(--t1)",
              cursor: "pointer",
            }}
          >
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>

        {loading ? (
          <TableSkeleton rows={8} />
        ) : filteredCount === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "var(--bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
              }}
            >
              <MaterialIcon style={{ fontSize: 24, color: "var(--t3)" }}>group</MaterialIcon>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>
              No students found
            </div>
            <div style={{ fontSize: 12, color: "var(--t3)" }}>
              {searchTerm ? "Try a different search term" : "Add your first student to get started"}
            </div>
            {!searchTerm && (
              <button onClick={onAddStudent} className="btn btn-primary" style={{ marginTop: 16 }}>
                <MaterialIcon icon="person_add" style={{ fontSize: "16px" }} />
                Add Student
              </button>
            )}
          </div>
        ) : (
          <div className="tbl-wrap table-responsive">
            <table>
              <thead>
                <tr>
                  <th data-label="Student">Student</th>
                  <th data-label="Number">Number</th>
                  <th data-label="Class">Class</th>
                  <th data-label="Parent">Parent</th>
                  <th data-label="Phone">Phone</th>
                  <th data-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => (
                  <tr key={student.id}>
                    <td data-label="Student">
                      <Link
                        href={`/dashboard/students/${student.id}`}
                        style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#fff",
                            overflow: "hidden",
                            background: student.gender === "M" ? "var(--navy)" : "var(--red)",
                          }}
                        >
                          {student.photo_url ? (
                            <Image
                              src={student.photo_url}
                              alt={`${student.first_name} ${student.last_name}`}
                              width={36}
                              height={36}
                              unoptimized
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <PersonInitials name={`${student.first_name} ${student.last_name}`} size={36} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--t1)" }}>
                            {student.first_name} {student.last_name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--t3)" }}>
                            {student.gender === "M" ? "Male" : "Female"}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td data-label="Number" style={{ fontFamily: "DM Mono", fontSize: 12 }}>
                      {student.student_number || "-"}
                    </td>
                    <td data-label="Class">
                      <span
                        style={{
                          padding: "4px 10px",
                          background: "var(--bg)",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {student.classes?.name}
                        {student.classes?.stream ? ` ${student.classes.stream}` : ""}
                        {student.boarding_status && student.boarding_status !== "day" && (
                          <span
                            style={{
                              marginLeft: 4,
                              fontSize: 9,
                              padding: "1px 5px",
                              background: "rgba(155,89,182,0.15)",
                              color: "#0d9488",
                              borderRadius: 8,
                              fontWeight: 600,
                            }}
                          >
                            {student.boarding_status}
                          </span>
                        )}
                      </span>
                    </td>
                    <td data-label="Parent" style={{ fontSize: 13 }}>
                      {student.parent_name || "-"}
                    </td>
                    <td data-label="Phone" style={{ fontSize: 13, fontFamily: "DM Mono" }}>
                      {student.parent_phone || "-"}
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => onSmsParent(student)}
                          title="SMS Parent"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6 }}
                        >
                          <MaterialIcon style={{ fontSize: 16, color: "var(--t3)" }}>sms</MaterialIcon>
                        </button>
                        <button
                          onClick={() => onEditStudent(student)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6 }}
                        >
                          <MaterialIcon style={{ fontSize: 16, color: "var(--t3)" }}>edit</MaterialIcon>
                        </button>
                        <button
                          onClick={() => onDeleteStudent(student.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6 }}
                        >
                          <MaterialIcon style={{ fontSize: 16, color: "var(--t3)" }}>delete</MaterialIcon>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredCount > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]" style={{ fontSize: 13 }}>
            <span className="text-[var(--t3)]">
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredTotal)}-
              {Math.min(currentPage * pageSize, filteredTotal)} of {filteredTotal} students
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onPreviousPage}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--t2)] text-xs disabled:opacity-40 hover:bg-[var(--bg)] transition-colors"
              >
                Previous
              </button>
              <span className="text-[var(--t2)] text-xs font-medium">Page {currentPage} / {totalPages}</span>
              <button
                onClick={onNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--t2)] text-xs disabled:opacity-40 hover:bg-[var(--bg)] transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}