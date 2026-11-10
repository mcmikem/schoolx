import { buildReportConfigSnapshot } from "@/lib/report-config-snapshot";
import type { TermGradeBasis, ReportRowsConfig } from "@/lib/report-rows";

describe("buildReportConfigSnapshot", () => {
  it("records an immutable, versioned snapshot of the report settings", () => {
    const basis: TermGradeBasis = { types: ["bot", "eot"], weights: { bot: 20, eot: 80 } };
    const rows: ReportRowsConfig = {
      default: [{ id: "sciences", label: "Sciences", subjectIds: ["Biology", "Chemistry"], mode: "mean" }],
    };
    const snapshot = buildReportConfigSnapshot({
      format: "both",
      layout: "uganda_classic",
      useBeginningOfTerm: true,
      gradeBasis: basis,
      reportRows: rows,
      assessmentModel: "secondary_progressive",
      capturedAt: "2026-11-10T08:00:00.000Z",
    });

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      format: "both",
      layout: "uganda_classic",
      useBeginningOfTerm: true,
      assessmentModel: "secondary_progressive",
      gradeBasis: basis,
      reportRows: rows,
      capturedAt: "2026-11-10T08:00:00.000Z",
    });
    expect(snapshot.reportRows).not.toBe(rows);
    rows.default![0].label = "Changed after capture";
    expect(snapshot.reportRows?.default?.[0].label).toBe("Sciences");
  });

  it("marks default assessment and absent custom recipes explicitly", () => {
    expect(
      buildReportConfigSnapshot({
        format: "numerical",
        layout: "uganda_classic",
        useBeginningOfTerm: false,
        gradeBasis: null,
        reportRows: null,
        capturedAt: "2026-11-10T08:00:00.000Z",
      }),
    ).toMatchObject({ assessmentModel: "school_default", gradeBasis: null, reportRows: null });
  });
});
