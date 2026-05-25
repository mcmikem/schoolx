"use client";

import { useEffect, useState, type ChangeEvent, type MutableRefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import OnboardingTips from "@/components/OnboardingTips";
import MaterialIcon from "@/components/MaterialIcon";
import { TableSkeleton } from "@/components/ui/Skeleton";
import PersonInitials from "@/components/ui/PersonInitials";
import { EmptyState } from "@/components/EmptyState";

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
  house_id?: string | null;
  is_class_monitor?: boolean | null;
  prefect_role?: string | null;
  student_council_role?: string | null;
}

interface HouseMeta {
  id: string;
  name: string;
  color?: string | null;
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
  errors: string[];
}

interface ImportProgress {
  completed: number;
  total: number;
  success: number;
  failed: number;
}

interface AttendanceStatusMeta {
  status: "present" | "absent" | "sick" | "late" | "excused";
  label: string;
}

interface StudentRegistryPanelProps {
  schoolId?: string;
  lowBandwidthMode: boolean;
  totalStudents: number;
  boysCount: number;
  girlsCount: number;
  classesCount: number;
  classes: ClassOption[];
  houseMap: Record<string, HouseMeta>;
  templateStatus: "idle" | "parsing" | "ready";
  templateErrors: string | null;
  templateRowsCount: number;
  templatePreviewRows: Record<string, string>[];
  importingTemplate: boolean;
  importSummary: ImportSummary | null;
  importProgress?: ImportProgress | null;
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
  attendanceStatusMap: Record<string, AttendanceStatusMeta>;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onAddStudent: () => void;
  onSmsParent: (student: StudentRow) => void;
  onEditStudent: (student: StudentRow) => void;
  onDeleteStudent: (studentId: string) => void;
}

