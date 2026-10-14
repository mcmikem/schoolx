import { duplicateHomeworkDraft } from "@/lib/homework";

/**
 * Scenario #28: re-setting the same test each week meant retyping it, or
 * copying it outside the app. The first attempt was an `alert()` stub.
 *
 * The interesting part is the due date. A verbatim copy of a test set last
 * term lands as instantly overdue, which reads to the teacher as a bug — so the
 * gap between the source and today is preserved.
 */
describe("duplicateHomeworkDraft", () => {
  const source = {
    id: "hw-1",
    title: "Fractions Practice",
    description: "Exercise 4, questions 1-10",
    subject_id: "sub-math",
    class_id: "class-1",
    due_date: "2026-10-21",
    marks: 20,
    status: "assigned",
    created_by: "user-1",
  } as any;

  const today = new Date(2026, 9, 14); // 14 Oct 2026, local

  it("carries the content fields across unchanged", () => {
    const draft = duplicateHomeworkDraft(source, today);

    expect(draft.description).toBe(source.description);
    expect(draft.subject_id).toBe(source.subject_id);
    expect(draft.class_id).toBe(source.class_id);
    expect(draft.marks).toBe(source.marks);
  });

  it("marks the copy in the title so it is distinguishable in the list", () => {
    expect(duplicateHomeworkDraft(source, today).title).toBe("Fractions Practice (copy)");
  });

  it("does not mutate the source", () => {
    const before = { ...source };
    duplicateHomeworkDraft(source, today);
    expect(source).toEqual(before);
  });

  it("keeps the same gap to the due date instead of copying a stale one", () => {
    // Source is due 21 Oct, today is 14 Oct — a 7-day gap.
    expect(duplicateHomeworkDraft(source, today).due_date).toBe("2026-10-21");
  });

  it("rolls a past-dated source forward rather than duplicating the overdue date", () => {
    // Due 5 Oct but today is 14 Oct: copying the date verbatim would create
    // something born overdue.
    const past = { ...source, due_date: "2026-10-05" };
    expect(duplicateHomeworkDraft(past, today).due_date).toBe("2026-10-14");
  });

  it("preserves a short gap", () => {
    // Due 16 Oct, two days out.
    const soon = { ...source, due_date: "2026-10-16" };
    expect(duplicateHomeworkDraft(soon, today).due_date).toBe("2026-10-16");
  });

  it("returns a YYYY-MM-DD date the <input type=date> accepts", () => {
    expect(duplicateHomeworkDraft(source, today).due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("ignores the time of day when measuring the gap", () => {
    // Late evening must not push the copy a day out.
    const lateToday = new Date(2026, 9, 14, 23, 59);
    expect(duplicateHomeworkDraft(source, lateToday).due_date).toBe("2026-10-21");
  });
});
