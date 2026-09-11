import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
  withSecurity,
} from "@/lib/api-utils";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import {
  solveTimetable,
  type SolverRequirement,
  type SolverTeacher,
  type SolverExisting,
} from "@/lib/timetable-solver";
import { logger } from "@/lib/logger";

// Timetable auto-generator API (ROADMAP #29, slice 2).
//   action "preview": read classes / teacher_subjects / slots / constraints /
//     existing teacher_timetable rows, run the pure solver, return a draft.
//     Writes nothing.
//   action "approve": validate a placement set (school scope, no clashes) and
//     insert it into teacher_timetable. The UI previews first; nothing is
//     generated into the DB without explicit approval.

const TIMETABLE_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "dean_of_studies"];
const MAX_PLACEMENTS = 2000;
const TIMEOUT_MS = 15000;

interface PreviewBody {
  action: "preview";
  schoolId?: string;
  academicYear: string;
  days?: number[];
  periodsPerDay?: number;
  periodsDefault?: number;
  periodsPerSubject?: Record<string, number>;
  teacherCaps?: Record<string, number>;
  requirements?: Array<{
    classId: string;
    subjectId: string;
    teacherIds: string[];
    periodsPerWeek: number;
  }>;
}

interface ApprovePlacement {
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  periodNumber: number;
  room?: string | null;
}

interface ApproveBody {
  action: "approve";
  schoolId?: string;
  academicYear: string;
  placements: ApprovePlacement[];
}

function isTimeout(result: unknown): boolean {
  return (result as { status?: number })?.status === 408;
}

async function handlePost(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: TIMETABLE_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const body = (await request.json()) as PreviewBody | ApproveBody;
    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: body.schoolId || auth.context.schoolId,
    });
    if (!scope.ok) return scope.response;

    if (!body.academicYear || typeof body.academicYear !== "string") {
      return apiError("academicYear is required", 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    if (body.action === "preview") return previewDraft(supabase, scope.schoolId, body);
    if (body.action === "approve")
      return approveDraft(supabase, scope.schoolId, body, {
        id: auth.context.user.id,
        fullName: auth.context.user.full_name,
      });
    return apiError('Unknown action. Use "preview" or "approve".', 400);
  } catch (error) {
    return handleApiError(error);
  }
}

