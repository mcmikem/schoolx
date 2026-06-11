import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/api-utils";
import { getNextGradeWorkflowStatusActions, GradeWorkflowStatus } from "@/lib/operations";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Verify the token and get the auth user
  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(authHeader);
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
    const currentStatus = (existingGrades?.[0]?.status || 'draft') as GradeWorkflowStatus;

    // 2. Validate transition
    const allowedActions = getNextGradeWorkflowStatusActions(currentStatus, userData.role);
    
    if (!allowedActions.includes(next_status)) {
      return NextResponse.json({ 
        error: `Invalid transition from ${currentStatus} to ${next_status} for role ${userData.role}` 
      }, { status: 403 });
    }

    // 3. Perform update
    const updatePayload: Record<string, any> = {
      status: next_status,
    };

    if (next_status === "submitted") {
      updatePayload.submitted_at = new Date().toISOString();
      updatePayload.submitted_by = userData.id;
    }
    if (next_status === "approved") {
      updatePayload.approved_at = new Date().toISOString();
      updatePayload.approved_by = userData.id;
    }
    if (next_status === "published") {
      updatePayload.published_at = new Date().toISOString();
      updatePayload.published_by = userData.id;
    }

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
