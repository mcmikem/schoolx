import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { rateLimit, supabaseClientOptions } from "@/lib/api-utils";
import {
  getNextGradeWorkflowStatusActions,
  getPrevGradeWorkflowStatusActions,
  GradeWorkflowStatus,
} from "@/lib/operations";
import { canAccessClass } from "@/lib/server/class-scope";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * The columns to write when a sheet lands on `nextStatus`, and — just as
 * importantly — the ones to clear when it retreats.
 *
 * Without the clearing, pulling a sheet back to "draft" left `approved_at` and
 * `published_at` populated: the status said draft while the audit trail still
 * claimed the marks had been approved and released to parents.
 */
const WORKFLOW_STAMP_COLUMNS: Record<Exclude<GradeWorkflowStatus, "draft">, string[]> = {
  submitted: ["submitted_at", "submitted_by"],
  approved: ["approved_at", "approved_by"],
  published: ["published_at", "published_by"],
};

const WORKFLOW_ORDER: GradeWorkflowStatus[] = ["draft", "submitted", "approved", "published"];

export function buildWorkflowUpdatePayload(
  nextStatus: GradeWorkflowStatus,
  userId: string,
  now: string = new Date().toISOString(),
): Record<string, unknown> {
  const payload: Record<string, unknown> = { status: nextStatus };

  const target = WORKFLOW_ORDER.indexOf(nextStatus);

  // Clear the stamps of every stage we are retreating *past* — those are the
  // claims that are no longer true. Earlier stages are deliberately left
  // alone: a sheet that was approved was still submitted, and erasing
  // `submitted_at` would throw away a real part of the audit trail.
  for (const stage of WORKFLOW_ORDER.slice(target + 1)) {
    // slice() never yields "draft" here, but the array's type still admits it.
    if (stage === "draft") continue;
    for (const column of WORKFLOW_STAMP_COLUMNS[stage]) {
      payload[column] = null;
    }
  }

  // …and set the one for the stage we are arriving at.
  if (nextStatus !== "draft") {
    const [atColumn, byColumn] = WORKFLOW_STAMP_COLUMNS[nextStatus];
    payload[atColumn] = now;
    payload[byColumn] = userId;
  }

  return payload;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success: rlOk } = rateLimit(request, 60, 60_000); // 60 requests per minute
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceKey,
    supabaseClientOptions({
      auth: { persistSession: false },
    }),
  );

  // Verify the token and get the auth user
  const {
    data: { user: authUser },
    error: authError,
  } = await supabaseAdmin.auth.getUser(authHeader);
  if (authError || !authUser) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Fetch profile to get role
  const { data: userData, error: userError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (userError || !userData) {
    logger.error("[API grades/workflow] Error fetching user:", userError);
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { class_id, subject_id, next_status, term, academic_year } = body;

    if (!class_id || !subject_id || !next_status || !term || !academic_year) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // This route runs on the service role and previously checked only that a
    // session existed — any parent, student or teacher could drive grade
    // status transitions for any class in any school.
    const WORKFLOW_ROLES = [
      "super_admin",
      "school_admin",
      "admin",
      "headmaster",
      "dean_of_studies",
      "teacher",
      "class_teacher",
    ];
    if (!WORKFLOW_ROLES.includes(userData.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: classRow } = await supabaseAdmin.from("classes").select("school_id").eq("id", class_id).maybeSingle();

    if (!classRow || (userData.role !== "super_admin" && classRow.school_id !== userData.school_id)) {
      return NextResponse.json({ error: "Class does not belong to your school" }, { status: 403 });
    }

    if (!(await canAccessClass(supabaseAdmin, userData.role, userData.id, class_id))) {
      return NextResponse.json({ error: "You can only manage grades for classes you teach" }, { status: 403 });
    }

    // 1. Fetch current status of grades for this set
    const { data: existingGrades, error: fetchError } = await supabaseAdmin
      .from("grades")
      .select("status")
      .eq("class_id", class_id)
      .eq("subject_id", subject_id)
      .eq("term", term)
      .eq("academic_year", academic_year)
      .limit(1);

    if (fetchError) throw fetchError;

    // Default to 'draft' if no grades found or status is null
    const currentStatus = (existingGrades?.[0]?.status || "draft") as GradeWorkflowStatus;

    // 2. Validate transition. Both directions are permitted: scenario #19 was
    // that a mis-keyed score could be sent to the DOS but never recalled.
    // Each direction is gated by the roles allowed to perform it forwards, so
    // a teacher can retract their own submission but cannot un-publish.
    const allowedActions = [
      ...getNextGradeWorkflowStatusActions(currentStatus, userData.role),
      ...getPrevGradeWorkflowStatusActions(currentStatus, userData.role),
    ];

    if (!allowedActions.includes(next_status)) {
      return NextResponse.json(
        {
          error: `Invalid transition from ${currentStatus} to ${next_status} for role ${userData.role}`,
        },
        { status: 403 },
      );
    }

    // 3. Perform update
    const updatePayload = buildWorkflowUpdatePayload(next_status, userData.id);

    const { error: updateError } = await supabaseAdmin
      .from("grades")
      .update(updatePayload)
      .eq("class_id", class_id)
      .eq("subject_id", subject_id)
      .eq("term", term)
      .eq("academic_year", academic_year)
      .is("deleted_at", null);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, status: next_status });
  } catch (err) {
    logger.error("[API grades/workflow] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