// oxlint not used in this repo (Biome); supabase client is untyped here
// because timetable tables are resolved dynamically.
async function previewDraft(supabase: any, schoolId: string, body: PreviewBody) {
  const days = body.days && body.days.length > 0 ? body.days : [1, 2, 3, 4, 5];

  const [classesRes, subjectsRes, usersRes, linksRes, slotsRes, constraintsRes] = await Promise.all([
    withTimeout(
      supabase
        .from("classes")
        .select("id, name, level")
        .eq("school_id", schoolId)
        .eq("academic_year", body.academicYear),
      TIMEOUT_MS,
      timeoutFallback(),
    ),
    withTimeout(
      supabase.from("subjects").select("id, name, code").eq("school_id", schoolId),
      TIMEOUT_MS,
      timeoutFallback(),
    ),
    withTimeout(
      supabase.from("users").select("id, full_name").eq("school_id", schoolId).eq("is_active", true),
      TIMEOUT_MS,
      timeoutFallback(),
    ),
    withTimeout(
      supabase.from("teacher_subjects").select("teacher_id, subject_id, class_id"),
      TIMEOUT_MS,
      timeoutFallback(),
    ),
    withTimeout(
      supabase
        .from("timetable_slots")
        .select("id, order_number, is_lesson")
        .eq("school_id", schoolId)
        .order("order_number", { ascending: true }),
      TIMEOUT_MS,
      timeoutFallback(),
    ),
    withTimeout(
      supabase.from("timetable_constraints").select("teacher_id, day_of_week, slot_id").eq("school_id", schoolId),
      TIMEOUT_MS,
      timeoutFallback(),
    ),
  ]);

  if ([classesRes, subjectsRes, usersRes, linksRes, slotsRes, constraintsRes].some(isTimeout)) {
    return apiError("Request timed out loading timetable data. Please try again.", 504);
  }

  const classes = (classesRes.data || []) as { id: string; name: string; level: string }[];
  if (classes.length === 0) {
    return apiError(`No classes found for academic year ${body.academicYear}`, 404);
  }
  const classIds = new Set(classes.map((c) => c.id));
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const subjects = (subjectsRes.data || []) as { id: string; name: string; code: string }[];
  const subjectName = new Map(subjects.map((s) => [s.id, `${s.name} (${s.code})`]));

  const schoolUsers = (usersRes.data || []) as { id: string; full_name: string }[];
  const schoolUserIds = new Set(schoolUsers.map((u) => u.id));
  const teacherName = new Map(schoolUsers.map((u) => [u.id, u.full_name]));

  // teacher_subjects has no school_id: scope links to this school's classes
  // and teachers.
  const links = ((linksRes.data || []) as { teacher_id: string; subject_id: string; class_id: string }[]).filter(
    (l) => classIds.has(l.class_id) && schoolUserIds.has(l.teacher_id),
  );

  const lessonSlots = ((slotsRes.data || []) as { id: string; order_number: number; is_lesson: boolean }[]).filter(
    (s) => s.is_lesson !== false,
  );
  const slotOrder = new Map(lessonSlots.map((s, i) => [s.id, i + 1]));
  const periodsPerDay = lessonSlots.length > 0 ? lessonSlots.length : body.periodsPerDay || 8;

  const constraints = (constraintsRes.data || []) as {
    teacher_id: string;
    day_of_week: number;
    slot_id: string;
  }[];
  const unavailableByTeacher = new Map<string, string[]>();
  for (const c of constraints) {
    const period = slotOrder.get(c.slot_id);
    if (!period) continue;
    const list = unavailableByTeacher.get(c.teacher_id) || [];
    list.push(`${c.day_of_week}:${period}`);
    unavailableByTeacher.set(c.teacher_id, list);
  }

  const teacherIds = new Set<string>();
  for (const l of links) teacherIds.add(l.teacher_id);

  const existingRes = await withTimeout(
    teacherIds.size === 0 && classes.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("teacher_timetable")
          .select("teacher_id, class_id, day_of_week, period_number")
          .eq("academic_year", body.academicYear)
          .or(
            `class_id.in.(${classes.map((c) => c.id).join(",")}),teacher_id.in.(${[...teacherIds].join(",") || "00000000-0000-0000-0000-000000000000"})`,
          ),
    TIMEOUT_MS,
    timeoutFallback(),
  );
  if (isTimeout(existingRes)) {
    return apiError("Request timed out loading existing lessons. Please try again.", 504);
  }
  const existing = ((existingRes.data || []) as SolverExisting[]).map((e) => ({
    teacherId: e.teacherId,
    classId: e.classId,
    dayOfWeek: e.dayOfWeek,
    periodNumber: e.periodNumber,
  }));

  let requirements: SolverRequirement[];
  if (body.requirements) {
    requirements = body.requirements
      .filter((r) => r && classIds.has(r.classId) && r.periodsPerWeek > 0)
      .map((r) => ({
        classId: r.classId,
        subjectId: r.subjectId,
        teacherIds: (r.teacherIds || []).filter((id) => schoolUserIds.has(id)),
        periodsPerWeek: Math.min(Math.floor(r.periodsPerWeek), 40),
      }));
  } else {
    const periodsDefault = body.periodsDefault ?? 4;
    const grouped = new Map<string, { classId: string; subjectId: string; teacherIds: string[] }>();
    for (const l of links) {
      const k = `${l.class_id}|${l.subject_id}`;
      const g = grouped.get(k) || { classId: l.class_id, subjectId: l.subject_id, teacherIds: [] };
      if (!g.teacherIds.includes(l.teacher_id)) g.teacherIds.push(l.teacher_id);
      grouped.set(k, g);
    }
    requirements = [...grouped.values()].map((g) => ({
      ...g,
      periodsPerWeek: body.periodsPerSubject?.[g.subjectId] ?? periodsDefault,
    }));
  }

  if (requirements.length === 0) {
    return apiError(
      "No timetable requirements: assign teachers to class subjects first (or send explicit requirements).",
      400,
    );
  }

  const solverTeachers: SolverTeacher[] = [...teacherIds].map((id) => ({
    id,
    maxPeriodsPerWeek: body.teacherCaps?.[id],
    unavailable: unavailableByTeacher.get(id) || [],
  }));
  // Teachers referenced only by explicit requirements still need entries.
  for (const r of requirements) {
    for (const id of r.teacherIds) {
      if (!solverTeachers.some((t) => t.id === id)) {
        solverTeachers.push({ id, maxPeriodsPerWeek: body.teacherCaps?.[id], unavailable: [] });
      }
    }
  }

  const result = solveTimetable({ requirements, teachers: solverTeachers, days, periodsPerDay, existing });

  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return apiSuccess({
    academicYear: body.academicYear,
    days,
    periodsPerDay,
    slotsDefined: lessonSlots.length > 0,
    placements: result.placements.map((p) => ({
      ...p,
      className: className.get(p.classId) || p.classId,
      subjectName: subjectName.get(p.subjectId) || p.subjectId,
      teacherName: teacherName.get(p.teacherId) || p.teacherId,
      dayName: dayNames[p.dayOfWeek] || `Day ${p.dayOfWeek}`,
    })),
    conflicts: result.conflicts.map((c) => ({
      ...c,
      className: className.get(c.classId) || c.classId,
      subjectName: subjectName.get(c.subjectId) || c.subjectId,
    })),
    stats: {
      placed: result.placements.length,
      unplaced: result.conflicts.reduce((s, c) => s + c.periodsUnplaced, 0),
    },
  });
}

