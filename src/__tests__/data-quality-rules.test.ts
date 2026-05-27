import { evaluateDataQuality } from "@/lib/data-quality-rules";

describe("evaluateDataQuality", () => {
  test("detects critical and warning issues", () => {
    const report = evaluateDataQuality({
      students: [
        { id: "s1", admission_number: "", parent_phone: null, parent_phone2: null },
        { id: "s2", admission_number: "A-001", parent_phone: "0700" },
        { id: "s3", admission_number: "A-001", parent_phone: null, parent_phone2: null },
      ],
      users: [
        { id: "u1", status: "active", role: null, email: "same@example.com" },
        { id: "u2", status: "active", role: "teacher", email: "same@example.com" },
      ],
    });

    expect(report.checkedStudents).toBe(3);
    expect(report.checkedUsers).toBe(2);
    expect(report.criticalCount).toBeGreaterThan(0);
    expect(report.warningCount).toBeGreaterThan(0);
    expect(report.issues.some((issue) => issue.code === "students_missing_admission_number")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "students_duplicate_admission_number")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "users_missing_role")).toBe(true);
  });

  test("returns no issues for clean data", () => {
    const report = evaluateDataQuality({
      students: [
        {
          id: "s1",
          admission_number: "A-001",
          parent_phone: "0700000001",
          parent_phone2: null,
        },
      ],
      users: [
        {
          id: "u1",
          status: "active",
          role: "teacher",
          email: "teacher1@example.com",
        },
      ],
    });

    expect(report.issues).toHaveLength(0);
    expect(report.criticalCount).toBe(0);
    expect(report.warningCount).toBe(0);
  });
});
