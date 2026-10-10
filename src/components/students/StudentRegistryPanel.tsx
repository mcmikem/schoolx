"use client";

import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, type MutableRefObject, useCallback, useEffect, useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import OnboardingTips from "@/components/OnboardingTips";
import PersonInitials from "@/components/ui/PersonInitials";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { buildStudentTemplateCsv } from "@/lib/import/students";

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
  /** Rows the school already had on file, skipped instead of duplicated. */
  skipped: number;
  total: number;
  errors: string[];
}

interface ImportProgress {
  completed: number;
  total: number;
  success: number;
  failed: number;
  skipped?: number;
}

interface AttendanceStatusMeta {
  status: "present" | "absent" | "sick" | "late" | "excused";
  label: string;
}

/**
 * Column order of the generated template.
 *
 * These are the canonical headers, chosen so the same file works whether it is
 * fed back through this importer or through /dashboard/import: both resolve the
 * same header names, so one template serves both screens.
 */
/**
 * One column per field the registration form accepts.
 *
 * Anything omitted here is a field a headteacher has to retype one learner at a
 * time, so the template mirrors the form rather than the minimum needed to
 * insert a row. Leave a column out of a class and it imports blank.
 *
 * The list itself lives in @/lib/import/students so the import page's Excel and
 * Word templates cannot drift from this one.
 */

interface StudentRegistryPanelProps {
  schoolId?: string;
  lowBandwidthMode: boolean;
  totalStudents: number;
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
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
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
  /** False for class-scoped roles: the registry is read-only for them (RLS
   * already refuses the writes; this just stops offering the buttons). */
  canManage?: boolean;
}

