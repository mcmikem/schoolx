"use client";

import { useCallback, useState } from "react";
import {
  type BoardingStatus,
  buildClassAliasMap,
  buildHouseAliasMap,
  formatSpreadsheetCell,
  type ParsedStudentRow,
  resolveClassId,
  resolveHouseId,
  validateStudentRow,
} from "@/lib/import/students";
import type { CreateStudentInput } from "@/types";

export type TemplateRow = Record<string, string>;

interface ImportSummary {
  success: number;
  failed: number;
  total: number;
  errors: string[];
}

/** A row that passed header mapping, with its class resolved to a real id. */
interface SeedableRow {
  preview: TemplateRow;
  data: ParsedStudentRow;
  /** validateStudentRow rejects a missing or unrecognised gender, so a row that
   *  reaches the seed step always has a concrete value. */
  gender: "M" | "F";
  classId: string;
  classLabel: string;
  /** Resolved house id, or "" when the roster did not name one. */
  houseId: string;
}

interface UseStudentTemplateImportParams {
  classes: Array<{ id: string; name: string }>;
  /**
   * Houses are optional. Without them a House column is reported as unmatched
   * rather than silently dropped, so a roster can still import without one.
   */
  houses?: Array<{ id: string; name: string }>;
  createStudent: (student: CreateStudentInput) => Promise<unknown>;
}

const PREVIEW_COLUMNS: Array<keyof ParsedStudentRow> = [
  "student_number",
  "first_name",
  "last_name",
  "gender",
  "date_of_birth",
  "class_name",
  "boarding_status",
  "house_name",
  "parent_name",
  "parent_phone",
  "parent_phone2",
  "parent_email",
  "ple_index_number",
  "nin",
  "previous_school",
  "district_origin",
  "sub_county",
  "parish",
  "village",
  "blood_type",
  "religion",
  "nationality",
  "opening_balance",
  "is_class_monitor",
  "prefect_role",
  "student_council_role",
  "games_house",
  "uneab_number",
];

