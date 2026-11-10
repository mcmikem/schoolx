import { describe, expect, it, jest } from "@jest/globals";
import { loadSchoolStudentIds, lockScopedTermStudentGrades, loadScopedTermStudentGrades } from "@/lib/term-end-scope";

function createClientMock() {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const builder: Record<string, any> = {};
      for (const method of ["select", "eq", "in", "update"]) {
        builder[method] = jest.fn((...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        });
      }
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({
          data:
            table === "students"
              ? [{ id: "learner-a" }, { id: "learner-b" }]
              : [
                  { id: "grade-a", student_id: "learner-a" },
                  { id: "grade-b", student_id: "learner-b" },
                ],
          error: null,
        }).then(resolve, reject);
      return builder;
    },
  };
  return { client, calls };
}

describe("term-end service-role queries stay within a school learner set", () => {
  it("loads the student ID set using the school ID", async () => {
    const { client, calls } = createClientMock();
    await expect(loadSchoolStudentIds(client, "school-a")).resolves.toEqual(["learner-a", "learner-b"]);
    expect(calls).toContainEqual({ table: "students", method: "eq", args: ["school_id", "school-a"] });
  });

  it("filters term-grade reads and the locking update by owned learner IDs", async () => {
    const { client, calls } = createClientMock();
    const ids = ["learner-a", "learner-b"];
    const rows = await loadScopedTermStudentGrades(client, ids, "2026", 3);
    expect(rows).toHaveLength(2);
    expect(calls).toContainEqual({ table: "student_grades", method: "in", args: ["student_id", ids] });

    calls.length = 0;
    await expect(lockScopedTermStudentGrades(client, ids, "2026", 3)).resolves.toBe(2);
    expect(calls).toContainEqual({ table: "student_grades", method: "in", args: ["student_id", ids] });
    expect(calls).toContainEqual({ table: "student_grades", method: "in", args: ["id", ["grade-a", "grade-b"]] });
    expect(calls).toContainEqual({ table: "student_grades", method: "in", args: ["student_id", ids] });
  });

  it("does not query or update grade rows for an empty school roster", async () => {
    const calls: Array<{ table: string; method: string }> = [];
    const client = {
      from(table: string) {
        const builder: Record<string, any> = {};
        builder.select = jest.fn(() => builder);
        builder.eq = jest.fn(() => builder);
        builder.in = jest.fn(() => builder);
        builder.update = jest.fn(() => builder);
        builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve, reject);
        calls.push({ table, method: "from" });
        return builder;
      },
    };
    await expect(loadScopedTermStudentGrades(client, [], "2026", 3)).resolves.toEqual([]);
    await expect(lockScopedTermStudentGrades(client, [], "2026", 3)).resolves.toBe(0);
    expect(calls).toEqual([]);
  });
});
