// Timetable auto-generator — pure constraint solver (ROADMAP #29, slice 1).
// No Supabase, no React. The API route + UI (slice 2) will feed DB rows in
// and write `teacher_timetable` rows out after human approval.
//
// Model matches the existing schema:
//   lessons -> teacher_timetable (teacher_id, class_id, subject_id,
//     day_of_week 1-7, period_number)
//   teacher unavailability -> timetable_constraints ('unavailable')
//
// Algorithm: deterministic greedy, most-constrained requirement first.
// For each required period, scan days 1..N x periods 1..P and take the first
// slot where the class is free and the least-loaded eligible teacher is free,
// available, and under their weekly cap. Same-subject-same-day repeats are
// avoided when a spread slot exists. Anything unplaceable is reported as a
// conflict with a human-readable reason — never silently dropped.

export interface SolverRequirement {
  classId: string;
  subjectId: string;
  /** Eligible teacher ids, highest priority first. Empty = unplaceable. */
  teacherIds: string[];
  periodsPerWeek: number;
}

export interface SolverTeacher {
  id: string;
  /** Max lessons/week. Defaults to Infinity when omitted. */
  maxPeriodsPerWeek?: number;
  /** "day:period" pairs, e.g. "1:3" = Monday period 3. */
  unavailable?: string[];
}

export interface SolverExisting {
  teacherId: string;
  classId: string;
  dayOfWeek: number;
  periodNumber: number;
}

export interface SolverPlacement {
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  periodNumber: number;
}

export interface SolverConflict {
  classId: string;
  subjectId: string;
  periodsUnplaced: number;
  reason: string;
}

export interface SolverInput {
  requirements: SolverRequirement[];
  teachers: SolverTeacher[];
  /** e.g. [1,2,3,4,5] for Mon-Fri. */
  days: number[];
  periodsPerDay: number;
  existing?: SolverExisting[];
}

export interface SolverResult {
  placements: SolverPlacement[];
  conflicts: SolverConflict[];
}

const key = (day: number, period: number) => `${day}:${period}`;

export function solveTimetable(input: SolverInput): SolverResult {
  const { days, periodsPerDay } = input;
  const teachers = new Map(input.teachers.map((t) => [t.id, t]));
  const load = new Map<string, number>();
  const teacherBusy = new Set<string>(); // `${teacherId}|${day}:${period}`
  const classBusy = new Set<string>(); // `${classId}|${day}:${period}`
  const classSubjectDays = new Map<string, Set<number>>(); // `${classId}|${subjectId}` -> days used

  for (const e of input.existing || []) {
    teacherBusy.add(`${e.teacherId}|${key(e.dayOfWeek, e.periodNumber)}`);
    classBusy.add(`${e.classId}|${key(e.dayOfWeek, e.periodNumber)}`);
    load.set(e.teacherId, (load.get(e.teacherId) || 0) + 1);
  }

  const placements: SolverPlacement[] = [];
  const conflicts: SolverConflict[] = [];

  const isAvailable = (t: SolverTeacher, day: number, period: number): boolean =>
    !(t.unavailable || []).includes(key(day, period));

  const underCap = (teacherId: string): boolean => {
    const t = teachers.get(teacherId);
    if (!t || t.maxPeriodsPerWeek === undefined) return true;
    return (load.get(teacherId) || 0) < t.maxPeriodsPerWeek;
  };

  // Most-constrained first: fewest eligible teachers, then most periods.
  const ordered = [...input.requirements]
    .filter((r) => r.periodsPerWeek > 0)
    .sort((a, b) => a.teacherIds.length - b.teacherIds.length || b.periodsPerWeek - a.periodsPerWeek);

  for (const req of ordered) {
    if (req.teacherIds.length === 0) {
      conflicts.push({
        classId: req.classId,
        subjectId: req.subjectId,
        periodsUnplaced: req.periodsPerWeek,
        reason: "No eligible teacher assigned to this class/subject",
      });
      continue;
    }

    let unplaced = 0;
    for (let n = 0; n < req.periodsPerWeek; n++) {
      const subjectDays = classSubjectDays.get(`${req.classId}|${req.subjectId}`) || new Set<number>();

      // Least-loaded eligible teacher first (stable: priority order breaks ties).
      const candidates = [...req.teacherIds].sort((a, b) => (load.get(a) || 0) - (load.get(b) || 0));

      let placed = false;
      // Pass 1: avoid repeating the subject on a day the class already has it.
      // Pass 2: take any free slot.
      for (const avoidRepeat of [true, false]) {
        if (placed) break;
        for (const day of days) {
          if (placed) break;
          if (avoidRepeat && subjectDays.has(day)) continue;
          for (let period = 1; period <= periodsPerDay; period++) {
            if (classBusy.has(`${req.classId}|${key(day, period)}`)) continue;
            const teacherId = candidates.find(
              (id) =>
                teachers.has(id) &&
                underCap(id) &&
                isAvailable(teachers.get(id)!, day, period) &&
                !teacherBusy.has(`${id}|${key(day, period)}`),
            );
            if (!teacherId) continue;
            placements.push({
              classId: req.classId,
              subjectId: req.subjectId,
              teacherId,
              dayOfWeek: day,
              periodNumber: period,
            });
            teacherBusy.add(`${teacherId}|${key(day, period)}`);
            classBusy.add(`${req.classId}|${key(day, period)}`);
            load.set(teacherId, (load.get(teacherId) || 0) + 1);
            if (!classSubjectDays.has(`${req.classId}|${req.subjectId}`)) {
              classSubjectDays.set(`${req.classId}|${req.subjectId}`, new Set());
            }
            classSubjectDays.get(`${req.classId}|${req.subjectId}`)!.add(day);
            placed = true;
            break;
          }
        }
      }
      if (!placed) unplaced++;
    }

    if (unplaced > 0) {
      const anyCapacity = req.teacherIds.some((id) => teachers.has(id) && underCap(id));
      conflicts.push({
        classId: req.classId,
        subjectId: req.subjectId,
        periodsUnplaced: unplaced,
        reason: anyCapacity
          ? "No free slot: class timetable is full at every period an eligible teacher is available"
          : "Eligible teachers are fully booked or unavailable for the remaining periods",
      });
    }
  }

  return { placements, conflicts };
}
