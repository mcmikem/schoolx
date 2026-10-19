import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  createServiceRoleClientOrThrow,
  handleApiError,
  requireUserWithSchool,
} from "@/lib/api-utils";
import { loadFeeClearanceMap } from "@/lib/server/fee-clearance";

export const dynamic = "force-dynamic";

/**
 * Fee clearance for one pupil, from the same engine the bursar's screen uses.
 * The parent portal asks this before releasing a report card: the card is the
 * lawful lever, never the exam sitting.
 *
 * Runs on the service role because a parent cannot (and must not) read the
 * school's full fee_adjustments set to work this out client-side.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const schoolId = auth.context.schoolId;
    if (!schoolId) return apiError("No school linked to this account", 400);

    const studentId = new URL(request.url).searchParams.get("studentId");
    if (!studentId) return apiError("studentId is required", 400);

    const supabase = createServiceRoleClientOrThrow();

    const { data: student } = await supabase.from("students").select("id, school_id").eq("id", studentId).maybeSingle();

    if (!student || student.school_id !== schoolId) return apiError("Student not found", 404);

    // A parent may only ask about a child linked to their account.
    if (auth.context.user.role === "parent") {
      const { data: link } = await supabase
        .from("parent_students")
        .select("student_id")
        .eq("parent_id", auth.context.user.id)
        .eq("student_id", studentId)
        .maybeSingle();
      if (!link) return apiError("Not authorized for this pupil", 403);
    }

    const map = await loadFeeClearanceMap(supabase, schoolId, { studentIds: [studentId] });
    const record = map.get(studentId);

    return apiSuccess({
      studentId,
      isCleared: record?.isCleared ?? true,
      balance: record?.balance ?? 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
