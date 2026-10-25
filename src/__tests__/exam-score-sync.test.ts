import { syncMarkedPaperToExamScores, type PaperExamSummary } from "@/lib/exam/score-sync";

const exam: PaperExamSummary = {
  id: "exam-1",
  exam_type: "class_test",
  class_id: "class-1",
  subject_id: "subject-1",
  term: 2,
  academic_year: "2026",
  max_score: 80,
};

function makeClient(
  options: {
    byExam?: { id: string } | null;
    composite?: Array<{ id: string }>;
    failOn?: "update" | "insert" | "grades";
  } = {},
) {
  const calls: {
    updatedIds: string[];
    updatedRows: any[];
    inserted: any[];
    upserted: any[];
    lookupKeys: Array<{ table: string; filters: Array<[string, string, unknown]> }>;
  } = { updatedIds: [], updatedRows: [], inserted: [], upserted: [], lookupKeys: [] };

  const scores = () => {
    const filters: Array<[string, string, unknown]> = [];
    const query: any = {
      select: () => query,
      eq: (col: string, value: unknown) => {
        filters.push(["eq", col, value]);
        return query;
      },
      is: (col: string, value: unknown) => {
        filters.push(["is", col, value]);
        return query;
      },
      limit: async () => {
        calls.lookupKeys.push({ table: "exam_scores", filters: [...filters] });
        return { data: options.composite ?? [], error: null };
      },
      maybeSingle: async () => {
        calls.lookupKeys.push({ table: "exam_scores", filters: [...filters] });
        return { data: options.byExam ?? null, error: null };
      },
      update: (row: any) => ({
        eq: async (_col: string, id: string) => {
          calls.updatedIds.push(id);
          calls.updatedRows.push(row);
          return { error: options.failOn === "update" ? { message: "update exploded" } : null };
        },
      }),
      insert: async (row: any) => {
        calls.inserted.push(row);
        return { error: options.failOn === "insert" ? { message: "insert exploded" } : null };
      },
      upsert: async (row: any) => {
        calls.upserted.push(row);
        return { error: options.failOn === "grades" ? { message: "grades exploded" } : null };
      },
    };
    return query;
  };

  const client: any = {
    from: (table: string) =>
      table === "grades"
        ? {
            upsert: async (row: any) => {
              calls.upserted.push(row);
              return { error: options.failOn === "grades" ? { message: "grades exploded" } : null };
            },
          }
        : scores(),
  };

  return { client, calls };
}

describe("syncMarkedPaperToExamScores", () => {
  it("refuses marks outside the paper's own total and writes nothing", async () => {
    const { client, calls } = makeClient();
    const result = await syncMarkedPaperToExamScores(client, {
      studentId: "student-1",
      exam,
      marks: 95,
      recordedBy: "teacher-1",
    });
    expect(result).toEqual({ ok: false, error: "Marks must be between 0 and 80" });
    expect(calls.inserted).toHaveLength(0);
    expect(calls.updatedIds).toHaveLength(0);
    expect(calls.upserted).toHaveLength(0);
  });

  it("updates the row already keyed to this exam", async () => {
    const { client, calls } = makeClient({ byExam: { id: "score-9" } });
    const result = await syncMarkedPaperToExamScores(client, {
      studentId: "student-1",
      exam,
      marks: 64,
      recordedBy: "teacher-1",
    });
    expect(result.ok).toBe(true);
    expect(calls.updatedIds).toEqual(["score-9"]);
    expect(calls.updatedRows[0]).toMatchObject({
      student_id: "student-1",
      exam_id: "exam-1",
      score: 64,
      max_score: 80,
      recorded_by: "teacher-1",
    });
    expect(calls.inserted).toHaveLength(0);
  });

  it("falls back to the Exams-page composite key when no row names this exam", async () => {
    const { client, calls } = makeClient({ byExam: null, composite: [{ id: "score-page" }] });
    const result = await syncMarkedPaperToExamScores(client, {
      studentId: "student-1",
      exam,
      marks: 64,
      recordedBy: "teacher-1",
    });
    expect(result.ok).toBe(true);
    expect(calls.updatedIds).toEqual(["score-page"]);
    const composite = calls.lookupKeys[1];
    expect(composite.filters).toEqual(
      expect.arrayContaining([
        ["eq", "student_id", "student-1"],
        ["eq", "exam_type", "class_test"],
        ["eq", "subject_id", "subject-1"],
        ["eq", "term", 2],
        ["eq", "academic_year", "2026"],
      ]),
    );
  });

  it("inserts a first score when nothing matches either key", async () => {
    const { client, calls } = makeClient({ byExam: null, composite: [] });
    const result = await syncMarkedPaperToExamScores(client, {
      studentId: "student-1",
      exam,
      marks: 12,
      recordedBy: null,
    });
    expect(result.ok).toBe(true);
    expect(calls.inserted).toHaveLength(1);
    expect(calls.inserted[0]).toMatchObject({ exam_type: "class_test", score: 12, recorded_by: null });
    // interim exams must not touch the report-card grades slot
    expect(calls.upserted).toHaveLength(0);
  });

  it("asks for NULL explicitly when a nullable key column is empty", async () => {
    const { client, calls } = makeClient({
      byExam: null,
      composite: [],
    });
    await syncMarkedPaperToExamScores(client, {
      studentId: "student-1",
      exam: { ...exam, subject_id: null, term: null, academic_year: null },
      marks: 10,
      recordedBy: null,
    });
    const composite = calls.lookupKeys[1];
    expect(composite.filters).toEqual(
      expect.arrayContaining([
        ["is", "subject_id", null],
        ["is", "term", null],
        ["is", "academic_year", null],
      ]),
    );
  });

  it("writes the report-card grades slot for a terminal exam only", async () => {
    const { client, calls } = makeClient({ byExam: { id: "score-1" } });
    const result = await syncMarkedPaperToExamScores(client, {
      studentId: "student-1",
      exam: { ...exam, exam_type: "eot" },
      marks: 77,
      recordedBy: "teacher-1",
    });
    expect(result.ok).toBe(true);
    expect(calls.upserted).toHaveLength(1);
    expect(calls.upserted[0]).toMatchObject({
      student_id: "student-1",
      subject_id: "subject-1",
      assessment_type: "exam",
      score: 77,
      term: 2,
      academic_year: "2026",
    });
  });

  it("reports a write failure instead of pretending the mark counted", async () => {
    const { client } = makeClient({ byExam: { id: "score-1" }, failOn: "update" });
    const result = await syncMarkedPaperToExamScores(client, {
      studentId: "student-1",
      exam,
      marks: 50,
      recordedBy: "teacher-1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("update exploded");
  });
});