export default function StudentRegistryPanel({
  schoolId,
  lowBandwidthMode,
  totalStudents,
  boysCount,
  girlsCount,
  classesCount,
  classes,
  houseMap,
  templateStatus,
  templateErrors,
  templateRowsCount,
  templatePreviewRows,
  importingTemplate,
  importSummary,
  importProgress,
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
  attendanceStatusMap,
  onPreviousPage,
  onNextPage,
  onAddStudent,
  onSmsParent,
  onEditStudent,
  onDeleteStudent,
}: StudentRegistryPanelProps) {
  const showPhotos = !lowBandwidthMode;
  const [showQuickImport, setShowQuickImport] = useState(false);

  useEffect(() => {
    if (totalStudents === 0) {
      setShowQuickImport(true);
    }
  }, [totalStudents]);

  const resolveHouse = (student: StudentRow) => {
    if (student.house_id && houseMap[student.house_id]) {
      return houseMap[student.house_id];
    }

    const gamesHouseKey = (student as { games_house?: string | null }).games_house;
    if (gamesHouseKey && houseMap[gamesHouseKey]) {
      return houseMap[gamesHouseKey];
    }

    if (gamesHouseKey) {
      const byName = Object.values(houseMap).find(
        (house) => house.name.toLowerCase() === gamesHouseKey.toLowerCase(),
      );
      if (byName) {
        return byName;
      }
    }

    return null;
  };

  const resolveClassLabel = (student: StudentRow) => {
    if (student.classes?.name) {
      return student.classes.stream
        ? `${student.classes.name} ${student.classes.stream}`
        : student.classes.name;
    }

    const classFromId = classes.find((classItem) => classItem.id === student.class_id);
    if (classFromId) {
      return classFromId.stream
        ? `${classFromId.name} ${classFromId.stream}`
        : classFromId.name;
    }

    return "-";
  };

  const getHouseColor = (house: HouseMeta | null) => {
    if (!house?.color) return "#64748b";
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(house.color)
      ? house.color
      : "#64748b";
  };

  const shouldForceShowQuickImport =
    totalStudents === 0 ||
    templateStatus === "parsing" ||
    templateStatus === "ready" ||
    importingTemplate ||
    !!importSummary ||
    !!templateErrors;

  const leadershipLabel = (student: StudentRow) => {
    if (student.prefect_role) return student.prefect_role;
    if (student.student_council_role) return student.student_council_role;
    if (student.is_class_monitor) return "Class monitor";
    return null;
  };

  const attendanceTone = (status?: AttendanceStatusMeta["status"]) => {
    switch (status) {
      case "present":
        return "#16a34a";
      case "sick":
        return "#f97316";
      case "late":
        return "#eab308";
      case "excused":
        return "#2563eb";
      case "absent":
        return "#dc2626";
      default:
        return "#94a3b8";
    }
  };

  return (
    <>
      {totalStudents === 0 && <OnboardingTips schoolId={schoolId} />}

      <div className="dashboard-surface p-5 sm:p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--navy)] mb-2">
              Quick import
            </div>
            <p className="text-sm text-[var(--t3)] max-w-2xl">
              Keep this closed until you need bulk import. Templates, upload,
              and preview stay one tap away.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowQuickImport((value) => !value)}
            aria-expanded={showQuickImport || shouldForceShowQuickImport}
          >
            {showQuickImport || shouldForceShowQuickImport ? "Hide import tools" : "Open import tools"}
          </button>
        </div>
        {lowBandwidthMode && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--amber-soft)] px-3 py-1 text-xs font-semibold text-[var(--amber)]">
            <MaterialIcon icon="network_check" className="text-sm" />
            Data saver mode enabled for slower connections
          </div>
        )}
        {(showQuickImport || shouldForceShowQuickImport) && (
          <div className="grid gap-4 md:grid-cols-2 mt-6">
          <div className="space-y-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)]/60 p-4">
            <div className="text-sm font-semibold text-[var(--t1)]">
              Upload student list
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onTemplateUpload}
              className="w-full text-sm text-slate-600"
              disabled={templateStatus === "parsing"}
            />
            <p className="text-xs text-[var(--t3)]">
              We auto-map Excel columns using simple heuristics; add headers
              exactly as shown.
            </p>
            {templateStatus === "parsing" && (
              <p className="text-xs text-[var(--green)]">Parsing file...</p>
            )}
            {templateErrors && (
              <p className="text-xs text-[var(--amber)]">{templateErrors}</p>
            )}
            {templateStatus === "ready" && (
              <button
                onClick={onSeedTemplate}
                className="btn btn-primary btn-sm"
                disabled={importingTemplate}
              >
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
                    width: `${((importProgress?.completed || 0) / Math.max(importProgress?.total || templateRowsCount, 1)) * 100}%`,
                  }}
                />
              </div>
            )}
            {(importProgress || importSummary) && (
              <div className="mt-2 text-xs text-[var(--t3)]">
                {importingTemplate && importProgress ? (
                  <>
                    Imported {importProgress.completed}/{importProgress.total} rows
                    {importProgress.success > 0 ? `, ${importProgress.success} saved` : ""}
                    {importProgress.failed > 0 ? `, ${importProgress.failed} failed` : ""}
                  </>
                ) : importSummary ? (
                  <>
                    Import complete: {importSummary.success} saved, {importSummary.failed} failed
                  </>
                ) : null}
              </div>
            )}
            {importSummary?.errors?.length ? (
              <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/80 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--t3)] mb-2">
                  Import issues
                </div>
                <ul className="space-y-1 text-xs text-[var(--t2)]">
                  {importSummary.errors.slice(0, 5).map((error, index) => (
                    <li key={`${error}-${index}`}>• {error}</li>
                  ))}
                  {importSummary.errors.length > 5 && (
                    <li>• {importSummary.errors.length - 5} more issue(s) were hidden</li>
                  )}
                </ul>
              </div>
            ) : null}
            {filteredTotal === 0 ? (
              <div className="p-8 text-center">
                <EmptyState
                  icon="people"
                  title="No students found"
                  description={
                    searchTerm
                      ? `No students matching "${searchTerm}"`
                      : "Start by adding students to your school."
                  }
                  action={{ label: "Add Student", onClick: onAddStudent }}
                />
              </div>
            ) : (
              <div className="tbl-wrap table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th data-label="Student">Student</th>
                      <th data-label="Number">Number</th>
                      <th data-label="Class">Class</th>
                      <th data-label="House">House</th>
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
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              textDecoration: "none",
                            }}
                          >
                            <div>
                              {student.photo_url && showPhotos ? (
                                <Image
                                  src={student.photo_url}
                                  alt={`${student.first_name} ${student.last_name}`}
                                  width={36}
                                  height={36}
                                  unoptimized
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                <PersonInitials
                                  name={`${student.first_name} ${student.last_name}`}
                                  size={36}
                                />
                              )}
                            </div>
                            <div>
                              <div
                                style={{ fontWeight: 600, color: "var(--t1)" }}
                              >
                                {student.first_name} {student.last_name}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--t3)" }}>
                                {student.gender === "M" ? "Male" : "Female"}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td data-label="Number">
                          {student.student_number || "-"}
                        </td>
                        <td data-label="Class">
                          {student.classes?.name || "-"}
                        </td>
                        <td data-label="House">
                          {(() => {
                            const house = resolveHouse(student);
                            if (!house) return "-";
                            return (
                              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs font-semibold text-[var(--t1)]">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: getHouseColor(house) }}
                                />
                                {house.name}
                              </span>
                            );
                          })()}
                        </td>
                        <td data-label="Parent">
                          {student.parent_name || "-"}
                        </td>
                        <td data-label="Phone">
                          {student.parent_phone || "-"}
                        </td>
                        <td data-label="Actions">
                          <Link
                            href={`/dashboard/students/${student.id}`}
                            className="btn btn-ghost btn-sm"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pageSize !== -1 && filteredTotal > pageSize && (
                  <div className="flex items-center justify-between p-4 border-t border-[var(--border)]">
                    <span style={{ fontSize: 12, color: "var(--t3)" }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={onPreviousPage}
                        disabled={currentPage === 1}
                        className="btn btn-ghost btn-sm"
                      >
                        Previous
                      </button>
                      <button
                        onClick={onNextPage}
                        disabled={currentPage >= totalPages}
                        className="btn btn-ghost btn-sm"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--navy-soft)] p-4 space-y-3">
            <div className="text-sm font-semibold text-[var(--t1)]">
              Preview & AI hints
            </div>
            {templatePreviewRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {Object.keys(templatePreviewRows[0]).map((col) => (
                        <th
                          key={col}
                          className="px-2 py-1 text-left text-[11px] uppercase tracking-[0.2em] text-[var(--t3)]"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {templatePreviewRows.map((row, index) => (
                      <tr
                        key={index}
                        className="border-t border-[var(--border)]"
                      >
                        {Object.values(row).map((value, idx) => (
                          <td
                            key={`${index}-${idx}`}
                            className="px-2 py-1 truncate max-w-[120px]"
                          >
                            {value || "\u2014"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[var(--t3)]">
                Upload a file to preview the parsed rows.
              </p>
            )}
          </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        <div className="card p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--navy-soft)] flex items-center justify-center">
              <MaterialIcon style={{ fontSize: 18, color: "var(--navy)" }}>
                group
              </MaterialIcon>
            </div>
            <span className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--t3)]">
              Total
            </span>
          </div>
          <div
            style={{
              fontFamily: "Sora",
              fontSize: 28,
              fontWeight: 800,
              color: "var(--navy)",
            }}
          >
            {totalStudents}
          </div>
        </div>
        <div className="card p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-[rgba(23,50,95,.1)] flex items-center justify-center">
              <MaterialIcon style={{ fontSize: 18, color: "var(--navy)" }}>
                male
              </MaterialIcon>
            </div>
            <span className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--t3)]">
              Boys
            </span>
          </div>
          <div
            style={{
              fontFamily: "Sora",
              fontSize: 28,
              fontWeight: 800,
              color: "var(--navy)",
            }}
          >
            {boysCount}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-[rgba(192,57,43,.1)] flex items-center justify-center">
              <MaterialIcon style={{ fontSize: 18, color: "var(--red)" }}>
                female
              </MaterialIcon>
            </div>
            <span className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--t3)]">
              Girls
            </span>
          </div>
          <div
            style={{
              fontFamily: "Sora",
              fontSize: 28,
              fontWeight: 800,
              color: "var(--navy)",
            }}
          >
            {girlsCount}
          </div>
        </div>
        <div className="card p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--green-soft)] flex items-center justify-center">
              <MaterialIcon style={{ fontSize: 18, color: "var(--green)" }}>
                school
              </MaterialIcon>
            </div>
            <span className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--t3)]">
              Classes
            </span>
          </div>
          <div
            style={{
              fontFamily: "Sora",
              fontSize: 28,
              fontWeight: 800,
              color: "var(--navy)",
            }}
          >
            {classesCount}
          </div>
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
            onChange={(e) =>
              onFilterGenderChange(e.target.value as "all" | "M" | "F")
            }
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
            <input
              type="checkbox"
              checked={filterDefaulters}
              onChange={(e) => onFilterDefaultersChange(e.target.checked)}
            />
            Defaulters
          </label>
          <select
            value={sortBy}
            onChange={(e) =>
              onSortByChange(e.target.value as "name" | "number" | "class")
            }
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
            <option value={-1}>All students</option>
          </select>
          <div className="ml-auto text-xs font-semibold text-[var(--t3)]">
            Showing {paginatedStudents.length} of {filteredTotal} students
          </div>
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
              <MaterialIcon style={{ fontSize: 24, color: "var(--t3)" }}>
                group
              </MaterialIcon>
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--t1)",
                marginBottom: 4,
              }}
            >
              No students found
            </div>
            <div style={{ fontSize: 12, color: "var(--t3)" }}>
              {searchTerm
                ? "Try a different search term"
                : "Add your first student to get started"}
            </div>
            {!searchTerm && (
              <button
                onClick={onAddStudent}
                className="btn btn-primary"
                style={{ marginTop: 16 }}
              >
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
                  <th data-label="House">House</th>
                  <th data-label="Parent">Parent</th>
                  <th data-label="Phone">Phone</th>
                  <th data-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => {
                  const house = resolveHouse(student);
                  const statusMeta = attendanceStatusMap[student.id];
                  const leader = leadershipLabel(student);

                  return (
                    <tr key={student.id}>
                      <td data-label="Student">
                        <Link
                          href={`/dashboard/students/${student.id}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textDecoration: "none",
                          }}
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
                              position: "relative",
                              background:
                                student.gender === "M"
                                  ? "var(--navy)"
                                  : "var(--red)",
                            }}
                          >
                            {student.photo_url && showPhotos ? (
                              <Image
                                src={student.photo_url}
                                alt={`${student.first_name} ${student.last_name}`}
                                width={36}
                                height={36}
                                unoptimized
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <PersonInitials
                                name={`${student.first_name} ${student.last_name}`}
                                size={36}
                              />
                            )}
                            <span
                              title={statusMeta?.label || "No attendance recorded today"}
                              aria-label={statusMeta?.label || "No attendance recorded today"}
                              style={{
                                position: "absolute",
                                right: 0,
                                bottom: 0,
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                border: "2px solid var(--surface)",
                                backgroundColor: attendanceTone(statusMeta?.status),
                                boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
                              }}
                            />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div style={{ fontWeight: 600, color: "var(--t1)" }}>
                                {student.first_name} {student.last_name}
                              </div>
                              {leader ? (
                                <span
                                  className="inline-flex items-center rounded-full bg-[var(--navy-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--navy)]"
                                  title={leader}
                                >
                                  {student.is_class_monitor && !student.prefect_role && !student.student_council_role
                                    ? "Monitor"
                                    : "Leader"}
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--t3)" }}>
                              {student.gender === "M" ? "Male" : "Female"}
                              {statusMeta ? ` • ${statusMeta.label}` : ""}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td
                        data-label="Number"
                        style={{ fontFamily: "DM Mono", fontSize: 12 }}
                      >
                        {student.student_number || "-"}
                      </td>
                      <td data-label="Class">
                        <span
                          style={{
                            padding: "4px 10px",
                            background: "var(--bg)",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--t1)",
                          }}
                        >
                          {resolveClassLabel(student)}
                          {student.boarding_status &&
                            student.boarding_status !== "day" && (
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
                      <td data-label="House">
                        {house ? (
                          <span
                            className="inline-flex h-3.5 w-3.5 rounded-full border border-white/60 shadow-sm"
                            title={house.name}
                            aria-label={`House: ${house.name}`}
                          >
                            <span
                              className="h-full w-full rounded-full"
                              style={{ backgroundColor: getHouseColor(house) }}
                            />
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td data-label="Parent" style={{ fontSize: 13 }}>
                        {student.parent_name || "-"}
                      </td>
                      <td
                        data-label="Phone"
                        style={{ fontSize: 13, fontFamily: "DM Mono" }}
                      >
                        {student.parent_phone || "-"}
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => onSmsParent(student)}
                            title="SMS Parent"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 6,
                              borderRadius: 6,
                            }}
                          >
                            <MaterialIcon
                              style={{ fontSize: 16, color: "var(--t3)" }}
                            >
                              sms
                            </MaterialIcon>
                          </button>
                          <button
                            onClick={() => onEditStudent(student)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 6,
                              borderRadius: 6,
                            }}
                          >
                            <MaterialIcon
                              style={{ fontSize: 16, color: "var(--t3)" }}
                            >
                              edit
                            </MaterialIcon>
                          </button>
                          <button
                            onClick={() => onDeleteStudent(student.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 6,
                              borderRadius: 6,
                            }}
                          >
                            <MaterialIcon
                              style={{ fontSize: 16, color: "var(--t3)" }}
                            >
                              delete
                            </MaterialIcon>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pageSize !== -1 && filteredCount > pageSize && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]"
            style={{ fontSize: 13 }}
          >
            <span className="text-[var(--t3)]">
              Showing{" "}
              {Math.min((currentPage - 1) * pageSize + 1, filteredTotal)}-
              {Math.min(currentPage * pageSize, filteredTotal)} of{" "}
              {filteredTotal} students
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onPreviousPage}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--t2)] text-xs disabled:opacity-40 hover:bg-[var(--bg)] transition-colors"
              >
                Previous
              </button>
              <span className="text-[var(--t2)] text-xs font-medium">
                Page {currentPage} / {totalPages}
              </span>
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
