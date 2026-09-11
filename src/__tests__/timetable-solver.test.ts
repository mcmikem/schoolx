import { solveTimetable, type SolverInput } from "../lib/timetable-solver";

const DAYS = [1, 2, 3, 4, 5];

function smallSchool(): SolverInput {
  return {
    days: DAYS,
    periodsPerDay: 6,
    teachers: [{ id: "t-eng" }, { id: "t-math" }, { id: "t-sci" }],
    requirements: [
      { classId: "p5a", subjectId: "eng", teacherIds: ["t-eng"], periodsPerWeek: 5 },
      { classId: "p5a", subjectId: "math", teacherIds: ["t-math"], periodsPerWeek: 5 },
      { classId: "p5b", subjectId: "eng", teacherIds: ["t-eng"], periodsPerWeek: 4 },
      { classId: "p5b", subjectId: "sci", teacherIds: ["t-sci"], periodsPerWeek: 3 },
    ],
  };
}

function assertNoClashes(result: {
  placements: { teacherId: string; classId: string; dayOfWeek: number; periodNumber: number }[];
}) {
  const teacherSlots = new Set<string>();
  const classSlots = new Set<string>();
  for (const p of result.placements) {
    const t = `${p.teacherId}|${p.dayOfWeek}:${p.periodNumber}`;
    const c = `${p.classId}|${p.dayOfWeek}:${p.periodNumber}`;
    expect(teacherSlots.has(t)).toBe(false);
    expect(classSlots.has(c)).toBe(false);
    teacherSlots.add(t);
    classSlots.add(c);
  }
}

describe("solveTimetable", () => {
  it("places a small school with zero conflicts", () => {
    const result = solveTimetable(smallSchool());
    expect(result.conflicts).toEqual([]);
    expect(result.placements).toHaveLength(5 + 5 + 4 + 3);
    assertNoClashes(result);
  });

  it("is deterministic across runs", () => {
    expect(solveTimetable(smallSchool())).toEqual(solveTimetable(smallSchool()));
  });

  it("respects teacher unavailability", () => {
    const input = smallSchool();
    input.teachers = [
      { id: "t-eng", unavailable: ["1:1", "1:2", "1:3", "1:4", "1:5", "1:6"] },
      { id: "t-math" },
      { id: "t-sci" },
    ];
    const result = solveTimetable(input);
    expect(result.conflicts).toEqual([]);
    for (const p of result.placements) {
      if (p.teacherId === "t-eng") expect(p.dayOfWeek).not.toBe(1);
    }
    assertNoClashes(result);
  });

  it("respects weekly load caps and reports the remainder as conflict", () => {
    const input = smallSchool();
    input.teachers = [{ id: "t-eng", maxPeriodsPerWeek: 6 }, { id: "t-math" }, { id: "t-sci" }];
    const result = solveTimetable(input);
    // t-eng needs 9 periods but is capped at 6 -> 3 unplaced
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].periodsUnplaced).toBe(3);
    expect(result.conflicts[0].reason).toMatch(/fully booked|unavailable/);
    const engPlaced = result.placements.filter((p) => p.teacherId === "t-eng");
    expect(engPlaced).toHaveLength(6);
  });

  it("flags requirements with no eligible teacher", () => {
    const input = smallSchool();
    input.requirements = [{ classId: "p5a", subjectId: "art", teacherIds: [], periodsPerWeek: 2 }];
    const result = solveTimetable(input);
    expect(result.placements).toEqual([]);
    expect(result.conflicts).toEqual([
      {
        classId: "p5a",
        subjectId: "art",
        periodsUnplaced: 2,
        reason: "No eligible teacher assigned to this class/subject",
      },
    ]);
  });

  it("reports conflict when demand exceeds the grid", () => {
    const result = solveTimetable({
      days: [1],
      periodsPerDay: 2,
      teachers: [{ id: "t1" }],
      requirements: [{ classId: "c1", subjectId: "s1", teacherIds: ["t1"], periodsPerWeek: 5 }],
    });
    expect(result.placements).toHaveLength(2);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].periodsUnplaced).toBe(3);
  });

  it("spreads a subject across days instead of stacking one day", () => {
    const result = solveTimetable({
      days: [1, 2, 3],
      periodsPerDay: 4,
      teachers: [{ id: "t1" }],
      requirements: [{ classId: "c1", subjectId: "s1", teacherIds: ["t1"], periodsPerWeek: 3 }],
    });
    expect(result.conflicts).toEqual([]);
    const daysUsed = new Set(result.placements.map((p) => p.dayOfWeek));
    expect(daysUsed.size).toBe(3);
  });

  it("respects already-placed lessons", () => {
    const input = smallSchool();
    input.existing = [{ teacherId: "t-eng", classId: "p5a", dayOfWeek: 1, periodNumber: 1 }];
    const result = solveTimetable(input);
    expect(result.conflicts).toEqual([]);
    // The pre-existing slot must not be double-booked for either side
    const clash = result.placements.filter(
      (p) => (p.teacherId === "t-eng" || p.classId === "p5a") && p.dayOfWeek === 1 && p.periodNumber === 1,
    );
    expect(clash).toEqual([]);
  });

  it("shares load across multiple eligible teachers", () => {
    const result = solveTimetable({
      days: DAYS,
      periodsPerDay: 6,
      teachers: [{ id: "t1" }, { id: "t2" }],
      requirements: [{ classId: "c1", subjectId: "s1", teacherIds: ["t1", "t2"], periodsPerWeek: 10 }],
    });
    expect(result.conflicts).toEqual([]);
    const perTeacher = new Map<string, number>();
    for (const p of result.placements) perTeacher.set(p.teacherId, (perTeacher.get(p.teacherId) || 0) + 1);
    expect(perTeacher.get("t1")).toBe(5);
    expect(perTeacher.get("t2")).toBe(5);
  });
});
