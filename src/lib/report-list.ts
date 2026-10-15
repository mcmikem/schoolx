export function searchReportList<Report extends { name: string; studentNumber: string }>(
  reports: Report[],
  query: string,
): Report[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return reports;
  return reports.filter((report) => `${report.name} ${report.studentNumber}`.toLowerCase().includes(normalized));
}
