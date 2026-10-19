import { filterStudents, matchesStudentSearch, sortStudents, type RegistryStudent } from "@/lib/students/registry";

const pupil = (overrides: Partial<RegistryStudent>): RegistryStudent => ({
  first_name: "Amina",
  last_name: "Nakato",
  student_number: "S001",
  class_id: "p3",
  gender: "F",
  status: "active",
  ...overrides,
});

const pupils: RegistryStudent[] = [
  pupil({
    first_name: "Brian",
    last_name: "Okello",
    student_number: "S003",
    class_id: "p1",
    gender: "M",
    classes: { name: "P.1" },
  }),
  pupil({
    first_name: "Amina",
    last_name: "Nakato",
    student_number: "S001",
    class_id: "p3",
    gender: "F",
    classes: { name: "P.3" },
  }),
  pupil({
    first_name: "Charles",
    last_name: "Mukasa",
    student_number: "S002",
    class_id: "p2",
    gender: "M",
    classes: { name: "P.2" },
    is_class_monitor: true,
    opening_balance: "50000",
  }),
];

describe("matchesStudentSearch", () => {
  it("matches name, parent and student number case-insensitively", () => {
    const student = pupil({ parent_name: "Grace Nakato" });
    expect(matchesStudentSearch(student, "amina")).toBe(true);
    expect(matchesStudentSearch(student, "grace")).toBe(true);
    expect(matchesStudentSearch(student, "s001")).toBe(true);
  });

  it("requires every word to match", () => {
    expect(matchesStudentSearch(pupil({}), "amina nakato")).toBe(true);
    expect(matchesStudentSearch(pupil({}), "amina okello")).toBe(false);
  });

  it("treats a blank search as no filter", () => {
    expect(matchesStudentSearch(pupil({}), "   ")).toBe(true);
  });
});

describe("filterStudents", () => {
  it("filters by class, gender, status and position", () => {
    expect(filterStudents(pupils, { classId: "p2" }).map((s) => s.student_number)).toEqual(["S002"]);
    expect(filterStudents(pupils, { gender: "M" })).toHaveLength(2);
    expect(filterStudents(pupils, { status: "inactive" })).toHaveLength(0);
    expect(filterStudents(pupils, { position: "monitor" })).toHaveLength(1);
  });

  it("keeps only pupils with an opening balance when defaultersOnly", () => {
    expect(filterStudents(pupils, { defaultersOnly: true }).map((s) => s.last_name)).toEqual(["Mukasa"]);
  });

  it("returns everyone with the default filters", () => {
    expect(filterStudents(pupils, {})).toHaveLength(3);
  });
});

describe("sortStudents", () => {
  it("sorts by name in both directions without mutating the input", () => {
    const original = [...pupils];
    expect(sortStudents(pupils, "name").map((s) => s.first_name)).toEqual(["Amina", "Brian", "Charles"]);
    expect(sortStudents(pupils, "name", "desc").map((s) => s.first_name)).toEqual(["Charles", "Brian", "Amina"]);
    expect(pupils).toEqual(original);
  });

  it("sorts by student number and class", () => {
    expect(sortStudents(pupils, "number").map((s) => s.student_number)).toEqual(["S001", "S002", "S003"]);
    expect(sortStudents(pupils, "class").map((s) => s.student_number)).toEqual(["S003", "S002", "S001"]);
  });
});
