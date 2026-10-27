"use client";
import * as fs from "node:fs";
import * as path from "node:path";

// Report cards preview/publish: the headmaster must be able to see what stands
// between a class and cards going home on one strip, not by paging through
// every card, and not only while the network is up.

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("report cards: readiness strip", () => {
  it("summarises what is missing per class in one place", () => {
    const page = read("src/app/dashboard/report-cards/page.tsx");
    expect(page).toContain("Ready to go home?");
    expect(page).toContain("cards saved");
    expect(page).toContain("missing marks");
    expect(page).toContain("class-teacher remark");
    expect(page).toContain("HM remark");
    expect(page).toContain("const readiness = useMemo");
  });

  it("counts cards on file from report_cards for the class and term", () => {
    const page = read("src/app/dashboard/report-cards/page.tsx");
    expect(page).toContain("savedCardCount");
    expect(page).toContain(".eq(\"class_id\", selectedClass)");
    expect(page).toContain(".eq(\"academic_year\", academicYear)");
  });

  it("falls back to the device cache when the network is gone", () => {
    // Offline blank rows used to read as "you have no cards", when the truth
    // was "you have no network". The queued generation rows are the truth.
    const page = read("src/app/dashboard/report-cards/page.tsx");
    expect(page).toContain('offlineDB.getAll("report_cards", {');
    expect(page).toContain("Offline — numbers come from the device cache");
  });
});