async function approveDraft(
  supabase: any,
  schoolId: string,
  body: ApproveBody,
  actor: { id: string; fullName: string },
) {
  const placements = body.placements || [];
  if (placements.length === 0) return apiError("No placements to approve", 400);
  if (placements.length > MAX_PLACEMENTS) {
    return apiError(`Too many placements (max ${MAX_PLACEMENTS})`, 400);
  }

  const [classesRes, subjectsRes, usersRes, slotsRes] = await Promise.all([
    withTimeout(
      supabase.from("classes").select("id").eq("school_id", schoolId).eq("academic_year", body.academicYear),
      TIMEOUT_MS,
      timeoutFallback(),
    ),
    withTimeout(supabase.from("subjects").select("id").eq("school_id", schoolId), TIMEOUT_MS, timeoutFallback()),
    withTimeout(supabase.from("users").select("id").eq("school_id", schoolId), TIMEOUT_MS, timeoutFallback()),
    withTimeout(
      supabase
        .from("timetable_slots")
        .select("order_number, start_time, end_time, is_lesson")
        .eq("school_id", schoolId)
        .order("order_number", { ascending: true }),
      TIMEOUT_MS,
      timeoutFallback(),
    ),
  ]);
  if ([classesRes, subjectsRes, usersRes, slotsRes].some(isTimeout)) {
    return apiError("Request timed out loading timetable data. Please try again.", 504);
  }

  const validClasses = new Set(((classesRes.data || []) as { id: string }[]).map((c) => c.id));
  const validSubjects = new Set(((subjectsRes.data || []) as { id: string }[]).map((s) => s.id));
  const validTeachers = new Set(((usersRes.data || []) as { id: string }[]).map((u) => u.id));
  const lessonSlots = (
    (slotsRes.data || []) as {
      order_number: number;
      start_time: string;
      end_time: string;
      is_lesson: boolean;
    }[]
  ).filter((s) => s.is_lesson !== false);

  if (lessonSlots.length === 0) {
    return apiError("Define lesson periods in timetable slots before approving a generated draft.", 400);
  }

  const invalid = placements.filter(
    (p) =>
      !validClasses.has(p.classId) ||
      !validSubjects.has(p.subjectId) ||
      !validTeachers.has(p.teacherId) ||
      !Number.isInteger(p.dayOfWeek) ||
      p.dayOfWeek < 1 ||
      p.dayOfWeek > 7 ||
      !Number.isInteger(p.periodNumber) ||
      p.periodNumber < 1 ||
      p.periodNumber > lessonSlots.length,
  );
  if (invalid.length > 0) {
    return apiError(`${invalid.length} placement(s) reference unknown classes, subjects, teachers, or periods.`, 400);
  }

  // Within-batch duplicates + clashes against the live timetable.
  const seenTeacher = new Set<string>();
  const seenClass = new Set<string>();
  const batchClashes: string[] = [];
  for (const p of placements) {
    const t = `${p.teacherId}|${p.dayOfWeek}:${p.periodNumber}`;
    const c = `${p.classId}|${p.dayOfWeek}:${p.periodNumber}`;
    if (seenTeacher.has(t) || seenClass.has(c)) batchClashes.push(`${p.dayOfWeek}:${p.periodNumber}`);
    seenTeacher.add(t);
    seenClass.add(c);
  }
  if (batchClashes.length > 0) {
    return apiError(
      `Draft contains ${batchClashes.length} internal clash(es) at ${batchClashes.slice(0, 5).join(", ")}.`,
      409,
    );
  }

  const involvedTeachers = [...new Set(placements.map((p) => p.teacherId))];
  const involvedClasses = [...new Set(placements.map((p) => p.classId))];
  const liveRes = await withTimeout(
    supabase
      .from("teacher_timetable")
      .select("teacher_id, class_id, day_of_week, period_number")
      .eq("academic_year", body.academicYear)
      .or(`class_id.in.(${involvedClasses.join(",")}),teacher_id.in.(${involvedTeachers.join(",")})`),
    TIMEOUT_MS,
    timeoutFallback(),
  );
  if (isTimeout(liveRes)) {
    return apiError("Request timed out checking for clashes. Nothing was written; please try again.", 504);
  }
  const liveTeacher = new Set(
    ((liveRes.data || []) as { teacher_id: string; day_of_week: number; period_number: number }[]).map(
      (r) => `${r.teacher_id}|${r.day_of_week}:${r.period_number}`,
    ),
  );
  const liveClass = new Set(
    ((liveRes.data || []) as { class_id: string; day_of_week: number; period_number: number }[]).map(
      (r) => `${r.class_id}|${r.day_of_week}:${r.period_number}`,
    ),
  );
  const clashes = placements.filter(
    (p) =>
      liveTeacher.has(`${p.teacherId}|${p.dayOfWeek}:${p.periodNumber}`) ||
      liveClass.has(`${p.classId}|${p.dayOfWeek}:${p.periodNumber}`),
  );
  if (clashes.length > 0) {
    return apiError(
      `${clashes.length} placement(s) clash with the live timetable. Regenerate the preview to account for recent changes.`,
      409,
    );
  }

  const rows = placements.map((p) => {
    const slot = lessonSlots[p.periodNumber - 1];
    return {
      teacher_id: p.teacherId,
      class_id: p.classId,
      subject_id: p.subjectId,
      day_of_week: p.dayOfWeek,
      period_number: p.periodNumber,
      start_time: slot.start_time,
      end_time: slot.end_time,
      room: p.room?.trim() || null,
      academic_year: body.academicYear,
    };
  });

  const insertRes = await withTimeout(
    supabase.from("teacher_timetable").insert(rows).select("id"),
    30000,
    timeoutFallback(),
  );
  if (isTimeout(insertRes)) {
    return apiError("Request timed out writing the timetable. Check the timetable page before retrying.", 504);
  }
  if (insertRes.error) {
    logger.error("[timetable/generate] Approve insert failed:", insertRes.error);
    return apiError("Failed to save the approved timetable.", 500);
  }

  const inserted = ((insertRes.data || []) as { id: string }[]).length;
  try {
    await supabase.from("audit_log").insert({
      school_id: schoolId,
      user_id: actor.id,
      user_name: actor.fullName,
      action: "create",
      module: "timetable",
      description: `Approved generated timetable (${inserted} lessons, ${body.academicYear})`,
      new_value: { academicYear: body.academicYear, inserted },
    });
  } catch (auditErr) {
    logger.warn("[timetable/generate] Audit log write failed:", auditErr);
  }

  return apiSuccess(
    { inserted, academicYear: body.academicYear },
    `Timetable approved: ${inserted} lessons saved`,
    201,
  );
}

export const POST = withSecurity(handlePost, {
  rateLimit: { limit: 20, windowMs: 60000 },
});
