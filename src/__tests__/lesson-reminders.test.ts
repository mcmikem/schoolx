import { getNextLessonReminder } from "@/lib/timetable/lesson-reminders";

describe("getNextLessonReminder", () => {
  const now = new Date(2026, 10, 10, 9, 0, 0);
  const lessons = [
    { id: "later", start_time: "10:00:00" },
    { id: "past", start_time: "08:00:00" },
    { id: "soon", start_time: "09:03:00" },
    { id: "untimed", start_time: null },
  ];

  it("selects the soonest future lesson regardless of input ordering", () => {
    const result = getNextLessonReminder(lessons, now);
    expect(result?.lesson.id).toBe("soon");
    expect(result?.startsAt.getHours()).toBe(9);
    expect(result?.startsAt.getMinutes()).toBe(3);
  });

  it("fires immediately when the lesson begins in less than the lead time", () => {
    const result = getNextLessonReminder(lessons, now);
    expect(result?.dueAt.getTime()).toBe(now.getTime());
  });

  it("uses the five-minute lead for a later lesson", () => {
    const result = getNextLessonReminder([{ id: "later", start_time: "10:00" }], now);
    expect(result?.dueAt.getHours()).toBe(9);
    expect(result?.dueAt.getMinutes()).toBe(55);
  });

  it("returns null when no timed future lesson exists", () => {
    expect(getNextLessonReminder([{ id: "past", start_time: "09:00" }], now)).toBeNull();
    expect(getNextLessonReminder([{ id: "bad", start_time: "29:91" }], now)).toBeNull();
  });
});
