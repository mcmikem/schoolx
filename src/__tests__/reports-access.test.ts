import { canUserAccessStudentReport } from "../app/api/reports/route";

describe("canUserAccessStudentReport", () => {
  test("allows admin roles", () => {
    expect(
      canUserAccessStudentReport({
        userRole: "headmaster",
        userId: "u1",
        studentClassId: "c1",
      }),
    ).toBe(true);
  });

  test("allows teacher assigned as class teacher", () => {
    expect(
      canUserAccessStudentReport({
        userRole: "teacher",
        userId: "t1",
        studentClassId: "c1",
        classTeacherId: "t1",
      }),
    ).toBe(true);
  });

  test("allows teacher if class appears in timetable assignments", () => {
    expect(
      canUserAccessStudentReport({
        userRole: "teacher",
        userId: "t1",
        studentClassId: "c2",
        classTeacherId: "someone-else",
        taughtClassIds: ["c2", "c3"],
      }),
    ).toBe(true);
  });

  test("denies teacher for unassigned class", () => {
    expect(
      canUserAccessStudentReport({
        userRole: "teacher",
        userId: "t1",
        studentClassId: "c9",
        classTeacherId: "other",
        taughtClassIds: ["c2", "c3"],
      }),
    ).toBe(false);
  });

  test("denies non-allowed role", () => {
    expect(
      canUserAccessStudentReport({
        userRole: "parent",
        userId: "p1",
        studentClassId: "c1",
      }),
    ).toBe(false);
  });
});
