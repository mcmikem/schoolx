import { getLocalDateString } from "@/lib/hooks/utils";

export interface Homework {
  id: string;
  title: string;
  description: string;
  subject_id: string;
  class_id: string;
  due_date: string;
  marks: number;
  status: string;
  created_by: string;
  created_at: string;
  subjects?: { name: string; code: string };
  classes?: { name: string };
}

/** The shape the create form holds, shared with the duplicate helper. */
export interface HomeworkDraft {
  title: string;
  description: string;
  subject_id: string;
  class_id: string;
  due_date: string;
  marks: number;
}

export function parseHomeworkDueDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Opens the create form pre-filled from an existing test (scenario #28).
 *
 *  The due date is rolled forward by the source's own gap to today rather than
 *  copied verbatim: a duplicate of last term's test, keeping the old due date,
 *  lands as instantly overdue and looks like a bug to the teacher. */
export function duplicateHomeworkDraft(source: Homework, today: Date): HomeworkDraft {
  const originalDue = parseHomeworkDueDate(source.due_date);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const gapDays = Math.max(0, Math.round((originalDue.getTime() - todayStart.getTime()) / 86_400_000));
  const nextDue = new Date(todayStart);
  nextDue.setDate(nextDue.getDate() + gapDays);

  return {
    title: `${source.title} (copy)`,
    description: source.description,
    subject_id: source.subject_id,
    class_id: source.class_id,
    // Local formatter, not toISOString(): this box is ahead of UTC, so
    // converting local midnight to UTC shifts the date back a day.
    due_date: getLocalDateString(nextDue),
    marks: source.marks,
  };
}
