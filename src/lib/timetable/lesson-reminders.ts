export interface TimedLesson {
  id: string;
  start_time: string | null;
}

export interface LessonReminderTime<T extends TimedLesson> {
  lesson: T;
  startsAt: Date;
  dueAt: Date;
}

function parseClockTime(value: string | null): { hours: number; minutes: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** Find the next future lesson and set its reminder time, clamped to now. */
export function getNextLessonReminder<T extends TimedLesson>(
  lessons: T[],
  now: Date,
  leadMinutes = 5,
): LessonReminderTime<T> | null {
  const nowMs = now.getTime();
  const upcoming = lessons
    .flatMap((lesson) => {
      const clock = parseClockTime(lesson.start_time);
      if (!clock) return [];
      const startsAt = new Date(now);
      startsAt.setHours(clock.hours, clock.minutes, 0, 0);
      if (startsAt.getTime() <= nowMs) return [];
      return [{ lesson, startsAt }];
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];

  if (!upcoming) return null;
  const dueAt = new Date(Math.max(nowMs, upcoming.startsAt.getTime() - Math.max(0, leadMinutes) * 60_000));
  return { ...upcoming, dueAt };
}
