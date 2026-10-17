import { formatSpreadsheetCell } from "./students";

export type TabularRow = Record<string, string>;

/**
 * Read a CSV or Excel file into plain objects keyed by the original header
 * text, without interpreting any column. Shared by the student, fee-structure
 * and mobile-money importers so they all parse files the same way.
 */
export async function readTabularRows(file: File): Promise<TabularRow[]> {
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

    const rows: TabularRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = (Array.isArray(row.values) ? row.values : []).slice(1);
      const record: TabularRow = {};
      headers.forEach((header, index) => {
        if (header) record[header] = formatSpreadsheetCell(values[index]);
      });
      if (Object.values(record).some((value) => value.length > 0)) rows.push(record);
    });
    return rows;
  }

  const Papa = (await import("papaparse")).default;
  return await new Promise<TabularRow[]>((resolve, reject) => {
    Papa.parse<TabularRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
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
}
