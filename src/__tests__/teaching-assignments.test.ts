import {
  normalizeTeachingAssignments,
  validateTeachingAssignments,
  groupTeachingAssignments,
} from "@/components/staff/TeachingAssignmentsEditor";

const names: Record<string, string> = { c1: "P.4", c2: "P.5", c3: "Baby Class" };
const classNameOf = (id: string) => names[id] ?? "";

describe("normalizeTeachingAssignments", () => {
  it("drops incomplete rows and dedupes pairs", () => {
    expect(
      normalizeTeachingAssignments([
        { class_id: "c1", subject_ids: ["m", "e"] },
        { class_id: "", subject_ids: ["m"] },
        { class_id: "c2", subject_ids: [] },
        { class_id: "c1", subject_ids: ["m", "s"] },
      ]),
    ).toEqual([
      { class_id: "c1", subject_id: "m" },
      { class_id: "c1", subject_id: "e" },
      { class_id: "c1", subject_id: "s" },
    ]);
  });

  it("keeps the same subject under different classes", () => {
    expect(
      normalizeTeachingAssignments([
        { class_id: "c1", subject_ids: ["m"] },
        { class_id: "c3", subject_ids: ["m"] },
      ]),
    ).toHaveLength(2);
  });
});

describe("validateTeachingAssignments", () => {
  it("requires at least one teaching row", () => {
    expect(validateTeachingAssignments([], classNameOf)).toMatch(/at least one class/);
    expect(validateTeachingAssignments([{ class_id: "", subject_ids: [] }], classNameOf)).toMatch(/at least one class/);
  });

  it("requires a class and a subject per touched row", () => {
    expect(validateTeachingAssignments([{ class_id: "", subject_ids: ["m"] }], classNameOf)).toMatch(/class/);
    expect(validateTeachingAssignments([{ class_id: "c1", subject_ids: [] }], classNameOf)).toMatch(/P\.4/);
  });

  it("accepts a nursery teacher with no class-teacher role", () => {
    expect(validateTeachingAssignments([{ class_id: "c3", subject_ids: ["lng"] }], classNameOf)).toBeNull();
  });
});

describe("groupTeachingAssignments", () => {
  it("regroups flat rows per class without collapsing classes", () => {
    expect(
      groupTeachingAssignments([
        { class_id: "c1", subject_id: "m" },
        { class_id: "c2", subject_id: "e" },
        { class_id: "c1", subject_id: "e" },
        { class_id: null, subject_id: "x" },
      ]),
    ).toEqual([
      { class_id: "c1", subject_ids: ["m", "e"] },
      { class_id: "c2", subject_ids: ["e"] },
    ]);
  });
});
