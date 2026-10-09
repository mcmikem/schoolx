import * as fs from "node:fs";
import * as path from "node:path";

// The attendance register speaks plain Present/Absent — never the "In
// School"/"Away" euphemisms — and a save lands on a summary, not the same
// list. Both are one careless edit away from regressing, and neither is
// covered by logic tests (the page needs heavy mocks to render), so the
// source is pinned here as text, the same way pwa-update.test.ts does it.

const ROOT = path.join(__dirname, "..", "..");
const page = fs.readFileSync(path.join(ROOT, "src/app/dashboard/attendance/page.tsx"), "utf8");

describe("attendance vocabulary", () => {
  it("labels statuses Present/Absent, never In School/Away", () => {
    expect(page).toContain('label: "Present"');
    expect(page).toContain('label: "Absent"');
    expect(page).not.toContain("In School");
    expect(page).not.toContain("Not In School");
    expect(page).not.toContain("Quick Away");
    expect(page).not.toContain("Mark All In School");
  });

  it("sends DB status values unchanged (labels only, no data migration)", () => {
    // The canonical cycle still drives storage; only STATUS_CONFIG labels changed.
    expect(page).toContain('["present", "absent", "late", "excused"]');
  });
});

describe("attendance post-save done state", () => {
  it("replaces the register with a summary after save", () => {
    expect(page).toContain("savedSummary");
    expect(page).toContain("Attendance saved");
    expect(page).toContain("Mark another class");
    expect(page).toContain("Back to register");
    expect(page).toContain("View report");
  });

  it("leads marking rows with photos, not admission numbers", () => {
    expect(page).toContain("RollCallPhoto");
    expect(page).toContain("photo_url");
  });
});
