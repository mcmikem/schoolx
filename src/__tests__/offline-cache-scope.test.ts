import { isOutsideOfflineClassSelection } from "@/lib/offline-cache-scope";

describe("selected-class offline cache pruning", () => {
  const schoolId = "school-1";
  const classIds = ["class-1"];
  const studentIds = ["student-1"];

  it("removes same-school student and class data outside the selected roster", () => {
    expect(
      isOutsideOfflineClassSelection(
        "students",
        { id: "student-2", school_id: schoolId, class_id: "class-2" },
        schoolId,
        classIds,
        studentIds,
      ),
    ).toBe(true);
    expect(
      isOutsideOfflineClassSelection(
        "grades",
        { id: "grade-2", school_id: schoolId, student_id: "student-2" },
        schoolId,
        classIds,
        studentIds,
      ),
    ).toBe(true);
    expect(
      isOutsideOfflineClassSelection(
        "timetable",
        { id: "period-2", school_id: schoolId, class_id: "class-2" },
        schoolId,
        classIds,
        studentIds,
      ),
    ).toBe(true);
  });

  it("keeps selected rows and records from another school untouched", () => {
    expect(
      isOutsideOfflineClassSelection(
        "attendance",
        { id: "attendance-1", school_id: schoolId, student_id: "student-1" },
        schoolId,
        classIds,
        studentIds,
      ),
    ).toBe(false);
    expect(
      isOutsideOfflineClassSelection(
        "grades",
        { id: "grade-3", school_id: "school-2", student_id: "student-3" },
        schoolId,
        classIds,
        studentIds,
      ),
    ).toBe(false);
    expect(
      isOutsideOfflineClassSelection(
        "fee_structure",
        { id: "fee-1", school_id: schoolId },
        schoolId,
        classIds,
        studentIds,
      ),
    ).toBe(false);
  });
});
