import { readFileSync } from "fs";

/**
 * Regression cover for the marks-entry data-integrity fixes.
 *
 * All four were silent-failure bugs: nothing errored, the teacher just lost
 * work or wrote it somewhere it did not belong.
 */

const src = readFileSync("src/app/dashboard/grades/page.tsx", "utf8");

describe("CA lock covers every CA type", () => {
  it("derives the CA list once instead of hardcoding it twice", () => {
    // Lock and unlock used to hardcode different lists (ca1-ca3 vs ca1-ca4),
    // so CA4 was never locked and stayed editable after "CA locked".
    expect(src).toContain("const CA_ASSESSMENT_TYPES = ASSESSMENT_TYPES.filter");
    const lockSites = src.match(/\.in\("assessment_type", \[\.\.\.CA_ASSESSMENT_TYPES\]\)/g) ?? [];
    expect(lockSites).toHaveLength(2);
  });

  it("includes ca4 in the derived list", () => {
    const types = ["ca1", "ca2", "ca3", "ca4", "project", "exam", "competency", "u1", "u2", "eot"].filter((t) =>
      t.startsWith("ca"),
    );
    expect(types).toEqual(["ca1", "ca2", "ca3", "ca4"]);
  });
});

describe("the 30s flush cannot file a mark under the wrong subject", () => {
  it("records the destination subject when a cell goes dirty", () => {
    // dirtyCellsRef was a Set of "studentId_type" with no subject, so a flush
    // after switching subjects wrote the old sheet's mark into the new one.
    expect(src).toContain("studentId: string; assessmentType: string");
    expect(src).toContain("dirtyCellsRef.current.set(");
  });

  it("passes the recorded destination into the autosave", () => {
    expect(src).toContain("debouncedAutoSave(target.studentId, target.assessmentType, target)");
    expect(src).toContain("const subjectId = target?.subjectId ?? selectedSubject");
    expect(src).toContain("const classId = target?.classId ?? selectedClass");
  });

  it("writes to the recorded subject, not the current one", () => {
    expect(src).toContain("subject_id: subjectId,");
    expect(src).toContain("class_id: classId,");
  });
});

describe("teacher pickers are scoped to real assignments", () => {
  it("filters both class and subject options for class-scoped roles", () => {
    // Both pickers previously listed every class and subject in the school;
    // the assignment check only ran inside the 500ms autosave, so a teacher
    // could fill a 40-cell grid and lose all of it.
    expect(src).toContain("const classOptions = teacherScoped");
    expect(src).toContain("const subjectOptions =");
    expect(src).toContain("classOptions.map");
    expect(src).toContain("subjectOptions.map");
  });
});

describe("a locked term blocks end-of-term marks", () => {
  it("reads the term lock like the exams page does", () => {
    expect(src).toContain("isTermLocked");
    expect(src).toContain("const termLocked = isTermLocked ? isTermLocked(academicYear, currentTerm) : false;");
  });

  it("blocks edits in the change handler and the autosave", () => {
    // BOT, MOT and EOT are the assessments a term actually closes on, so the
    // lock has to cover all three. It used to test `type === "exam"`, a legacy
    // column that the BOT/MOT/EOT model leaves empty for most teachers -- so the
    // guard existed but almost never fired. Both edit paths must agree.
    const guards = src.match(/termLocked && \["exam", "bot", "mid_term", "eot"\]\.includes\(type\)/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("This term is locked. Assessment marks can no longer be changed.");
  });

  it("blocks the bulk save when any end-of-term mark is present", () => {
    expect(src).toContain("const hasTermMarks");
    expect(src).toContain("TRADITIONAL_ASSESSMENT_TYPES.some((type) => key.endsWith(`_${type}`))");
    expect(src).toContain("This term is locked. BOT, MOT, and EOT marks can no longer be changed.");
  });

  it("greys the affected cells", () => {
    // Whitespace-insensitive on purpose. This assertion used to match one long
    // `disabled={...}` line, and biome's formatter later wrapped it across
    // three lines — the guard was still correct, the test just went red. Both
    // the desktop grid and the mobile card view have to disable these cells.
    const flat = src.replace(/\s+/g, " ");
    const disabled =
      flat.match(
        /isSubmitted \|\| \(caLocked && type\.startsWith\("ca"\)\) \|\| \(termLocked && \["exam", "bot", "mid_term", "eot"\]\.includes\(type\)\)/g,
      ) ?? [];
    expect(disabled.length).toBeGreaterThanOrEqual(2);
  });
});

describe("pupils missing from the roster are surfaced, not dropped", () => {
  it("counts students with no class_id", () => {
    expect(src).toContain("const unassignedStudents = useMemo(");
    expect(src).toContain("classStudents.filter((s) => !s.class_id)");
  });

  it("renders a warning instead of a silently short sheet", () => {
    expect(src).toContain("not assigned to any class");
    expect(src).toContain("They will not appear on this mark sheet");
  });
});
