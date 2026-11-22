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
  assessmentSittings?: Array<{ id: string; name: string; groupKey: string; maxScore: number; weight?: number | null }>;
  capturedAt?: string;
}) {
  return JSON.parse(
    JSON.stringify({
      schemaVersion: 2,
      format: input.format,
      layout: input.layout,
      useBeginningOfTerm: input.useBeginningOfTerm,
      assessmentModel: input.assessmentModel || "school_default",
      gradeBasis: input.gradeBasis,
      reportRows: input.reportRows,
      assessmentSittings: input.assessmentSittings || [],
      capturedAt: input.capturedAt || new Date().toISOString(),
    }),
  ) as {
    schemaVersion: 2;
    format: StoredReportFormat;
    layout: ReportLayoutId;
    useBeginningOfTerm: boolean;
    assessmentModel: "secondary_progressive" | "school_default";
    gradeBasis: TermGradeBasis | null;
    reportRows: ReportRowsConfig | null;
    capturedAt: string;
  };
}
