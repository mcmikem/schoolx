import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";

const MGMT_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "dean_of_studies", "secretary"];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: MGMT_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const { searchParams } = request.nextUrl;
    const schoolId = searchParams.get("school_id") || auth.context.schoolId;
    const academicYear = searchParams.get("academic_year");
    const term = searchParams.get("term");
    const classId = searchParams.get("class_id");
    const subjectId = searchParams.get("subject_id");

    if (auth.context.user.role !== "super_admin") {
      const scope = assertSchoolScopeOrDeny({
        userSchoolId: auth.context.schoolId,
        requestedSchoolId: schoolId,
      });
      if (!scope.ok) return scope.response;
    }

    const supabase = createServiceRoleClientOrThrow();

    let query = supabase
      .from("assessment_sittings")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (academicYear) query = query.eq("academic_year", academicYear);
    if (term) query = query.eq("term", parseInt(term));
    if (classId) query = query.eq("class_id", classId);
    if (subjectId) query = query.eq("subject_id", subjectId);

    const { data, error } = await withTimeout(query, 15000, timeoutFallback());

    if (error) {
      logger.error("Failed to fetch assessment sittings:", error);
      return apiError("Failed to fetch assessment sittings", 500);
    }

    return apiSuccess({ sittings: data || [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: MGMT_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const body = await request.json();
    const {
      school_id,
      academic_year,
      term,
      name,
      group_key,
      assessment_type,
      class_id,
      subject_id,
      max_score,
      weight,
      scale,
      rating_key,
      reporting_behavior,
    } = body;

    const schoolId = school_id || auth.context.schoolId;
    if (auth.context.user.role !== "super_admin") {
      const scope = assertSchoolScopeOrDeny({
        userSchoolId: auth.context.schoolId,
        requestedSchoolId: schoolId,
      });
      if (!scope.ok) return scope.response;
    }

    if (!name || !group_key || !academic_year || !term) {
      return apiError("name, group_key, academic_year and term are required", 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    const { data, error } = await withTimeout(
      supabase
        .from("assessment_sittings")
        .insert({
          school_id: schoolId,
          academic_year,
          term: parseInt(term),
          name,
          group_key,
          assessment_type: assessment_type || null,
          class_id: class_id || null,
          subject_id: subject_id || null,
          max_score: max_score || 100,
          weight: weight ?? null,
          scale: scale || "numeric",
          rating_key: rating_key || null,
          reporting_behavior: reporting_behavior || "summary",
          created_by: auth.context.user.id,
        })
        .select()
        .single(),
      15000,
      timeoutFallback(),
    );

    if (error) {
      logger.error("Failed to create assessment sitting:", error);
      return apiError("Failed to create assessment sitting", 500);
    }

    return apiSuccess({ sitting: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: MGMT_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return apiError("id is required", 400);

    const supabase = createServiceRoleClientOrThrow();

    // Verify ownership
    const { data: existing } = await withTimeout(
      supabase.from("assessment_sittings").select("school_id").eq("id", id).maybeSingle(),
      15000,
      timeoutFallback(),
    );
    if (!existing) return apiError("Assessment sitting not found", 404);
    if (auth.context.user.role !== "super_admin") {
      const scope = assertSchoolScopeOrDeny({
        userSchoolId: auth.context.schoolId,
        requestedSchoolId: (existing as { school_id: string }).school_id,
      });
      if (!scope.ok) return scope.response;
    }

    const allowed = ["name", "group_key", "assessment_type", "max_score", "weight", "scale", "rating_key", "reporting_behavior", "is_active", "class_id", "subject_id"];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in updates) patch[key] = updates[key];
    }

    const { data, error } = await withTimeout(
      supabase.from("assessment_sittings").update(patch).eq("id", id).select().single(),
      15000,
      timeoutFallback(),
    );

    if (error) {
      logger.error("Failed to update assessment sitting:", error);
      return apiError("Failed to update assessment sitting", 500);
    }

    return apiSuccess({ sitting: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: MGMT_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");
    if (!id) return apiError("id is required", 400);

    const supabase = createServiceRoleClientOrThrow();

    const { data: existing } = await withTimeout(
      supabase.from("assessment_sittings").select("school_id").eq("id", id).maybeSingle(),
      15000,
      timeoutFallback(),
    );
    if (!existing) return apiError("Assessment sitting not found", 404);
    if (auth.context.user.role !== "super_admin") {
      const scope = assertSchoolScopeOrDeny({
        userSchoolId: auth.context.schoolId,
        requestedSchoolId: (existing as { school_id: string }).school_id,
      });
      if (!scope.ok) return scope.response;
    }

    // Soft delete: mark inactive rather than removing, so historical grades
    // keep their sitting reference.
    const { error } = await withTimeout(
      supabase.from("assessment_sittings").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id),
      15000,
      timeoutFallback(),
    );

    if (error) {
      logger.error("Failed to deactivate assessment sitting:", error);
      return apiError("Failed to deactivate assessment sitting", 500);
    }

    return apiSuccess({ id, deactivated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