export function useStudentTemplateImport(params: UseStudentTemplateImportParams) {
  const { classes, houses = [], createStudent } = params;
  const [seedableRows, setSeedableRows] = useState<SeedableRow[]>([]);
  const [templatePreviewRows, setTemplatePreviewRows] = useState<TemplateRow[]>([]);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "parsing" | "ready">("idle");
  const [templateErrors, setTemplateErrors] = useState<string | null>(null);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    completed: number;
    total: number;
    success: number;
    failed: number;
  } | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  /**
   * Reads the raw file into plain objects keyed by the original header text.
   *
   * No column is interpreted here. Header aliases, gender, the full-name split
   * and the pairing of a second phone column are all handled by
   * validateStudentRow, which is shared with /dashboard/import.
   */
  const readTabularRows = useCallback(async (file: File): Promise<TemplateRow[]> => {
    const extension = (file.name.split(".").pop() || "").toLowerCase();

    if (extension === "xls") {
      throw new Error("Legacy .xls files are not supported. Save the file as .xlsx or .csv and upload it again.");
    }

    if (extension === "xlsx") {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.worksheets[0];
      if (!worksheet) return [];

      const firstRow = worksheet.getRow(1).values;
      const headers = (Array.isArray(firstRow) ? firstRow : []).slice(1).map((header) => String(header ?? "").trim());

      const rows: TemplateRow[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = (Array.isArray(row.values) ? row.values : []).slice(1);
        const record: TemplateRow = {};
        headers.forEach((header, index) => {
          // ExcelJS hands back a Date for a date-formatted cell; rendering it as a
          // string is what made every date in a .xlsx fail to parse.
          if (header) record[header] = formatSpreadsheetCell(values[index]);
        });
        if (Object.values(record).some((value) => value.length > 0)) rows.push(record);
      });
      return rows;
    }

    const Papa = (await import("papaparse")).default;
    return await new Promise<TemplateRow[]>((resolve, reject) => {
      Papa.parse<TemplateRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // A duplicate or renamed header makes Papa collapse the column. Surface
          // it rather than silently importing a shifted row.
          const problems = (results.errors || []).slice(0, 3).map((e) => e.message);
          if (problems.length) {
            reject(new Error(`Could not read the file: ${problems.join("; ")}`));
            return;
          }
          resolve(
            (results.data || []).filter((row) =>
              Object.values(row || {}).some((value) => String(value ?? "").trim().length > 0),
            ),
          );
        },
        error: (error) => reject(new Error(error.message)),
      });
    });
  }, []);

  const handleStudentTemplateUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setTemplateStatus("parsing");
      setTemplateErrors(null);
      setSeedableRows([]);
      setTemplatePreviewRows([]);
      setImportSummary(null);
      setImportProgress(null);

      try {
        const rawRows = await readTabularRows(file);
        if (rawRows.length === 0) {
          setTemplateErrors(
            "That file has no student rows. The first line must be a header row, such as: First Name, Last Name, Gender, Class, Parent Name, Parent Phone",
          );
          setTemplateStatus("idle");
          return;
        }

        // One alias map for the whole file. Indexing every class under its
        // normalised name and its common spellings is what lets "P.1", "p1" and
        // "Primary 1" all reach the same class instead of failing row by row.
        const classMap = buildClassAliasMap(classes);
        const houseMap = buildHouseAliasMap(houses);

        const usable: SeedableRow[] = [];
        const problems: string[] = [];

        rawRows.forEach((raw, index) => {
          const validated = validateStudentRow(raw);
          const data = validated.data;

          if (!data.first_name || !data.last_name) {
            problems.push(`Row ${index + 1}: ${validated.errors.join("; ") || "first and last name are required"}`);
            return;
          }

          // createStudent requires a parent name; validateStudentRow does not, so
          // without this the row passes the pre-flight and then fails mid-import.
          if (!data.parent_name) {
            problems.push(`Row ${index + 1} (${data.first_name} ${data.last_name}): parent name is required`);
            return;
          }

          const classId = resolveClassId(classMap, data.class_name) || "";
          if (!classId) {
            const known = classes.map((c) => c.name).join(", ");
            problems.push(
              data.class_name
                ? `Row ${index + 1} (${data.first_name} ${data.last_name}): no class matches "${data.class_name}". Classes in this school: ${known || "none yet"}`
                : `Row ${index + 1} (${data.first_name} ${data.last_name}): no class given. Classes in this school: ${known || "none yet"}`,
            );
            return;
          }

          // Parent contact is not required to enrol a learner, but an unusable
          // phone number is worth reporting before the rows are written rather
          // than after, when fixing it means finding the student again.
          if (validated.errors.length) {
            problems.push(`Row ${index + 1} (${data.first_name} ${data.last_name}): ${validated.errors.join("; ")}`);
            return;
          }

          let houseId = "";
          if (data.house_name) {
            houseId = resolveHouseId(houseMap, data.house_name) || "";
            if (!houseId) {
              const knownHouses = houses.map((h) => h.name).join(", ");
              problems.push(
                `Row ${index + 1} (${data.first_name} ${data.last_name}): no house matches "${data.house_name}". Houses in this school: ${knownHouses || "none yet"}`,
              );
              return;
            }
          }

          const preview: TemplateRow = {};
          for (const column of PREVIEW_COLUMNS) preview[column] = String(data[column] ?? "");
          preview.resolved_class = classes.find((c) => c.id === classId)?.name || data.class_name;
          preview.resolved_house = houses.find((h) => h.id === houseId)?.name || "";

          usable.push({
            preview,
            data,
            gender: data.gender as "M" | "F",
            classId,
            classLabel: preview.resolved_class,
            houseId,
          });
        });

        setSeedableRows(usable);
        setTemplatePreviewRows(usable.slice(0, 5).map((row) => row.preview));
        setTemplateStatus("ready");

        if (problems.length) {
          const skipped = problems.length;
          setTemplateErrors(
            `${skipped} of ${rawRows.length} rows cannot be imported and will be skipped:\n` +
              problems.slice(0, 8).join("\n") +
              (problems.length > 8 ? `\n…and ${problems.length - 8} more.` : ""),
          );
        }
      } catch (error: unknown) {
        setTemplateErrors(error instanceof Error ? error.message : "Could not read that file");
        setTemplateStatus("idle");
      }
    },
    [classes, houses, readTabularRows],
  );

  const handleSeedStudentsFromTemplate = useCallback(async () => {
    if (!seedableRows.length) {
      setTemplateErrors("Upload a template before seeding.");
      return;
    }

    setImportingTemplate(true);
    setImportProgress({ completed: 0, total: seedableRows.length, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    const captureError = (message: string) => {
      if (errors.length < 10) errors.push(message);
    };

    // Deliberately sequential. createStudent() re-reads its own student number
    // each time and asserts it is unique, so running rows concurrently makes
    // them race for the same generated number and turns a slow import into a
    // failed one.
    for (const [index, row] of seedableRows.entries()) {
      try {
        await createStudent({
          first_name: row.data.first_name,
          last_name: row.data.last_name,
          gender: row.gender,
          date_of_birth: row.data.date_of_birth || undefined,
          class_id: row.classId,
          student_number: row.data.student_number || undefined,
          ple_index_number: row.data.ple_index_number || undefined,
          parent_name: row.data.parent_name,
          parent_phone: row.data.parent_phone,
          parent_phone2: row.data.parent_phone2 || undefined,
          parent_email: row.data.parent_email || undefined,
          address: row.data.address || undefined,
          village: row.data.village || undefined,
          parish: row.data.parish || undefined,
          sub_county: row.data.sub_county || undefined,
          district_origin: row.data.district_origin || undefined,
          boarding_status: (row.data.boarding_status || "day") as BoardingStatus,
          house_id: row.houseId || undefined,
          previous_school: row.data.previous_school || undefined,
          blood_type: row.data.blood_type || undefined,
          religion: row.data.religion || undefined,
          nationality: row.data.nationality || undefined,
          nin: row.data.nin || undefined,
          opening_balance: row.data.opening_balance ? Number(row.data.opening_balance) : 0,
          is_class_monitor: row.data.is_class_monitor,
          prefect_role: row.data.prefect_role || undefined,
          student_council_role: row.data.student_council_role || undefined,
          games_house: row.data.games_house || undefined,
          uneab_number: row.data.uneab_number || undefined,
          status: "active",
        });
        success++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        captureError(`Row ${index + 1} (${row.data.first_name} ${row.data.last_name}, ${row.classLabel}): ${message}`);
        failed++;
      }

      setImportProgress({
        completed: index + 1,
        total: seedableRows.length,
        success,
        failed,
      });
    }

    setImportSummary({ success, failed, total: seedableRows.length, errors });
    setImportingTemplate(false);
  }, [createStudent, seedableRows]);

  return {
    templateRows: seedableRows,
    templatePreviewRows,
    templateStatus,
    templateErrors,
    importingTemplate,
    importProgress,
    importSummary,
    handleStudentTemplateUpload,
    handleSeedStudentsFromTemplate,
  };
}