export default function StudentRegistryPanel({
  schoolId,
  lowBandwidthMode,
  totalStudents,
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
  filterStatus,
  onFilterStatusChange,
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
  canManage = true,
}: StudentRegistryPanelProps) {
  // Data saver is right about the cost — 500 passport photos is real 3G
  // traffic — but it used to be a silent swap: the avatar turned into initials
  // and the only clue was a banner further down the toolbar. The toggle hands
  // the decision back to the person looking at the list.
  const [showPhotosOverride, setShowPhotosOverride] = useState<boolean | null>(null);
  const showPhotos = showPhotosOverride ?? !lowBandwidthMode;
  const [showQuickImport, setShowQuickImport] = useState(false);
  // Page-scoped selection for bulk actions. Reset whenever what is on screen
  // changes, so a checked row can never silently mean a different pupil.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    schoolId,
    searchTerm,
    selectedClass,
    filterGender,
    filterStatus,
    filterPosition,
    filterDefaulters,
    sortBy,
    currentPage,
  ]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const pageIds = paginatedStudents.map((s) => s.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageIds.every((id) => next.has(id))) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const exportSelectedCsv = useCallback(() => {
    const rows = paginatedStudents.filter((s) => selectedIds.has(s.id));
    if (rows.length === 0) return;
    const header = ["Name", "Student Number", "Gender", "Class", "Parent", "Phone"];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((s) =>
      [
        `${s.first_name} ${s.last_name}`,
        s.student_number || "",
        s.gender === "M" ? "Male" : "Female",
        s.classes?.name || "",
        s.parent_name || "",
        s.parent_phone || "",
      ]
        .map(escape)
        .join(","),
    );
    // BOM first: without it Excel opens UTF-8 names as latin-1.
    const blob = new Blob(["\uFEFF" + header.join(",") + "\n" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students-selected.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [paginatedStudents, selectedIds]);

  const filtersActive =
    searchTerm.trim() !== "" ||
    selectedClass !== "all" ||
    filterGender !== "all" ||
    filterStatus !== "all" ||
    filterPosition !== "all" ||
    filterDefaulters;

  const clearFilters = () => {
    onSearchTermChange("");
    onSelectedClassChange("all");
    onFilterGenderChange("all");
    onFilterStatusChange("all");
    onFilterPositionChange("all");
    onFilterDefaultersChange(false);
  };

  const removeFilterChip = (key: string) => {
    switch (key) {
      case "search":
        onSearchTermChange("");
        break;
      case "class":
        onSelectedClassChange("all");
        break;
      case "gender":
        onFilterGenderChange("all");
        break;
      case "status":
        onFilterStatusChange("all");
        break;
      case "position":
        onFilterPositionChange("all");
        break;
      case "defaulters":
        onFilterDefaultersChange(false);
        break;
    }
  };

  const activeFilterChips: Array<{ key: string; label: string; display: string }> = [];
  if (searchTerm.trim()) {
    activeFilterChips.push({ key: "search", label: "Search", display: searchTerm });
  }
  if (selectedClass !== "all") {
    const classOption = classes.find((classItem) => classItem.id === selectedClass);
    activeFilterChips.push({
      key: "class",
      label: "Class",
      display: classOption ? `${classOption.name}${classOption.stream ? ` ${classOption.stream}` : ""}` : selectedClass,
    });
  }
  if (filterGender !== "all") {
    activeFilterChips.push({ key: "gender", label: "Gender", display: filterGender === "M" ? "Boys" : "Girls" });
  }
  if (filterStatus !== "all") {
    activeFilterChips.push({ key: "status", label: "Status", display: filterStatus });
  }
  if (filterPosition !== "all") {
    activeFilterChips.push({
      key: "position",
      label: "Position",
      display: filterPosition === "monitor" ? "Class monitors" : "Prefects",
    });
  }
  if (filterDefaulters) {
    activeFilterChips.push({ key: "defaulters", label: "Defaulters", display: "Fee defaulters" });
  }

  const downloadStudentTemplate = useCallback(() => {
    const csv = buildStudentTemplateCsv();
    // The BOM keeps Excel from reading UTF-8 names as latin-1, which turns
    // characters common in Ugandan names into mojibake on open.
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SkoolMate_Student_Template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (totalStudents === 0 && !loading) {
      setShowQuickImport(true);
    }
  }, [totalStudents, loading]);

  const resolveHouse = (student: StudentRow) => {
    if (student.house_id && houseMap[student.house_id]) {
      return houseMap[student.house_id];
    }

    const gamesHouseKey = (student as { games_house?: string | null }).games_house;
    if (gamesHouseKey && houseMap[gamesHouseKey]) {
      return houseMap[gamesHouseKey];
    }

    if (gamesHouseKey) {
      const byName = Object.values(houseMap).find((house) => house.name.toLowerCase() === gamesHouseKey.toLowerCase());
      if (byName) {
        return byName;
      }
    }

    return null;
  };

  const resolveClassLabel = (student: StudentRow) => {
    if (student.classes?.name) {
      return student.classes.stream ? `${student.classes.name} ${student.classes.stream}` : student.classes.name;
    }

    const classFromId = classes.find((classItem) => classItem.id === student.class_id);
    if (classFromId) {
      return classFromId.stream ? `${classFromId.name} ${classFromId.stream}` : classFromId.name;
    }

    return "-";
  };

  const getHouseColor = (house: HouseMeta | null) => {
    if (!house?.color) return "#64748b";
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(house.color) ? house.color : "#64748b";
  };

  const shouldForceShowQuickImport =
    (totalStudents === 0 && !loading) ||
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
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--navy)] mb-2">Quick import</div>
            <p className="text-sm text-[var(--t3)] max-w-2xl">
              Keep this closed until you need bulk import. Templates, upload, and preview stay one tap away.
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
            Data saver on — photos hidden
            <button
              type="button"
              onClick={() => setShowPhotosOverride((current) => (current === true ? null : true))}
              className="btn btn-ghost btn-xs underline"
            >
              {showPhotosOverride === true ? "Hide photos" : "Show photos"}
            </button>
          </div>
        )}
        {(showQuickImport || shouldForceShowQuickImport) && (
          <div className="mt-5 rounded-[20px] border border-[var(--border)] bg-[var(--surface)]/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--t1)]">Upload student list</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadStudentTemplate}>
                <MaterialIcon icon="download" className="text-sm" />
                Get template
              </button>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={onTemplateUpload}
              className="w-full text-sm text-slate-600"
              disabled={templateStatus === "parsing"}
            />
            <p className="text-xs text-[var(--t3)]">
              One header row, no example learners, every field the registration form takes. Columns are matched by name,
              so order does not matter. Dates accept <span className="font-medium text-[var(--t2)]">15/03/2015</span> or{" "}
              <span className="font-medium text-[var(--t2)]">2015-03-15</span>;{" "}
              <span className="font-medium text-[var(--t2)]">Class</span> accepts P.1, P1 or Primary 1. Leave a cell
              blank and it imports blank.
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
                    {(importProgress.skipped || 0) > 0 ? `, ${importProgress.skipped} already on file` : ""}
                  </>
                ) : importSummary ? (
                  <>
                    Import complete: {importSummary.success} saved, {importSummary.failed} failed
                    {importSummary.skipped > 0
                      ? `, ${importSummary.skipped} skipped because they are already on file`
                      : ""}
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
            {templatePreviewRows.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/70 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--t3)] mb-2">
                  Parsed preview ({templatePreviewRows.length} row
                  {templatePreviewRows.length === 1 ? "" : "s"})
                </div>
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
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card mb-5" style={{ padding: 0 }}>
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            // Sticky so search and filters stay reachable on a 100-row page.
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "var(--surface)",
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
          }}
        >
          <div className="relative" style={{ flex: 1, minWidth: 220 }}>
            <MaterialIcon
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t4)]"
              size={16}
            >
              search
            </MaterialIcon>
            <input
              type="text"
              ref={searchInputRef}
              placeholder="Search by name, parent, or student number..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-container-lowest)] py-2.5 pl-9 pr-9 text-sm text-[var(--t1)] placeholder:text-[var(--t4)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchTermChange("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--surface-container)] text-[var(--t3)] hover:bg-[var(--border)]"
              >
                <MaterialIcon size={15}>close</MaterialIcon>
              </button>
            )}
          </div>
          <select
            value={selectedClass}
            onChange={(e) => onSelectedClassChange(e.target.value)}
            aria-label="Filter by class"
            className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-xs font-semibold text-[var(--t1)]"
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
            aria-label="Filter by gender"
            className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-xs font-semibold text-[var(--t1)]"
          >
            <option value="all">All Genders</option>
            <option value="M">Boys only</option>
            <option value="F">Girls only</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            aria-label="Filter by status"
            className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-xs font-semibold text-[var(--t1)]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="transferred">Transferred</option>
            <option value="dropped">Dropped</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={filterPosition}
            onChange={(e) => onFilterPositionChange(e.target.value)}
            aria-label="Filter by position"
            className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-xs font-semibold text-[var(--t1)]"
          >
            <option value="all">All Positions</option>
            <option value="monitor">Class Monitors</option>
            <option value="prefect">Prefects</option>
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--t1)]">
            <input
              type="checkbox"
              checked={filterDefaulters}
              onChange={(e) => onFilterDefaultersChange(e.target.checked)}
            />
            Defaulters
          </label>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as "name" | "number" | "class")}
            aria-label="Sort students"
            className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-xs font-semibold text-[var(--t1)]"
          >
            <option value="name">Sort by Name</option>
            <option value="number">Sort by Number</option>
            <option value="class">Sort by Class</option>
          </select>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
            className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-xs font-semibold text-[var(--t1)]"
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

        {activeFilterChips.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-container-lowest)" }}
          >
            {activeFilterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pl-3 pr-1 text-xs font-medium text-[var(--t2)]"
              >
                <span className="text-[var(--t4)]">{chip.label}:</span> {chip.display}
                <button
                  type="button"
                  onClick={() => removeFilterChip(chip.key)}
                  aria-label={`Clear ${chip.label} filter`}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[var(--t4)] hover:text-[var(--t1)]"
                >
                  <MaterialIcon size={13}>close</MaterialIcon>
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-bold text-[var(--primary)] hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--navy-soft)" }}
          >
            <span className="text-xs font-bold text-[var(--navy)]">{selectedIds.size} selected on this page</span>
            <button type="button" onClick={exportSelectedCsv} className="btn btn-primary btn-sm">
              <MaterialIcon style={{ fontSize: 16 }}>download</MaterialIcon>
              Export CSV
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="btn btn-ghost btn-sm">
              Clear
            </button>
          </div>
        )}

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
                : filtersActive
                  ? "No students match the current filters"
                  : "Add your first student to get started"}
            </div>
            {filtersActive ? (
              <button onClick={clearFilters} className="btn btn-secondary" style={{ marginTop: 16 }}>
                <MaterialIcon icon="filter_alt_off" style={{ fontSize: "16px" }} />
                Clear filters
              </button>
            ) : (
              !searchTerm &&
              canManage && (
                <button onClick={onAddStudent} className="btn btn-primary" style={{ marginTop: 16 }}>
                  <MaterialIcon icon="person_add" style={{ fontSize: "16px" }} />
                  Add Student
                </button>
              )
            )}
          </div>
        ) : (
          <>
            <div className="tbl-wrap table-responsive hidden md:block">
              <table>
                <thead>
                  <tr>
                    <th data-label="Select">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectPage}
                        aria-label="Select all students on this page"
                      />
                    </th>
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
                        <td data-label="Select">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(student.id)}
                            onChange={() => toggleSelect(student.id)}
                            aria-label={`Select ${student.first_name} ${student.last_name}`}
                          />
                        </td>
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
                                background: student.gender === "M" ? "var(--navy)" : "var(--red)",
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
                                <PersonInitials name={`${student.first_name} ${student.last_name}`} size={36} />
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
                        <td data-label="Number" style={{ fontFamily: "DM Mono", fontSize: 12 }}>
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
                        <td data-label="Phone" style={{ fontSize: 13, fontFamily: "DM Mono" }}>
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
                              <MaterialIcon style={{ fontSize: 16, color: "var(--t3)" }}>sms</MaterialIcon>
                            </button>
                            {canManage && (
                              <>
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
                                  <MaterialIcon style={{ fontSize: 16, color: "var(--t3)" }}>edit</MaterialIcon>
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
                                  <MaterialIcon style={{ fontSize: 16, color: "var(--t3)" }}>delete</MaterialIcon>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {paginatedStudents.map((student) => {
                const house = resolveHouse(student);
                const statusMeta = attendanceStatusMap[student.id];
                const leader = leadershipLabel(student);

                return (
                  <div
                    key={student.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh1)]"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-4 shrink-0"
                        checked={selectedIds.has(student.id)}
                        onChange={() => toggleSelect(student.id)}
                        aria-label={`Select ${student.first_name} ${student.last_name}`}
                      />
                      <div
                        className="relative h-12 w-12 shrink-0 overflow-hidden"
                        style={{
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: student.gender === "M" ? "var(--navy)" : "var(--red)",
                        }}
                      >
                        {student.photo_url && showPhotos ? (
                          <Image
                            src={student.photo_url}
                            alt={`${student.first_name} ${student.last_name}`}
                            width={48}
                            height={48}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <PersonInitials name={`${student.first_name} ${student.last_name}`} size={48} />
                        )}
                        <span
                          title={statusMeta?.label || "No attendance recorded today"}
                          aria-label={statusMeta?.label || "No attendance recorded today"}
                          className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)]"
                          style={{
                            backgroundColor: attendanceTone(statusMeta?.status),
                            boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/dashboard/students/${student.id}`} className="block min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[var(--t1)]">
                              {student.first_name} {student.last_name}
                            </span>
                            {leader ? (
                              <span
                                className="rounded-full bg-[var(--navy-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--navy)]"
                                title={leader}
                              >
                                {student.is_class_monitor && !student.prefect_role && !student.student_council_role
                                  ? "Monitor"
                                  : "Leader"}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--t3)]">
                            {student.gender === "M" ? "Male" : "Female"}
                            {statusMeta ? ` • ${statusMeta.label}` : ""}
                          </div>
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--t1)]">
                            {resolveClassLabel(student)}
                            {student.boarding_status && student.boarding_status !== "day" && (
                              <span
                                className="ml-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
                                style={{ background: "rgba(155,89,182,0.15)", color: "#0d9488" }}
                              >
                                {student.boarding_status}
                              </span>
                            )}
                          </span>
                          {house ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--t1)]">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: getHouseColor(house) }}
                              />
                              {house.name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3 text-xs">
                      <div className="min-w-0">
                        <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--t3)]">Number</dt>
                        <dd className="mt-0.5 truncate font-mono text-[var(--t1)]">{student.student_number || "-"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--t3)]">Parent</dt>
                        <dd className="mt-0.5 truncate text-[var(--t1)]">{student.parent_name || "-"}</dd>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--t3)]">Phone</dt>
                        <dd className="mt-0.5 truncate font-mono text-[var(--t1)]">{student.parent_phone || "-"}</dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onSmsParent(student)}
                        aria-label={`SMS parent of ${student.first_name} ${student.last_name}`}
                        className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] text-[13px] font-semibold text-[var(--t2)] transition-transform active:scale-[0.98]"
                      >
                        <MaterialIcon style={{ fontSize: 16 }}>sms</MaterialIcon>
                        SMS
                      </button>
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditStudent(student)}
                            aria-label={`Edit ${student.first_name} ${student.last_name}`}
                            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] text-[13px] font-semibold text-[var(--t2)] transition-transform active:scale-[0.98]"
                          >
                            <MaterialIcon style={{ fontSize: 16 }}>edit</MaterialIcon>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteStudent(student.id)}
                            aria-label={`Delete ${student.first_name} ${student.last_name}`}
                            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--red-soft)] bg-[var(--red-soft)] text-[13px] font-semibold text-[var(--red-ink)] transition-transform active:scale-[0.98]"
                          >
                            <MaterialIcon style={{ fontSize: 16 }}>delete</MaterialIcon>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!loading && pageSize !== -1 && filteredCount > pageSize && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]"
            style={{ fontSize: 13 }}
          >
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
