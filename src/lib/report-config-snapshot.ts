import type { ReportRowsConfig, TermGradeBasis } from "@/lib/report-rows";
import type { ReportLayoutId } from "@/lib/grading-tracks";

export type StoredReportFormat = "numerical" | "competency" | "both" | "cbc";

/** A versioned copy of the school configuration that produced one report card. */
export function buildReportConfigSnapshot(input: {
  format: StoredReportFormat;
  layout: ReportLayoutId;
  useBeginningOfTerm: boolean;
  gradeBasis: TermGradeBasis | null;
  reportRows: ReportRowsConfig | null;
  assessmentModel?: "secondary_progressive";
  capturedAt?: string;
}) {
  return JSON.parse(
    JSON.stringify({
      schemaVersion: 1,
      format: input.format,
      layout: input.layout,
      useBeginningOfTerm: input.useBeginningOfTerm,
      assessmentModel: input.assessmentModel || "school_default",
      gradeBasis: input.gradeBasis,
      reportRows: input.reportRows,
      capturedAt: input.capturedAt || new Date().toISOString(),
    }),
  ) as {
    schemaVersion: 1;
    format: StoredReportFormat;
    layout: ReportLayoutId;
    useBeginningOfTerm: boolean;
    assessmentModel: "secondary_progressive" | "school_default";
    gradeBasis: TermGradeBasis | null;
    reportRows: ReportRowsConfig | null;
    capturedAt: string;
  };
}
