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
    const types = ["ca1", "ca2", "ca3", "ca4", "project", "exam", "competency", "u1", "u2", "eot"].filter(
      (t) => t.startsWith("ca"),
    );
    expect(types).toEqual(["ca1", "ca2", "ca3", "ca4"]);
  });
});

describe("the 30s flush cannot file a mark under the wrong subject", () => {
  it("records the destination subject when a cell goes dirty", () => {
    // dirtyCellsRef was a Set of "studentId_type" with no subject, so a flush
    // after switching subjects wrote the old sheet's mark into the new one.
    expect(src).toContain("useRef<Map<string, { subjectId: string; classId: string }>>");
    expect(src).toContain("dirtyCellsRef.current.set(");
  });

  it("passes the recorded destination into the autosave", () => {
    expect(src).toContain("debouncedAutoSave(studentId, type, target)");
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

describe("a locked term blocks exam marks", () => {
  it("reads the term lock like the exams page does", () => {
    expect(src).toContain("isTermLocked");
    expect(src).toContain("const termLocked = isTermLocked ? isTermLocked(academicYear, currentTerm) : false;");
  });

  it("blocks exam edits in the change handler, the autosave and the bulk save", () => {
    expect(src).toContain('if (termLocked && type === "exam")');
    expect(src).toContain("This term is locked. Exam marks can no longer be changed.");
    expect(src).toContain('k.endsWith("_exam")');
  });

  it("greys the exam cells", () => {
    const disabled = src.match(/disabled=\{isSubmitted \|\| \(caLocked && type\.startsWith\("ca"\)\) \|\| \(termLocked && type === "exam"\)\}/g) ?? [];
    expect(disabled.length).toBeGreaterThanOrEqual(3);
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