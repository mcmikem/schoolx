import { sortGradeSheetsForReview, type GradeWorkflowStatus } from "@/lib/operations";

/**
 * The Grades page review queue.
 *
 * gradeWorkflowRank ascends draft → published, so sorting the queue on it in
 * descending order put PUBLISHED sheets at the top: a headmaster opening the
 * page saw finished work first and the sheets waiting for approval underneath.
 * These cases pin the intended order — what the viewer can act on, first.
 */

const sheet = (status: GradeWorkflowStatus, className: string) => ({ status, className });

const CLASS_ORDER = ["P.2", "P.3", "P.4"];

describe("grade sheet review order", () => {
  it("puts a reviewer's actionable sheets above finished work", () => {
    const sheets = [
      sheet("published", "P.4"),
      sheet("approved", "P.3"),
      sheet("submitted", "P.2"),
      sheet("draft", "P.1"),
    ];
    expect(sortGradeSheetsForReview(sheets, true).map((s) => s.status)).toEqual([
      "submitted",
      "approved",
      "draft",
      "published",
    ]);
  });

  it("does not mutate the array it was given", () => {
    const sheets = [sheet("published", "P.4"), sheet("submitted", "P.2")];
    const original = sheets.map((s) => s.status);
    sortGradeSheetsForReview(sheets, true);
    expect(sheets.map((s) => s.status)).toEqual(original);
  });

  it("leads a teacher's own list with the sheet they still have to send", () => {
    const sheets = [
      sheet("published", "P.4"),
      sheet("submitted", "P.3"),
      sheet("draft", "P.2"),
    ];
    expect(sortGradeSheetsForReview(sheets, false).map((s) => s.status)).toEqual([
      "draft",
      "submitted",
      "published",
    ]);
  });

  it("breaks ties by class name so the list is stable", () => {
    const sheets = [sheet("submitted", "P.4"), sheet("submitted", "P.2"), sheet("submitted", "P.3")];
    expect(sortGradeSheetsForReview(sheets, true).map((s) => s.className)).toEqual(CLASS_ORDER);
  });

  it("leaves an empty queue empty", () => {
    expect(sortGradeSheetsForReview([], true)).toEqual([]);
  });
});
